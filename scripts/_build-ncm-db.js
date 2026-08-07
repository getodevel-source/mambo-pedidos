// Genera ncmDatabase.json a partir del nomenclador ARCA (formato @-delimitado).
// Uso: node scripts/_build-ncm-db.js <ruta/nomenclador.txt> <salida.json>
const fs = require('fs');
const path = require('path');
const inp = process.argv[2];
const out = process.argv[3] || __dirname + '/../src/data/ncmDatabase.json';
const lines = fs.readFileSync(inp, 'latin1').split(/\r?\n/);

// Mapa ncm de 8 dígitos -> {ncm, desc, di, count}
const map = new Map();
for (const line of lines) {
  if (!line.trim()) continue;
  const p = line.split('@');
  if (p.length < 11 || p[0].trim() !== '2') continue;
  const code = p[1].trim();
  const m = code.match(/^(\d{4})\.(\d{2})\.(\d{2})\.(\d{3})/);
  if (!m) continue;
  if (/^00\d{2}/.test(m[1])) continue; // capítulos 01-97; prefijos 00XX = marcadores de sección/sufijos (no productos)
  const ncm = `${m[1]}.${m[2]}.${m[3]}`;
  const di = parseFloat(p[4].trim()) / 100; // campo4 = Derecho de Importación
  const desc = p.slice(9).join('@').replace(/\s+/g, ' ').trim();
  const e = map.get(ncm);
  if (e) { e.count++; if (di > 0) { e.di = di; e.desc = e.desc || desc; } }
  else map.set(ncm, { ncm, desc, di, count: 1 });
}

const registros = Array.from(map.values()).map(e => ({ ncm: e.ncm, desc: e.desc, di: e.di }));
registros.sort((a, b) => a.ncm.localeCompare(b.ncm));

const db = { vigencia: '2026-08-07', fuente: 'ARCA/AFIP nomenclador', total: registros.length, registros };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(db));
// Versión .js para carga vía <script> (sin fetch/CORS, funciona en Tauri y file://).
const jsOut = out.replace(/\.json$/, '.js');
fs.writeFileSync(jsOut, 'window.NCM_DB = ' + JSON.stringify(db) + ';\n');
console.log(`OK ${registros.length} registros → ${out} (+${path.basename(jsOut)})`);