#!/usr/bin/env node
/**
 * calibration-delta.js — reporte per-gate FP/FN ANTES/DESPUÉS de la calibración
 * (Slice 1, catalog-remediation-loop) con el tamaño de muestra de auditoría
 * etiquetada de cada gate.
 *
 * Fail-closed (spec gate-calibration): un candidato de regla que reduce FP pero
 * aumenta FN en la auditoría etiquetada es RECHAZADO; después de la calibración
 * FP y FN no deben aumentar respecto del estado anterior. Todo cambio de regla
 * viaja con su evidencia de auditoría etiquetada y su fixture en src/js/tests.js.
 *
 * Uso:
 *   node scripts/quality/calibration-delta.js --help
 *   node scripts/quality/calibration-delta.js                 # reporte completo
 *   node scripts/quality/calibration-delta.js --gate MODEL_MARKETING
 *   node scripts/quality/calibration-delta.js --audit audit.json   # auditoría completa
 *   node scripts/quality/calibration-delta.js --json               # salida JSON
 */
'use strict';

const path = require('path');
const fs = require('fs');

// Reusa las implementaciones reales de los gates (fuente única de verdad de la
// calibración): la clasificación noun-phrase/switch-axis vive en TextSanitizer,
// la resolución de ambigüedad de color en ImageTextGates.
const TextSanitizer = require(
  path.join(__dirname, '..', '..', 'src', 'js', 'textSanitizer.js'),
);
const ImageTextGates = require(
  path.join(__dirname, '..', '..', 'src', 'js', 'imageTextGates.js'),
);

/**
 * Auditorías etiquetadas por gate. `sampleSize` = tamaño de la auditoría
 * etiquetada de referencia (corpus FINAL5): MODEL_MARKETING 111, COLOR_AMBIGUOUS
 * 110, OUTLIER_PRICE 106. `rows` = muestra etiquetada con la que viaja la regla
 * (fijada por fixtures en src/js/tests.js); `--audit <file>` reemplaza/mergea
 * con la auditoría completa. `truth` = etiqueta del humano ("legit" | "puffery"
 * | "ambiguous" | "outlier").
 */
const CALIBRATION_DELTA_AUDITS = {
  MODEL_MARKETING: {
    sampleSize: 111,
    rows: [
      // Fix verificado del FP flagship: sintagma nominal legítimo (1 adjetivo de
      // marketing + sustantivo 'Dock', sin código).
      { modelo: 'Dual Charging Dock Xbox', truth: 'legit' },
      // Variante de mismo patrón con marca ficticia (anti-overfit estructural).
      { modelo: 'Novo Charging Dock Xbox', truth: 'legit' },
      // Regla de código intacta por la calibración.
      { modelo: 'AJ139 Pro 68 Keys', truth: 'legit' },
      // Switch + sustantivo de producto → identidad real (noun-phrase), no puffery.
      { modelo: 'Gateron Red Switch 87 Keys', truth: 'legit' },
      // Token de switch sin otro sustantivo → SWITCH_IN_MODEL, nunca MODEL_MARKETING.
      { modelo: 'Magnetic Switch T9', truth: 'legit' },
      // Puffery stack (≥2 adjetivos, sin sustantivo, sin código) → sigue YELLOW.
      { modelo: 'Ultra Crystalblade Gleam', truth: 'puffery' },
      // Variante de mismo patrón.
      { modelo: 'Ultra Crystalblade', truth: 'puffery' },
      // Puffery aunque lleve dígitos (68HE).
      { modelo: '68HE Ultra Jade King', truth: 'puffery' },
    ],
  },
  COLOR_AMBIGUOUS: {
    sampleSize: 110,
    rows: [
      // Diseño multi-color intencional: familias declaradas ≡ top colors de la foto.
      {
        variante: 'Pink/White',
        topColors: [
          { name: 'PINK', pct: 52 },
          { name: 'WHITE', pct: 30 },
        ],
        truth: 'legit',
      },
      {
        variante: 'Black Blue',
        topColors: [
          { name: 'BLACK', pct: 60 },
          { name: 'BLUE', pct: 25 },
        ],
        truth: 'legit',
      },
      // La foto muestra UN color → la multi-declaración SÍ es ambigua.
      {
        variante: 'Pink/White',
        topColors: [{ name: 'WHITE', pct: 90 }],
        truth: 'ambiguous',
      },
      {
        variante: 'Purple White Blue RGB',
        topColors: [{ name: 'WHITE', pct: 90 }],
        truth: 'ambiguous',
      },
    ],
  },
  OUTLIER_PRICE: {
    sampleSize: 106,
    rows: [
      // Outlier IQRx3 con evidencia literal de precio en la banda de fila → tier real.
      { fob: 89, literal: true, truth: 'legit' },
      // Evidencia geométrica solamente → sigue outlier (YELLOW).
      { fob: 95, literal: false, truth: 'outlier' },
    ],
  },
};

// ── Clasificadores ANTES (regla pre-calibración, congelada para el delta) ──
// Aceptan el modelo (string) o la fila de auditoría {modelo, truth} para
// soportar ambos caminos: analyzeGate y las fixtures de tests.js.
function marketingInput(row) {
  return typeof row === 'string' ? row : String((row && row.modelo) || '');
}

function beforeMarketing(modelo) {
  const m = marketingInput(modelo).trim();
  const mk = (m.match(TextSanitizer.MARKETING_WORDS_RE) || []).length;
  const mHasCode = TextSanitizer.MODEL_CODE_RE.test(m);
  return mk >= 2 || (!mHasCode && !/\d/.test(m) && mk >= 1);
}

function declaredColorFamilies(variante) {
  const re = new RegExp(
    '\\b(' + ImageTextGates.COLOR_KEEP_WORDS.join('|') + ')\\b',
    'gi',
  );
  const found = String(variante || '').match(re) || [];
  return [
    ...new Set(
      found
        .map((w) => ImageTextGates.COLOR_FAMILY[(w || '').toLowerCase()])
        .filter(Boolean),
    ),
  ];
}

function beforeColorAmbiguous(row) {
  return declaredColorFamilies(row.variante).length > 1;
}

// Pre-calibración: todo outlier IQRx3 degrada a YELLOW.
function beforeOutlier() {
  return true;
}

// ── Clasificadores DESPUÉS (calibración config-gated, implementación real) ──
function afterMarketing(modelo) {
  const cls = TextSanitizer.classifyMarketingModel(
    marketingInput(modelo).trim(),
  );
  return cls.class === 'puffery' || cls.class === 'marketing-only';
}

function afterColorAmbiguous(row) {
  const families = declaredColorFamilies(row.variante);
  if (families.length <= 1) return false;
  const interior = { topColors: row.topColors || [] };
  return !ImageTextGates.colorAmbiguityResolved(families, interior);
}

function afterOutlier(row) {
  return !row.literal;
}

const CLASSIFIERS = {
  beforeMarketing,
  afterMarketing,
  beforeColorAmbiguous,
  afterColorAmbiguous,
  beforeOutlier,
  afterOutlier,
};

const GATE_CLASSIFIERS = {
  // Los clasificadores de marketing reciben el modelo (string); acá se adaptan
  // a la fila de auditoría {modelo, truth}.
  MODEL_MARKETING: {
    before: (row) => beforeMarketing(row.modelo),
    after: (row) => afterMarketing(row.modelo),
  },
  COLOR_AMBIGUOUS: { before: beforeColorAmbiguous, after: afterColorAmbiguous },
  OUTLIER_PRICE: { before: beforeOutlier, after: afterOutlier },
};

/** Cuenta la confusión (FP/FN/TP/TN) de un clasificador sobre la muestra. */
function countConfusion(rows, classifier) {
  const counts = { fp: 0, fn: 0, tp: 0, tn: 0 };
  for (const row of rows) {
    const flagged = !!classifier(row);
    const positive =
      row.truth === 'puffery' ||
      row.truth === 'ambiguous' ||
      row.truth === 'outlier';
    if (flagged && positive) counts.tp++;
    else if (flagged && !positive) counts.fp++;
    else if (!flagged && positive) counts.fn++;
    else counts.tn++;
  }
  return counts;
}

/**
 * Evalúa un gate sobre la auditoría etiquetada. Fail-closed: FP o FN que
 * aumentan después de la calibración → "rejected" (el candidato no viaja y no
 * embarca fixture).
 */
function analyzeGate(gate, beforeFn, afterFn, rows) {
  const audit = CALIBRATION_DELTA_AUDITS[gate] || {};
  const sampleSize = audit.sampleSize || rows.length;
  const before = countConfusion(rows, beforeFn);
  const after = countConfusion(rows, afterFn);
  const rejected = after.fp > before.fp || after.fn > before.fn;
  let reason;
  if (rejected) reason = 'RECHAZADO: FP o FN aumentan (fail-closed)';
  else if (after.fp < before.fp) reason = 'Aceptado: FP bajan sin aumentar FN';
  else reason = 'Aceptado: FP/FN no aumentan';
  return {
    gate,
    sampleSize,
    before,
    after,
    verdict: rejected ? 'rejected' : 'accepted',
    reason,
  };
}

/**
 * Corre el delta de calibración para un gate ("all" = todos).
 * @param {{gate?:string, audits?:Object}} opts - audits opcional para
 *   reemplazar/mergear las auditorías embebidas (--audit <file>).
 * @returns {{rows:Array, rejected:Array, accepted:Array}}
 */
function runCalibrationDelta(opts = {}) {
  const audits = Object.assign({}, CALIBRATION_DELTA_AUDITS, opts.audits || {});
  const gate = opts.gate || 'all';
  const gates = gate === 'all' ? Object.keys(CALIBRATION_DELTA_AUDITS) : [gate];
  const rows = [];
  const rejected = [];
  const accepted = [];
  for (const g of gates) {
    const audit = audits[g];
    const pair = GATE_CLASSIFIERS[g];
    if (!audit || !pair) continue;
    const row = analyzeGate(g, pair.before, pair.after, audit.rows || []);
    rows.push(row);
    if (row.verdict === 'rejected') rejected.push(row.gate);
    else accepted.push(row.gate);
  }
  return { rows, rejected, accepted };
}

function printHelp() {
  console.log(
    'calibration-delta.js — reporte per-gate FP/FN antes/después de la calibración',
  );
  console.log('');
  console.log('Uso:');
  console.log(
    '  node scripts/quality/calibration-delta.js [--gate GATE] [--audit file.json] [--json]',
  );
  console.log('');
  console.log('Opciones:');
  console.log(
    '  --gate GATE      gate a evaluar: MODEL_MARKETING | COLOR_AMBIGUOUS | OUTLIER_PRICE (default: todos)',
  );
  console.log(
    '  --audit file     auditoría etiquetada completa en JSON (reemplaza/mergea las embebidas)',
  );
  console.log('  --json           salida JSON');
  console.log('  --help, -h       esta ayuda');
  console.log('');
  console.log(
    'Fail-closed: un candidato que reduce FP aumentando FN es rechazado;',
  );
  console.log('FP y FN no deben aumentar después de la calibración.');
}

function printReport(result) {
  console.log(
    '══════════════════════════════════════════════════════════════════════',
  );
  console.log(
    '  CALIBRATION DELTA — reporte per-gate (Slice 1, gate-calibration)',
  );
  console.log(
    '══════════════════════════════════════════════════════════════════════',
  );
  for (const row of result.rows) {
    const b = row.before;
    const a = row.after;
    console.log(`\n[${row.gate}] auditoría etiquetada n = ${row.sampleSize}`);
    console.log(`  Antes:   FP ${b.fp} · FN ${b.fn} · TP ${b.tp} · TN ${b.tn}`);
    console.log(`  Después: FP ${a.fp} · FN ${a.fn} · TP ${a.tp} · TN ${a.tn}`);
    console.log(`  Veredicto: ${row.verdict.toUpperCase()} — ${row.reason}`);
  }
  console.log(
    '\n──────────────────────────────────────────────────────────────────────',
  );
  console.log(
    `  Aceptados: ${result.accepted.length > 0 ? result.accepted.join(", ") : "—"}`,
  );
  if (result.rejected.length > 0) {
    console.log(`  RECHAZADOS (fail-closed): ${result.rejected.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log(
      '  Sin candidatos rechazados: FP y FN no aumentan en ninguna auditoría.',
    );
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  let gate = 'all';
  let auditFile = null;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--gate' && args[i + 1]) gate = args[++i];
    else if (args[i] === '--audit' && args[i + 1]) auditFile = args[++i];
    else if (args[i] === '--json') json = true;
  }
  let audits = null;
  if (auditFile) {
    try {
      const raw = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
      if (raw && typeof raw === 'object') audits = raw;
      else
        throw new Error(
          'la auditoría debe ser un objeto {GATE: {sampleSize, rows}}',
        );
    } catch (err) {
      console.error('❌ No se pudo leer la auditoría etiquetada:', err.message);
      process.exit(1);
    }
  }
  const result = runCalibrationDelta({ gate, audits });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReport(result);
  }
  if (result.rejected.length > 0) process.exitCode = 1;
}

module.exports = {
  CALIBRATION_DELTA_AUDITS,
  CLASSIFIERS,
  analyzeGate,
  runCalibrationDelta,
};
