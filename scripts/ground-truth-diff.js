#!/usr/bin/env node
/**
 * ground-truth-diff.js — que cases etiquetas humanas y extraccion actual.
 *
 * measure-model-quality.js puntúa contra ground-truth/manifest.json, que es un
 * SNAPSHOT de la extraccion que se etiqueto. Cuando el parser cambia, el manifest
 * versionado sigue describiendo al parser viejo: el numero sale verde pero no
 * mide el codigo de hoy. Este script compara el manifest comiteado con el
 * candidate que produce ground-truth.js y dice, caso por caso, cuantas etiquetas
 * todavia apuntan al mismo producto.
 *
 * Uso:
 *   node scripts/ground-truth-diff.js            # manifiesto comiteado vs candidate
 *   node scripts/ground-truth-diff.js --json out.json
 *   node scripts/ground-truth-diff.js --packet   # escribe la lista para re-etiquetar
 *
 * Criterio: "misma posicion" = marca + FOB coinciden (el ancla fisica del caso).
 * Si la mayoria se pierde, el re-baseline es obligatorio antes de confiar en el
 * metrica de recall/FP.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const GT = path.join(__dirname, '..', 'ground-truth');
const argv = process.argv.slice(2);
const jsonIdx = argv.indexOf('--json');
const OUT = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;
const PACKET = argv.includes('--packet');

const committedPath = path.join(GT, 'manifest.json');
const candidatePath = path.join(GT, 'manifest.candidate.json');
const verdictsPath = path.join(GT, 'verdicts.json');

for (const f of [committedPath, candidatePath, verdictsPath]) {
  if (!fs.existsSync(f)) {
    console.error(`❌ Falta ${path.basename(f)}. Generá el candidate con:\n   MAMBO_CATALOG_DIR="C:\\Mambo catalogos" node scripts/ground-truth.js --per-pdf 5`);
    process.exit(2);
  }
}

const committed = JSON.parse(fs.readFileSync(committedPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const verdicts = JSON.parse(fs.readFileSync(verdictsPath, 'utf8'));
const byId = new Map(candidate.map((c) => [c.id, c]));

const rows = [];
let samePosition = 0;
let sameModelo = 0;
let orphan = 0;

for (const v of verdicts.items || []) {
  const now = byId.get(v.id);
  const pos = !!(now
    && String(now.marca || '').toLowerCase() === String(v.marca || '').toLowerCase()
    && Math.abs(Number(now.fob) - Number(v.fob)) < 1e-9);
  const modelo = !!(pos && String(now.modelo || '') === String(v.modelo || ''));
  if (pos) samePosition++;
  if (modelo) sameModelo++;
  if (!pos) orphan++;
  rows.push({
    id: v.id,
    veredicto: v.veredicto,
    razon: v.razon,
    etiquetado: { marca: v.marca, modelo: v.modelo, variante: v.variante, fob: v.fob, status: v.status },
    hoy: now ? { marca: now.marca, modelo: now.modelo, variante: now.variante, fob: now.fob, status: now.status, markerFile: now.markerFile } : null,
    mismaPosicion: pos,
    mismoModelo: modelo,
  });
}

const n = (verdicts.items || []).length;
const pct = (x) => (n ? Math.round((x / n) * 1000) / 10 : 0);
const report = {
  generatedAt: new Date().toISOString(),
  verdicts: n,
  manifestComiteado: committed.length,
  candidate: candidate.length,
  mismaPosicion: samePosition,
  mismaPosicionPct: pct(samePosition),
  mismoModeloTambien: sameModelo,
  huerfanas: orphan,
  reusable: samePosition === n && orphan === 0,
};

console.log('🔬 ground-truth: etiquetas humanas vs extraccion actual');
console.log(`  veredictos               ${report.verdicts}`);
console.log(`  manifest comiteado       ${report.manifestComiteado} · candidate ${report.candidate}`);
console.log(`  misma posicion (marca+FOB) ${samePosition} (${report.mismaPosicionPct}%)`);
console.log(`  y mismo modelo           ${sameModelo}`);
console.log(`  ids huerfanos            ${orphan}`);
console.log(report.reusable
  ? '\n✅ El candidate conserva las posiciones: se puede promover y medir sin re-etiquetar.'
  : '\n⚠️ Las posiciones no se conservan: el numero de measure-model-quality describe el snapshot etiquetado, no el parser actual. Hace falta re-etiquetar contra el candidate.');

if (OUT || PACKET) {
  const out = path.resolve(OUT || 'ground-truth/rebaseline-packet.json');
  const payload = Object.assign({ summary: report, rows }, PACKET ? { packet: 're-etiquetar sobre markerFile' } : null);
  fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`📄 ${PACKET ? 'Packet de re-etiquetado' : 'Reporte'} en ${out}`);
}
