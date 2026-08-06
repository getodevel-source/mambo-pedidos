#!/usr/bin/env node
/**
 * Mambo Pedidos — Automated Validation Loop (v2)
 *
 * Auditoría OFICIAL basada en el PIPELINE REAL de producción:
 *   export-catalog-batch.js (extracción espacial + sanitize + finalize +
 *   match de imágenes + gates) + measure-catalog-assignment.js (medición
 *   post-gates). El antiguo extractor de anclas de precio (findPriceAnchors)
 *   se deprecó: reportaba 2201 productos no-GREEN cuando el pipeline real da
 *   97% GREEN — señal divergente que rompía el loop de calidad.
 *
 * Criterios de PASS (fail-closed, alineados al harness del loop):
 *   - RED post-gates === 0
 *   - 0 GREEN sin imagen
 *   - 0 cross-categoría post-gates
 *   - 0 duplicados
 *   - GREEN >= 90% del total
 *
 * Uso:
 *   node scripts/quality-pipeline.js [--verbose] [--quick] [--export path]
 *   --verbose : imprime el output completo del export + medición
 *   --quick   : corre UN solo catálogo (CATALOG_FILTER env, default 8BitDo)
 *   --export  : usa un export existente (no re-corre el batch)
 *   --pdf name: alias de --quick con ese filtro de catálogo
 *
 * Exit: 0 = PASS, 1 = FAIL (productos no conformes), 2 = error de corrida.
 * Escribe quality-report.json con el resumen.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const VERBOSE = process.argv.includes('--verbose');
const QUICK = process.argv.includes('--quick');
const EXPORT_ARG = process.argv.find((a, i) => process.argv[i - 1] === '--export');
const PDF_FILTER = process.argv.find((a, i) => process.argv[i - 1] === '--pdf');
const REPO = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO, 'scripts', 'export-catalog-batch.js');
const MEASURE = path.join(REPO, 'scripts', 'measure-catalog-assignment.js');

const GREEN_MIN_PCT = 90;


function node(cmd) {
  // Foreground dentro del parent: node falla silenciosamente en background.
  return execFileSync(process.execPath, cmd, {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    timeout: 600000 // batch completo ~8-10 min
  });
}

function parseMeasure(stdout) {
  const out = {};
  // Medir SIEMPRE del bloque post-gates ("=== DESPUÉS de gates ===").
  // El bloque pre-gates es la extracción cruda: sus cross-cat/status no
  // reflejan el producto final.
  const post = stdout.split('=== DESPUÉS de gates ===')[1] || stdout;
  const status = post.match(/status:\s*G=(\d+)\s+Y=(\d+)\s+R=(\d+)/);
  if (status) { out.green = +status[1]; out.yellow = +status[2]; out.red = +status[3]; }
  out.total = (post.match(/total:\s*(\d+)/) || [])[1] && +post.match(/total:\s*(\d+)/)[1];
  out.crossCat = (post.match(/cross-categoría:\s*(\d+)/) || [])[1] && +post.match(/cross-categoría:\s*(\d+)/)[1];
  out.crossBrand = (post.match(/cross-marca sin identidad:\s*(\d+)/) || [])[1] && +post.match(/cross-marca sin identidad:\s*(\d+)/)[1];
  out.duplicates = (post.match(/duplicados:\s*(\d+) grupos/) || [])[1] && +post.match(/duplicados:\s*(\d+) grupos/)[1];
  out.greenNoImg = (post.match(/GREEN sin imagen:\s*(\d+)/) || [])[1] && +post.match(/GREEN sin imagen:\s*(\d+)/)[1];
  out.redPostGates = (post.match(/RED post-gates:\s*(\d+)/) || [])[1] && +post.match(/RED post-gates:\s*(\d+)/)[1];
  return out;
}

async function main() {
  let exportPath = EXPORT_ARG;
  let perFile = null;

  console.log('\n🔬 MAMBO AUDIT — pipeline real (export + measure post-gates)\n');
  console.log('═'.repeat(70));

  const filter = PDF_FILTER || (QUICK ? (process.env.CATALOG_FILTER || '8BitDo') : null);

  if (!exportPath) {
    exportPath = path.join(os.tmpdir(), `export-audit-${Date.now()}.json`);
    const args = [RUNNER, exportPath];
    if (filter) process.env.CATALOG_FILTER = filter;
    console.log(`  ⚙️  Exportando ${filter ? `catálogo filtrado: ${filter}` : 'los 13 catálogos'} (~${filter ? 'segundos' : '8-10 min'})...\n`);
    const exportOut = node(args);
    if (VERBOSE) console.log(exportOut);
    // "Por catálogo: 8BitDo-2026:89" → resumen por archivo
    perFile = (exportOut.match(/Por catálogo: ([^:]+):(\d+)/g) || []).map(l => {
      const m = l.match(/Por catálogo: (.+):(\d+)/);
      return { name: m[1], total: +m[2] };
    });
  }

  console.log(`\n  📏 Midiendo post-gates...\n`);
  const measureOut = node([MEASURE, exportPath]);
  if (VERBOSE) console.log(measureOut);

  const m = parseMeasure(measureOut);
  if (!m.total || m.total === 0) {
    console.error('❌ No se pudo medir el export (¿pipeline roto?). Ver quality-pipeline.js');
    process.exit(2);
  }

  const greenPct = Math.round((m.green / m.total) * 100);
  console.log('═'.repeat(70));
  console.log(`\n  📊 RESULTADO (post-gates): ${m.total} productos`);
  console.log(`  🟢 GREEN:  ${m.green} (${greenPct}%)`);
  console.log(`  🟡 YELLOW: ${m.yellow} (${Math.round((m.yellow / m.total) * 100)}%)`);
  console.log(`  🔴 RED:    ${m.red} (${Math.round((m.red / m.total) * 100)}%)`);
  console.log(`  🖼️  GREEN sin imagen: ${m.greenNoImg} | cross-cat: ${m.crossCat} | cross-marca: ${m.crossBrand}`);
  console.log(`  🔁 Duplicados: ${m.duplicates} grupos`);

  if (perFile && perFile.length) {
    console.log(`\n  RESUMEN POR ARCHIVO:`);
    for (const f of perFile) console.log(`    ${String(f.total).padStart(4)} prod | ${f.name}`);
  }

  const checks = [
    ['RED post-gates = 0', m.red === 0],
    ['0 GREEN sin imagen', m.greenNoImg === 0],
    ['0 cross-categoría', m.crossCat === 0],
    ['0 duplicados', m.duplicates === 0],
    [`GREEN ≥ ${GREEN_MIN_PCT}%`, greenPct >= GREEN_MIN_PCT]
  ];
  console.log(`\n  CRITERIOS FAIL-CLOSED:`);
  let pass = true;
  for (const [label, ok] of checks) {
    console.log(`    ${ok ? '✅' : '❌'} ${label}`);
    if (!ok) pass = false;
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`\n  ${pass ? '✅ AUDIT PASS' : '❌ AUDIT FAIL — revisar criterios fallidos'}\n`);

  fs.writeFileSync(path.join(REPO, 'quality-report.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    total: m.total, green: m.green, yellow: m.yellow, red: m.red,
    greenPct, greenNoImg: m.greenNoImg, crossCat: m.crossCat,
    duplicates: m.duplicates, pass, perFile
  }, null, 2), 'utf-8');

  process.exit(pass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(2); });
