const fs = require('fs');
const CV = require('../src/js/catalogValidator.js');
const path = process.argv[2] || 'C:\\Users\\juans\\Downloads\\mambo-catalogo-1972productos-2026-08-01 (1).json';
const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
const r = CV.auditCatalog(data);

console.log('Total:', r.total);
console.log('Clean:', r.clean, '(' + r.cleanPct + '%)');
console.log('With issues:', r.withIssues);
console.log('Status: G=' + r.stats.green + ' Y=' + r.stats.yellow + ' R=' + r.stats.red);
console.log('\nTOP ISSUES:');
r.topIssues.slice(0, 15).forEach(t => console.log('  ' + t.type.padEnd(28) + String(t.count).padStart(5) + ' (' + t.pct + '%)'));

console.log('\nSAMPLES:');
const seen = new Set();
r.topIssues.slice(0, 8).forEach(t => {
  console.log('\n[' + t.type + '] (' + t.count + ' total)');
  r.issues.filter(i => i.type === t.type).slice(0, 4).forEach(i => {
    const k = i.marca + '|' + i.modelo;
    if (!seen.has(k)) {
      seen.add(k);
      console.log('  marca="' + i.marca + '" modelo="' + (i.modelo || '').substring(0, 40) + '" var="' + (i.variante || '').substring(0, 30) + '" cat=' + i.cat + ' fob=' + i.fob + ' [' + i.status + ']');
    }
  });
});
