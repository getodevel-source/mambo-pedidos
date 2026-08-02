#!/usr/bin/env node
/**
 * Per-row ground-truth crops, sliced from the already-rendered full-page PNGs
 * (fast: no PDF re-render). Uses manifest x/y (PDF points, top-left origin) and
 * the page PNG scale (1.7) used by ground-truth.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const GT = path.join(__dirname, '..', 'ground-truth');
const OUT_DIR = path.join(GT, 'crops');
const PAGE_SCALE = 1.7;
const HALF_PTS = 44;

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(path.join(GT, 'manifest.json'), 'utf8'));
  const band = Math.floor(HALF_PTS * PAGE_SCALE);

  // cache loaded page images
  const pageImg = new Map();
  async function getPage(file) {
    if (!pageImg.has(file)) pageImg.set(file, await loadImage(path.join(GT, file)));
    return pageImg.get(file);
  }

  let done = 0;
  for (const it of manifest) {
    if (!it.markerFile) continue;
    const img = await getPage(it.markerFile);
    const cy = Math.round(it.y * PAGE_SCALE);
    const top = Math.max(0, cy - band);
    const h = Math.min(img.height - top, band * 2);
    if (h <= 0) continue;
    const crop = createCanvas(img.width, h);
    crop.getContext('2d').drawImage(img, 0, top, img.width, h, 0, 0, img.width, h);
    const file = `crop_${String(it.id).padStart(3, '0')}.png`;
    fs.writeFileSync(path.join(OUT_DIR, file), crop.toBuffer('image/png'));
    it.cropFile = file;
    done++;
  }
  fs.writeFileSync(path.join(GT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('✅ crops:', done, '→', OUT_DIR);
}
main().catch(e => { console.error('crash', e); process.exit(1); });
