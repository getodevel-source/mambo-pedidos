#!/usr/bin/env node
/**
 * assignment-audit.js — reporte de integridad de asignación (slice 3 de
 * catalog-assignment-quality-gates).
 *
 * Le corre `CatalogAssignmentGates.runAll()` encima a un export real del
 * pipeline y deja las métricas del contrato en un JSON: imágenes compartidas
 * entre categorías o entre marcas sin identidad, tasa de placeholder, modelos
 * genéricos/ambiguos/truncados, duplicados y el semáforo antes/después.
 *
 * Sin este comando había que instanciar el módulo a mano, así que el contrato
 * no era verificable con un solo paso (que es justo lo que pide el change).
 *
 * Uso:
 *   node scripts/assignment-audit.js [catalog-export.json] [--json salida.json]
 *   node scripts/assignment-audit.js --check     # sale 1 si se rompe el contrato
 *
 * El export se genera con:
 *   MAMBO_CATALOG_DIR="C:\Mambo catalogos" node scripts/export-catalog-batch.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

// El módulo es browser-global con salida CJS; se le da un `window` mínimo.
global.window = global.window || global;
const Gates = require(path.join(__dirname, '..', 'src', 'js', 'catalogAssignmentGates.js'));

const argv = process.argv.slice(2);
const jsonIdx = argv.indexOf('--json');
const OUT = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;
const CHECK = argv.includes('--check');
const INPUT = argv.find((a) => !a.startsWith('--') && a !== OUT) || 'catalog-export.json';

function byReason(changes) {
  const out = {};
  for (const c of changes || []) {
    const k = c.reason || c.type || 'sin-razon';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

(async () => {
  const file = path.resolve(INPUT);
  if (!fs.existsSync(file)) {
    console.error(`❌ No existe el export: ${file}`);
    console.error('   MAMBO_CATALOG_DIR="C:\\Mambo catalogos" node scripts/export-catalog-batch.js catalog-export.json');
    process.exit(2);
  }
  const products = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(products) || !products.length) {
    console.error('❌ Se esperaba un array de productos no vacío.');
    process.exit(2);
  }
  console.log(`🔍 Auditando ${products.length} productos de ${path.basename(file)}...`);
  const res = Gates.runAll(products);
  const before = res.before || {};
  const after = res.after || {};
  const changes = res.changes || [];
  const duplicates = res.duplicates || [];

  // Un producto GREEN con placeholder es exactamente el defecto que originó el
  // change (score 100 sin foto), así que se cuenta aca y no solo en el JSON.
  const greenNoImage = (res.products || []).filter((p) => p.status === 'GREEN' && (!p.img || p.img === '-')).length;

  const report = {
    generatedAt: new Date().toISOString(),
    source: path.basename(file),
    before,
    after,
    changesByReason: byReason(changes),
    changesApplied: changes.length,
    duplicateGroups: duplicates.length,
    greenWithPlaceholder: greenNoImage,
    idempotent: JSON.stringify(before) === JSON.stringify(after),
  };

  const line = (k, v) => console.log(`  ${String(k).padEnd(38)} ${v}`);
  console.log('\n📊 Contrato de asignación (después de las gates)');
  line('productos', after.total);
  line('imágenes compartidas cross-category', after.crossCategory);
  line('compartidas cross-brand sin identidad', after.crossBrandNoIdentity);
  line('placeholder / tasa', `${after.placeholder} (${((after.placeholderRate || 0) * 100).toFixed(2)}%)`);
  line('GREEN con placeholder (debe ser 0)', greenNoImage);
  line('modelos genéricos / ambiguos / watch', `${after.genericModels} / ${after.ambiguousModels} / ${after.watchModels}`);
  line('modelos truncados', after.truncatedModels);
  line('duplicados (grupos / productos)', `${duplicates.length} / ${after.duplicateProducts}`);
  line('imágenes únicas / compartidas', `${after.uniqueImages} / ${after.sharedImages} (${after.sharedProductCount} usos)`);
  line('semáforo', JSON.stringify(after.status));
  line('cambios aplicados por el gate', `${changes.length} ${JSON.stringify(report.changesByReason)}`);
  line('idempotente sobre datos ya gateados', report.idempotent ? 'sí' : 'NO');

  if (OUT) {
    const out = path.resolve(OUT);
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`\n📄 Reporte en ${out}`);
  }

  if (CHECK) {
    const fails = [];
    if ((after.crossCategory || 0) > 0) fails.push(`${after.crossCategory} imágenes compartidas entre categorías`);
    if ((after.crossBrandNoIdentity || 0) > 0) fails.push(`${after.crossBrandNoIdentity} compartidas entre marcas sin identidad`);
    if (greenNoImage > 0) fails.push(`${greenNoImage} GREEN sin imagen real`);
    if ((after.duplicateGroups || 0) > 0) fails.push(`${after.duplicateGroups} grupos duplicados`);
    if (fails.length) {
      console.error(`\n❌ CHECK FAILED: ${fails.join(' · ')}`);
      process.exit(1);
    }
    console.log('\n✅ CHECK OK: el contrato de asignación se sostiene en este export.');
  }
})().catch((err) => {
  console.error(`💥 assignment-audit crashed: ${err && err.stack ? err.stack : err}`);
  process.exit(2);
});
