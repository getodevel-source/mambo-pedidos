#!/usr/bin/env node
// ============================================
// gen-synthetic-corpus.js — corpus de PDFs de catálogo SINTÉTICO con
// ground-truth conocido (spec process-perf-gates / process-qa-groundtruth).
// Los catálogos reales son del cliente (no van al repo): el CI mide la
// extracción contra PDFs generados acá con texto/precios conocidos.
//
// Uso: node scripts/gen-synthetic-corpus.js [outDir]   (default /tmp/mambo-synth-corpus)
// Salida: <outDir>/*.pdf + <outDir>/ground-truth.json
const fs = require('fs');
const path = require('path');

const BRANDS = [
  ['Synta', 'K600T', 'Mechanical', 45.0],
  ['Synta', 'K600T', 'Magnetic', 55.5],
  ['Synta', 'M75', 'Black', 28.9],
  ['Synta', 'M75', 'White', 28.9],
  ['Voyetra', 'V87', 'Blue', 39.8],
  ['Voyetra', 'V87', 'Green', 39.8],
  ['Voyetra', 'V61', 'Grey', 34.2],
  ['Voyetra', 'Cobra', 'Black', 18.7],
  ['Nordic', 'N65', 'Pink', 61.3],
  ['Nordic', 'N65', 'White', 61.3],
  ['Nordic', 'AX5', 'Silver', 72.0],
  ['Nordic', 'AX5', 'Gold', 74.5],
  ['Keyster', 'KS98', 'Red', 47.7],
  ['Keyster', 'KS98', 'Blue', 49.9],
  ['Keyster', 'RK68', 'White', 22.1],
  ['Keyster', 'RK68', 'Black', 23.4],
];

function escapePdfText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(brand, rows) {
  const objects = [];
  let objNum = 0;
  const addObj = (content) => { objNum++; objects.push({ num: objNum, content }); return objNum; };

  // Orden de objetos: 1 catalog, 2 pages, 3 page, 4 contents, 5 font (Helvetica)
  const catalogNum = addObj('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesNum = addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  const pageNum = addObj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');

  // Content stream: header (marca) + filas (modelo a la izquierda, precio a la derecha)
  const lines = [];
  lines.push('BT /F1 16 Tf 1 0 0 1 50 750 Tm (' + escapePdfText(brand + ' ' + String(new Date().getFullYear())) + ') Tj ET');
  let y = 700;
  for (const [, modelo, variante, fob] of rows) {
    const left = `${brand} ${modelo} ${variante}`;
    const price = `$${fob.toFixed(2)}`;
    lines.push(`BT /F1 11 Tf 1 0 0 1 50 ${y} Tm (${escapePdfText(left)}) Tj ET`);
    lines.push(`BT /F1 11 Tf 1 0 0 1 470 ${y} Tm (${price}) Tj ET`);
    y -= 26;
  }
  const stream = lines.join('\n');
  const contentNum = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  const fontNum = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  for (const obj of objects) {
    offsets[obj.num] = Buffer.byteLength(pdf, 'binary');
    pdf += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += 'xref\n' + `0 ${objNum + 1}\n` + '0000000000 65535 f \n';
  for (let i = 1; i <= objNum; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += 'trailer\n' + `<< /Size ${objNum + 1} /Root ${catalogNum} 0 R >>\n` + 'startxref\n' + `${xrefOffset}\n` + '%%EOF\n';
  return Buffer.from(pdf, 'binary');
}

function main() {
  const outDir = process.argv[2] || '/tmp/mambo-synth-corpus';
  fs.mkdirSync(outDir, { recursive: true });
  const gt = {};
  // 3 marcas × 2 PDFs c/u = 6 PDFs de 16/2=8 filas c/u (rows repartidas)
  const brands = [...new Set(BRANDS.map(b => b[0]))];
  let idx = 0;
  for (const brand of brands) {
    for (let pdfN = 0; pdfN < 2; pdfN++) {
      const rows = BRANDS.filter(b => b[0] === brand).slice(pdfN * 2, pdfN * 2 + 2);
      const file = path.join(outDir, `${brand}-2026-${String.fromCharCode(65 + pdfN)}.pdf`);
      fs.writeFileSync(file, buildPdf(brand, rows));
      gt[path.basename(file)] = rows.map(([, modelo, variante, fob]) => ({ marca: brand, modelo, variante, fob }));
      idx++;
    }
  }
  fs.writeFileSync(path.join(outDir, 'ground-truth.json'), JSON.stringify(gt, null, 1));
  console.log(`Corpus sintético: ${idx} PDFs en ${outDir}`);
  return outDir;
}

if (require.main === module) main();
module.exports = { main, buildPdf, BRANDS };