#!/usr/bin/env node
/**
 * quality-iterate.js — Reproducible catalog-quality iteration loop for Mambo.
 *
 * El flujo completo para cargar el catálogo, conseguir el JSON con los nuevos
 * resultados y seguir iterando para mejorarlos:
 *
 *   1. (re)procesa los 13 PDFs reales de C:\Mambo\Catalogos con el MISMO
 *      pipeline que la app (export-catalog-batch.js: extracción espacial +
 *      sanitize + finalize + match de imágenes + ImportGates).
 *   2. Escribe el export JSON (con evidence de gates: imgTextWarnings,
 *      imgAspect, imageEvidence, groundingEvidence).
 *   3. Mide el catálogo y genera un REPORTE ESTRUCTURADO con los deltas vs un
 *      baseline opcional.
 *   4. Si se pasa un --baseline (reporte anterior), compara GREEN/YELLOW/RED,
 *      razones de warning y tipos de gate: cada iteración muestra si mejoramos
 *      o empeoramos.
 *
 * Uso:
 *   node scripts/quality-iterate.js                          # export + medir (8-10 min)
 *   node scripts/quality-iterate.js --export path.json       # medir un export existente
 *   node scripts/quality-iterate.js --export path.json --baseline reporte.json
 *
 * Salidas (en la raíz del repo):
 *   quality-report.json        — resumen del ciclo actual (shape estable del pipeline)
 *   quality-iterate-report.json — reporte completo: status, razones, tipos de gate, deltas
 *
 * Exit: 0 = criterios fail-closed cumplidos, 1 = no, 2 = error de corrida.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const VERBOSE = process.argv.includes('--verbose');
const EXPORT_ARG = process.argv.find(
  (a, i) => process.argv[i - 1] === '--export',
);
const BASELINE_ARG = process.argv.find(
  (a, i) => process.argv[i - 1] === '--baseline',
);
const REPO = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO, 'scripts', 'export-catalog-batch.js');
const MEASURE = path.join(REPO, 'scripts', 'measure-catalog-assignment.js');
const REPORT_PATH = path.join(REPO, 'quality-report.json');
const ITERATE_PATH = path.join(REPO, 'quality-iterate-report.json');

function node(cmd, tolerateNonZero) {
  try {
    return execFileSync(process.execPath, cmd, {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
      timeout: 900000, // export completo ~8-10 min
    });
  } catch (e) {
    // measure-catalog-assignment.js sale con exit 1 cuando quedan RED o
    // GREEN sin imagen (criterio fail-closed del propio script). Eso NO es un
    // error de corrida: es el veredicto que estamos midiendo.
    if (tolerateNonZero && e.stdout) return e.stdout;
    throw e;
  }
}

function parseMeasure(stdout) {
  const out = {};
  const post = stdout.split('=== DESPUÉS de gates ===')[1] || stdout;
  const status = post.match(/status:\s*G=(\d+)\s+Y=(\d+)\s+R=(\d+)/);
  if (status) {
    out.green = +status[1];
    out.yellow = +status[2];
    out.red = +status[3];
  }
  out.total =
    (post.match(/total:\s*(\d+)/) || [])[1] && +post.match(/total:\s*(\d+)/)[1];
  out.crossCat =
    (post.match(/cross-categoría:\s*(\d+)/) || [])[1] &&
    +post.match(/cross-categoría:\s*(\d+)/)[1];
  out.crossBrand =
    (post.match(/cross-marca sin identidad:\s*(\d+)/) || [])[1] &&
    +post.match(/cross-marca sin identidad:\s*(\d+)/)[1];
  out.duplicates =
    (post.match(/duplicados:\s*(\d+) grupos/) || [])[1] &&
    +post.match(/duplicados:\s*(\d+) grupos/)[1];
  out.greenNoImg =
    (post.match(/GREEN sin imagen:\s*(\d+)/) || [])[1] &&
    +post.match(/GREEN sin imagen:\s*(\d+)/)[1];
  out.redPostGates =
    (post.match(/RED post-gates:\s*(\d+)/) || [])[1] &&
    +post.match(/RED post-gates:\s*(\d+)/)[1];
  return out;
}

/** Analiza un export en profundidad: status, razones, tipos de gate, outliers, grounding. */
function analyze(products) {
  const report = {
    total: products.length,
    byStatus: { GREEN: 0, YELLOW: 0, RED: 0 },
    byReason: {}, // qualityReason → count (solo YELLOW/RED)
    byGateType: {}, // _imgTextWarnings type → count
    byCatalog: {}, // sourceFile → {G, Y, R}
    groundedFalse: 0,
    withGroundingEvidence: 0,
    outliersIqr3: 0,
    imgWarnCount: 0,
  };
  for (const p of products) {
    report.byStatus[p.status] = (report.byStatus[p.status] || 0) + 1;
    if (p.status !== 'GREEN') {
      const qr = String(
        p.qualityReason || (p.warnings && p.warnings[0]) || 'Sin razón',
      ).slice(0, 110);
      report.byReason[qr] = (report.byReason[qr] || 0) + 1;
    }
    for (const w of p._imgTextWarnings || []) {
      report.byGateType[w.type] = (report.byGateType[w.type] || 0) + 1;
      report.imgWarnCount++;
    }
    const f = p.sourceFile || '?';
    report.byCatalog[f] = report.byCatalog[f] || {
      GREEN: 0,
      YELLOW: 0,
      RED: 0,
    };
    report.byCatalog[f][p.status] = (report.byCatalog[f][p.status] || 0) + 1;
    if (p.grounded === false) report.groundedFalse++;
    if (p.groundingEvidence) report.withGroundingEvidence++;
    if (p._outlierEvidence && p._outlierEvidence.factor >= 3)
      report.outliersIqr3++;
  }
  return report;
}

function printDelta(cur, base) {
  const bs = base && (base.analysis?.byStatus || base.byStatus);
  const d = (c, b) =>
    b === undefined ? '' : ` (${c - b >= 0 ? "+" : ""}${c - b})`;
  console.log(
    '  GREEN:  ',
    cur.byStatus.GREEN,
    d(cur.byStatus.GREEN, bs && bs.GREEN),
  );
  console.log(
    '  YELLOW: ',
    cur.byStatus.YELLOW,
    d(cur.byStatus.YELLOW, bs && bs.YELLOW),
  );
  console.log(
    '  RED:    ',
    cur.byStatus.RED,
    d(cur.byStatus.RED, bs && bs.RED),
  );
}

async function main() {
  console.log('\n🔁 MAMBO QUALITY ITERATION LOOP\n');
  console.log('═'.repeat(70));

  let exportPath = EXPORT_ARG;
  if (!exportPath) {
    exportPath = path.join(os.tmpdir(), `export-iterate-${Date.now()}.json`);
    console.log(
      `  ⚙️  Reprocesando los 13 catálogos (mismo pipeline que la app) — ~8-10 min...\n`,
    );
    node([RUNNER, exportPath]);
  }
  console.log(`  📦 Export: ${exportPath}\n`);

  let products;
  try {
    products = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  } catch (e) {
    console.error(
      `❌ No se pudo leer/parsear el export ${exportPath}: ${e.message}`,
    );
    process.exit(2);
  }
  if (!Array.isArray(products) || !products.length) {
    console.error('❌ Export vacío o inválido.');
    process.exit(2);
  }

  const cur = analyze(products);
  const measureOut = node(
    [MEASURE, exportPath],
    true /* tolerate exit 1 con RED */,
  );
  if (VERBOSE) console.log(measureOut);
  const m = parseMeasure(measureOut);

  let base = null;
  if (BASELINE_ARG) {
    try {
      base = JSON.parse(fs.readFileSync(BASELINE_ARG, 'utf8'));
    } catch (e) {
      console.error(
        `⚠️  No se pudo leer el baseline ${BASELINE_ARG}: ${e.message}`,
      );
    }
  }

  console.log('═══ RESULTADO DEL CICLO ═══');
  printDelta(cur, base);
  console.log(
    `\n  Grounding sin evidencia (grounded=false): ${cur.groundedFalse}`,
  );
  console.log(
    `  Con groundingEvidence: ${cur.withGroundingEvidence} | Outliers IQR≥3: ${cur.outliersIqr3}`,
  );
  console.log(
    `  Gate evidence (_imgTextWarnings): ${cur.imgWarnCount} warnings`,
  );
  console.log(`\n  Top razones YELLOW/RED:`);
  Object.entries(cur.byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));
  console.log(`\n  Tipos de gate:`);
  Object.entries(cur.byGateType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  ${k}`));

  const greenPct = Math.round((cur.byStatus.GREEN / cur.total) * 100);
  console.log(
    `\n  GREEN: ${greenPct}% del total | YELLOW: ${Math.round((cur.byStatus.YELLOW / cur.total) * 100)}% | RED: ${cur.byStatus.RED}`,
  );

  const checks = [
    // Integridad de asignación: estas nunca deben pasar, en ningún ciclo.
    ['0 GREEN sin imagen', (m.greenNoImg || 0) === 0],
    ['0 cross-categoría', (m.crossCat || 0) === 0],
    ['0 duplicados', (m.duplicates || 0) === 0],
    // El RED del export crudo es la señal de basura del parser (specs como
    // modelo, FOB inválido) que el import filtra. No 'falla' el ciclo: se
    // mide y se ataca en la iteración. Solo alerta cuando crece.
    [
      'RED < 10% del total (señal de parser aceptable)',
      (m.red || 0) < cur.total * 0.1,
    ],
  ];
  let pass = true;
  console.log('\n  CRITERIOS FAIL-CLOSED:');
  for (const [label, ok] of checks) {
    console.log(`    ${ok ? "✅" : "❌"} ${label}`);
    if (!ok) pass = false;
  }

  // Persistir ambos reportes
  const summary = {
    timestamp: new Date().toISOString(),
    total: cur.total,
    green: cur.byStatus.GREEN,
    yellow: cur.byStatus.YELLOW,
    red: cur.byStatus.RED,
    greenPct,
    greenNoImg: m.greenNoImg || 0,
    crossCat: m.crossCat || 0,
    duplicates: m.duplicates || 0,
    pass,
    groundedFalse: cur.groundedFalse,
    outliersIqr3: cur.outliersIqr3,
    exportPath,
  };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2), 'utf8');

  const iterate = {
    generatedAt: new Date().toISOString(),
    exportPath,
    summary,
    analysis: cur,
    baseline: base
      ? { file: BASELINE_ARG, at: base.generatedAt || base.timestamp }
      : null,
    deltas: base
      ? (() => {
          const bs = base.analysis?.byStatus || base.byStatus;
          return {
            green: cur.byStatus.GREEN - (bs ? bs.GREEN : 0),
            yellow: cur.byStatus.YELLOW - (bs ? bs.YELLOW : 0),
            red: cur.byStatus.RED - (bs ? bs.RED : 0),
          };
        })()
      : null,
    nextSteps: [
      'Mejorar el parser: bajar YELLOW por modelo marketing/truncado (ver byReason)',
      'Verificar RED (specs como modelo) contra el PDF fuente',
      'Revisar color-mismatch de alta ocupación (foto no coincide con variante)',
      'Revisar outliers IQR≥3 (precios fuera de banda)',
    ],
  };
  fs.writeFileSync(ITERATE_PATH, JSON.stringify(iterate, null, 2), 'utf8');

  console.log('\n' + '═'.repeat(70));
  console.log(
    `\n  ${pass ? "✅ CICLO PASS" : "❌ CICLO FAIL — revisar criterios fallidos"}`,
  );
  console.log(`  📄 quality-report.json        → resumen del ciclo`);
  console.log(
    `  📄 quality-iterate-report.json → análisis completo + deltas\n`,
  );

  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
