#!/usr/bin/env node
/**
 * Mambo Pedidos — Standalone Catalog Auditor
 * 
 * Usage:
 *   node scripts/audit-catalog.js <catalog.json>
 *   node scripts/audit-catalog.js --tauri-store
 *   node scripts/audit-catalog.js <catalog.json> --csv output.csv
 * 
 * The JSON file should contain { items: [...] } or a plain array of products.
 * Export from the app console: copy(JSON.stringify(catalog)) → paste into a file.
 */

const fs = require('fs');
const path = require('path');

// Load modules
const CatalogValidator = require('../src/js/catalogValidator.js');
const TextSanitizer = require('../src/js/textSanitizer.js');

// Parse args
const args = process.argv.slice(2);
let inputFile = null;
let csvOutput = null;
let useTauriStore = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--csv' && args[i + 1]) {
    csvOutput = args[i + 1];
    i++;
  } else if (args[i] === '--tauri-store') {
    useTauriStore = true;
  } else if (!args[i].startsWith('--')) {
    inputFile = args[i];
  }
}

// Try to find Tauri store file
function findTauriStore() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'com.mambo.pedidos', '.mambo-store.json'),
    path.join(process.env.APPDATA || '', 'Mambo Pedidos', '.mambo-store.json'),
    path.join(process.env.LOCALAPPDATA || '', 'com.mambo.pedidos', '.mambo-store.json'),
    path.join(process.env.HOME || '', '.local', 'share', 'com.mambo.pedidos', '.mambo-store.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Load catalog data
let products = [];

if (useTauriStore) {
  const storePath = findTauriStore();
  if (!storePath) {
    console.error('❌ No se encontró el archivo .mambo-store.json');
    console.error('   Probá exportando desde la consola de la app:');
    console.error('   copy(JSON.stringify(catalog))');
    console.error('   Y pegalo en un archivo .json');
    process.exit(1);
  }
  console.log(`📂 Leyendo Tauri Store: ${storePath}`);
  const raw = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
  const catalogData = raw['mambo_catalog_v2'] || raw;
  products = catalogData.items || catalogData || [];
} else if (inputFile) {
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Archivo no encontrado: ${inputFile}`);
    process.exit(1);
  }
  console.log(`📂 Leyendo: ${inputFile}`);
  const raw = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  products = raw.items || raw || [];
} else {
  console.log('Mambo Pedidos — Catalog Auditor');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/audit-catalog.js <catalog.json>');
  console.log('  node scripts/audit-catalog.js --tauri-store');
  console.log('  node scripts/audit-catalog.js <catalog.json> --csv report.csv');
  console.log('');
  console.log('Para exportar el catálogo desde la app:');
  console.log('  1. Abrí la consola (F12)');
  console.log('  2. Escribí: copy(JSON.stringify(catalog))');
  console.log('  3. Pegá el contenido en un archivo .json');
  console.log('  4. Corré: node scripts/audit-catalog.js mi-catalogo.json');
  process.exit(0);
}

if (!Array.isArray(products) || products.length === 0) {
  console.error('❌ No se encontraron productos en el archivo');
  process.exit(1);
}

console.log(`📦 ${products.length} productos cargados\n`);

// Run audit
const report = CatalogValidator.auditCatalog(products);

// Print summary
console.log('═══════════════════════════════════════════════════');
console.log(`  AUDITORÍA DE CATÁLOGO — ${report.total} productos`);
console.log('═══════════════════════════════════════════════════');
console.log(`  ✅ Limpios:     ${report.clean} (${report.cleanPct}%)`);
console.log(`  ⚠️  Con issues:  ${report.withIssues} (${100 - report.cleanPct}%)`);
console.log(`  📊 Semáforo:    🟢${report.stats.green} 🟡${report.stats.yellow} 🔴${report.stats.red}`);
console.log(`  📋 Total issues: ${report.issueCount}`);
console.log('───────────────────────────────────────────────────');
console.log('  TOP ISSUES:');
for (const t of report.topIssues.slice(0, 15)) {
  console.log(`    ${t.type.padEnd(25)} ${String(t.count).padStart(4)} (${t.pct}%)`);
}
console.log('═══════════════════════════════════════════════════');

// Show sample issues (first 20)
if (report.issues.length > 0) {
  console.log('\n  PRIMEROS 20 ISSUES:');
  console.log('  ─────────────────────────────────────────────────');
  for (const issue of report.issues.slice(0, 20)) {
    console.log(`  [${issue.index}] ${issue.type.padEnd(22)} | ${issue.marca.padEnd(12)} | modelo: "${(issue.modelo || '').substring(0, 35)}" | ${issue.detail}`);
  }
  if (report.issues.length > 20) {
    console.log(`  ... y ${report.issues.length - 20} issues más`);
  }
}

// CSV export
if (csvOutput) {
  const csv = report.exportCSV();
  fs.writeFileSync(csvOutput, csv, 'utf-8');
  console.log(`\n📄 CSV exportado: ${csvOutput} (${report.issues.length} filas)`);
}

// Also write a JSON report
const jsonReportPath = csvOutput
  ? csvOutput.replace(/\.csv$/i, '.json')
  : 'audit-report.json';

const jsonReport = {
  generatedAt: new Date().toISOString(),
  total: report.total,
  clean: report.clean,
  withIssues: report.withIssues,
  cleanPct: report.cleanPct,
  stats: report.stats,
  topIssues: report.topIssues,
  byType: report.byType,
  issues: report.issues
};

fs.writeFileSync(jsonReportPath, JSON.stringify(jsonReport, null, 2), 'utf-8');
console.log(`📄 Reporte JSON: ${jsonReportPath}`);

// Exit code: 0 if >90% clean, 1 otherwise
const exitCode = report.cleanPct >= 90 ? 0 : 1;
if (exitCode === 1) {
  console.log(`\n⚠️  Menos del 90% limpio (${report.cleanPct}%). Revisá los issues arriba.`);
} else {
  console.log(`\n✅ Catálogo en buen estado (${report.cleanPct}% limpio).`);
}
process.exit(exitCode);
