#!/usr/bin/env node
/**
 * photo-baseline.js — baseline versionado de calidad de imágenes (photo-quality).
 *
 * Mide el export real del pipeline (catalog-export.json) y deja un número
 * comparable en el tiempo: lado menor promedio/mediana, % de fotos chicas y
 * tamaño total del payload de imágenes. photo-quality/tasks.md pedía correr
 * `scripts/_dbg_real_audit.js` para guardar ese baseline, pero ese script nunca
 * se versionó (es scratch gitignored): sin archivo versionado no hay referencia
 * de regresión posible. Este es ese script.
 *
 * Uso:
 *   node scripts/photo-baseline.js [catalog-export.json]
 *   node scripts/photo-baseline.js --json ground-truth/photo-baseline.json
 *   node scripts/photo-baseline.js --check            # umbrales del change
 *   node scripts/photo-baseline.js --check --min-avg 300 --max-under-150 1
 *
 * --check sale 1 si avg del lado menor < --min-avg o si el % de fotos con lado
 * menor < 150px supera --max-under-150. Sin --check sólo informa.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadImage } = require('canvas');

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('--') && !/^(\d|\.|C:)/i.test(a));
const INPUT = positional[0] || 'catalog-export.json';
const CHECK = argv.includes('--check');
const flagNumber = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] != null ? Number(argv[i + 1]) : dflt;
};
const jsonIdx = argv.indexOf('--json');
const OUT_JSON = jsonIdx >= 0 ? argv[jsonIdx + 1] : null;

// Umbrales documentados en openspec/changes/photo-quality/tasks.md (Unidad 2.2).
const MIN_AVG_SHORT = flagNumber('min-avg', 300);
const MAX_UNDER_150_PCT = flagNumber('max-under-150', 1);

const isDataUrl = (v) => typeof v === 'string' && /^data:image\//i.test(v);

function median(sorted) {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[idx];
}

(async () => {
  const file = path.resolve(INPUT);
  if (!fs.existsSync(file)) {
    console.error(`❌ No existe el export: ${file}\n   (node scripts/export-catalog-batch.js catalog-export.json)`);
    process.exit(2);
  }
  console.log(`📦 Leyendo ${file} ...`);
  const products = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(products)) {
    console.error('❌ Se esperaba un array de productos en el export.');
    process.exit(2);
  }

  const shortSides = [];
  const hashes = new Map();
  const byBrand = new Map();
  let withImage = 0;
  let placeholder = 0;
  let invalid = 0;
  let decodeFailed = 0;
  let payloadBytes = 0;

  for (const p of products) {
    const img = p && p.img;
    if (!img || img === '-') {
      placeholder++;
      continue;
    }
    if (!isDataUrl(img)) {
      invalid++;
      continue;
    }
    withImage++;
    const b64 = img.slice(img.indexOf(',') + 1);
    // Bytes reales del binario: 4/3 de la longitud base64, menos el padding.
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
    payloadBytes += Math.max(0, Math.floor((b64.length * 3) / 4) - pad);
    const hash = crypto.createHash('sha256').update(b64).digest('hex');
    hashes.set(hash, (hashes.get(hash) || 0) + 1);

    try {
      const im = await loadImage(img);
      const short = Math.min(im.width, im.height);
      shortSides.push(short);
      const brand = String(p.marca || 'OTRO').toLowerCase().trim();
      const agg = byBrand.get(brand) || { n: 0, sum: 0, under150: 0, min: Infinity };
      agg.n++;
      agg.sum += short;
      if (short < 150) agg.under150++;
      if (short < agg.min) agg.min = short;
      byBrand.set(brand, agg);
    } catch {
      decodeFailed++;
    }
  }

  shortSides.sort((a, b) => a - b);
  const n = shortSides.length;
  const avg = n ? Math.round((shortSides.reduce((s, v) => s + v, 0) / n) * 10) / 10 : 0;
  const under150 = shortSides.filter((v) => v < 150).length;
  const under300 = shortSides.filter((v) => v < 300).length;
  const pct = (c) => (n ? Math.round((c / n) * 1000) / 10 : 0);
  const duplicated = [...hashes.values()].filter((c) => c > 1).length;
  const dupUses = [...hashes.values()].filter((c) => c > 1).reduce((s, c) => s + c, 0);

  const report = {
    generatedAt: new Date().toISOString(),
    source: path.basename(file),
    products: products.length,
    withImage,
    placeholder,
    invalidImage: invalid,
    decodeFailed,
    measured: n,
    uniqueImages: hashes.size,
    duplicatedImages: duplicated,
    duplicatedUses: dupUses,
    shortSide: {
      avg,
      median: median(shortSides),
      min: shortSides[0] || 0,
      p10: percentile(shortSides, 0.1),
      p90: percentile(shortSides, 0.9),
      max: shortSides[n - 1] || 0,
    },
    under: {
      lt150: under150,
      lt150Pct: pct(under150),
      lt300: under300,
      lt300Pct: pct(under300),
      ge300Pct: pct(n - under300),
    },
    imagePayloadMB: Math.round((payloadBytes / 1024 / 1024) * 10) / 10,
    byBrand: [...byBrand.entries()]
      .map(([brand, a]) => ({
        brand,
        n: a.n,
        avg: Math.round((a.sum / a.n) * 10) / 10,
        min: a.min,
        under150Pct: Math.round((a.under150 / a.n) * 1000) / 10,
      }))
      .sort((x, y) => x.avg - y.avg),
  };

  const line = (k, v) => console.log(`  ${k.padEnd(34)} ${v}`);
  console.log(`\n🔬 BASELINE DE FOTOS (${report.source})`);
  line('productos', report.products);
  line('con imagen / placeholder / invalida', `${withImage} / ${placeholder} / ${invalid}`);
  line('medidas (decodificadas)', `${n}${decodeFailed ? ` (fallaron ${decodeFailed})` : ''}`);
  line('únicas / reutilizadas', `${report.uniqueImages} / ${duplicated} imgs en ${dupUses} usos`);
  line('lado menor: avg | mediana', `${avg} | ${report.shortSide.median}`);
  line('lado menor: min | p10 | p90 | max', `${report.shortSide.min} | ${report.shortSide.p10} | ${report.shortSide.p90} | ${report.shortSide.max}`);
  line('< 150px', `${under150} (${report.under.lt150Pct}%)`);
  line('< 300px', `${under300} (${report.under.lt300Pct}%)`);
  line('>= 300px', `${report.under.ge300Pct}%`);
  line('payload de imagenes', `${report.imagePayloadMB} MB`);
  console.log('\n  Peores marcas por lado menor promedio:');
  for (const b of report.byBrand.slice(0, 6)) {
    console.log(`    ${b.brand.padEnd(16)} avg ${String(b.avg).padStart(4)}  min ${String(b.min).padStart(4)}  <150px ${String(b.under150Pct).padStart(5)}%  n=${b.n}`);
  }

  if (OUT_JSON) {
    const out = path.resolve(OUT_JSON);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(`\n📄 Baseline escrito en ${out}`);
  }

  if (CHECK) {
    const fails = [];
    if (avg < MIN_AVG_SHORT) fails.push(`avg lado menor ${avg} < ${MIN_AVG_SHORT}`);
    if (pct(under150) > MAX_UNDER_150_PCT) fails.push(`<150px ${pct(under150)}% > ${MAX_UNDER_150_PCT}%`);
    if (fails.length) {
      console.error(`\n❌ CHECK FAILED: ${fails.join(' · ')}`);
      process.exit(1);
    }
    console.log(`\n✅ CHECK OK: avg ${avg} >= ${MIN_AVG_SHORT} · <150px ${pct(under150)}% <= ${MAX_UNDER_150_PCT}%`);
  }
})().catch((err) => {
  console.error(`💥 photo-baseline crashed: ${err && err.stack ? err.stack : err}`);
  process.exit(2);
});
