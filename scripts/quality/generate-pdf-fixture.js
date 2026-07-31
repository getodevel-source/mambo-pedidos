/**
 * Generate a minimal sanitized PDF fixture for Slice 2 testing.
 * Produces a single-page PDF with one small embedded image (a colored rectangle).
 * Usage: node scripts/quality/generate-pdf-fixture.js
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'pdf-fixture.pdf');

// Minimal 4x4 red pixel PNG (1x1 would be too small for the 25px filter)
// This is a valid 4x4 RGBA PNG encoded as base64
const PNG_4X4_RED = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGP8z8DAwIAGGAEAAyQBAUFXGqAAAAAASUVORK5CYII=',
  'base64'
);

// Build a minimal PDF with an inline image
function buildPdf() {
  const objects = [];
  let objNum = 0;

  function addObj(content) {
    objNum++;
    objects.push({ num: objNum, content });
    return objNum;
  }

  // Catalog
  const catalogNum = addObj('<< /Type /Catalog /Pages 2 0 R >>');
  // Pages
  const pagesNum = addObj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  // Page
  const pageNum = addObj(
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources << /XObject << /Img0 5 0 R >> >> >>'
  );
  // Content stream: draw the image at position (50, 100) with size 40x40
  const stream = 'q 40 0 0 40 50 100 cm /Img0 Do Q';
  const contentNum = addObj(
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  );
  // Image XObject
  const imgStream = PNG_4X4_RED.toString('binary');
  const imageNum = addObj(
    `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${PNG_4X4_RED.length} >>\nstream\n`
  );

  // Build the PDF byte by byte
  let pdf = '%PDF-1.4\n';
  const offsets = [];

  for (const obj of objects) {
    offsets[obj.num] = Buffer.byteLength(pdf, 'binary');
    if (obj.num === imageNum) {
      // Binary stream for image
      pdf += `${obj.num} 0 obj\n${obj.content}`;
      const buf = Buffer.from(pdf, 'binary');
      const imgBuf = PNG_4X4_RED;
      const endBuf = Buffer.from('\nendstream\nendobj\n', 'binary');
      const combined = Buffer.concat([buf, imgBuf, endBuf]);
      pdf = combined.toString('binary');
    } else {
      pdf += `${obj.num} 0 obj\n${obj.content}\nendobj\n`;
    }
  }

  // Cross-reference table
  const xrefOffset = Buffer.byteLength(pdf, 'binary');
  pdf += 'xref\n';
  pdf += `0 ${objNum + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objNum; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  pdf += 'trailer\n';
  pdf += `<< /Size ${objNum + 1} /Root ${catalogNum} 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF\n';

  return Buffer.from(pdf, 'binary');
}

const buf = buildPdf();
fs.writeFileSync(OUT, buf);
console.log(`Generated: ${OUT} (${buf.length} bytes)`);

// Compute SHA-256 for the manifest
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update(buf).digest('hex');
console.log(`SHA-256: ${hash}`);

// Update manifest with the real hash
const manifestPath = path.join(__dirname, 'pdf-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.fixtures && manifest.fixtures[0]) {
  manifest.fixtures[0].sha256 = hash;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Updated manifest with SHA-256: ${hash}`);
}
