/**
 * measure-catalog-assignment.js — Assignment quality audit for Mambo catalogs.
 *
 * Usage:
 *   node scripts/measure-catalog-assignment.js <catalog-export.json>
 *
 * Loads an exported catalog, runs the CatalogAssignmentGates (image integrity,
 * model quality, duplicates), and prints baseline vs post-gate metrics plus the
 * concrete changes. Exit code 0 when no RED/invalid assignments remain after
 * the gates, 1 otherwise.
 */

const fs = require('fs');
const _path = require('path');
const GATES = require('../src/js/catalogAssignmentGates.js');

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/measure-catalog-assignment.js <catalog-export.json>');
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
const products = Array.isArray(data) ? data : (data.products || data.catalog || []);
if (!products.length) {
  console.error('No se encontraron productos en el archivo.');
  process.exit(2);
}

function pct(n, d) {
  return d ? ((n / d) * 100).toFixed(1) + '%' : '-';
}

const result = GATES.runAll(products);

const fmt = (m) => [
  `  total: ${m.total}`,
  `  con imagen: ${m.withImage} (${pct(m.withImage, m.total)}) | placeholder: ${m.placeholder} (${pct(m.placeholder, m.total)})`,
  `  imágenes únicas: ${m.uniqueImages} | compartidas: ${m.sharedImages} (${m.sharedProductCount} productos)`,
  `  cross-categoría: ${m.crossCategory} | cross-marca sin identidad: ${m.crossBrandNoIdentity}`,
  `  modelos genéricos: ${m.genericModels} | ambiguos: ${m.ambiguousModels} | truncados: ${m.truncatedModels}`,
  `  duplicados: ${m.duplicateGroups} grupos (${m.duplicateProducts} productos)`,
  `  status: G=${m.status.GREEN} Y=${m.status.YELLOW} R=${m.status.RED}`,
].join('\n');

console.log('=== ANTES de gates ===');
console.log(fmt(result.before));
console.log('\n=== DESPUÉS de gates ===');
console.log(fmt(result.after));
console.log(`\nCambios aplicados: ${result.changes.length}`);

const byType = {};
for (const c of result.changes) byType[c.type] = (byType[c.type] || 0) + 1;
for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${type}: ${count}`);
}

if (result.duplicates.length) {
  console.log('\n=== DUPLICADOS (marca+modelo+cat+fob) ===');
  result.duplicates.slice(0, 15).forEach(d => {
    console.log(`  x${d.count} fob=${d.fob} skus=${d.skus.slice(0, 5).join(', ')}`);
  });
}

// Exit: 0 only if no RED remains and placeholders are flagged (never GREEN).
const reds = result.after.status.RED;
const greenPlaceholders = result.products.filter(
  p => p.status === 'GREEN' && !GATES.hasRealImage(p)
).length;
console.log(`\nRED post-gates: ${reds} | GREEN sin imagen: ${greenPlaceholders}`);
process.exit(reds === 0 && greenPlaceholders === 0 ? 0 : 1);
