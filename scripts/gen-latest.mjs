#!/usr/bin/env node
// gen-latest.js — genera el latest.json (manifest del updater) para un release
// ya publicado con assets, embebiendo las FIRMAS REALES (.sig) de cada artefacto.
//
// Uso: node scripts/gen-latest.js v2.2.24 > latest.json
//      node scripts/gen-latest.js v2.2.24 -o latest.json
//      GH_REPO=getodevel-source/mambo-pedidos (default ok)
//
// Toma como base de targets el latest.json del release ANTERIOR con assets
// (misma familia de artefactos) y resuelve cada URL/signature contra el release
// nuevo por nombre de asset. Falla (exit != 0) si algún target no tiene asset o
// su .sig no responde 200. Después: gh release upload <tag> latest.json --clobber.
import { writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

const REPO = process.env.GH_REPO || 'getodevel-source/mambo-pedidos';
const tag = process.argv[2];
if (!tag || !/^v\d+\.\d+\.\d+$/.test(tag)) {
  console.error('Uso: node scripts/gen-latest.js vX.Y.Z [-o latest.json]');
  process.exit(2);
}
let outPath = null;
const ai = process.argv.indexOf('-o');
if (ai !== -1) outPath = process.argv[ai + 1];

const gh = (args) => {
  const out = execFileSync('gh', ['api', `repos/${REPO}/releases/tags/${tag}`, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out);
};

// 1) assets del release nuevo
const release = gh(['--jq', '{ tag_name, assets: [.assets[] | { name, url, size }] }']);
const byName = new Map(release.assets.map((a) => [a.name, a]));
console.error(`📦 release ${release.tag_name}: ${release.assets.length} assets`);
if (!release.assets.length) {
  console.error('❌ sin assets todavía — esperá a que termine el build y re-corré');
  process.exit(1);
}

// 2) base de targets: el latest.json del release ANTERIOR con assets
const prev = await fetch(`https://github.com/${REPO}/releases/latest/download/latest.json`)
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
if (!prev || !prev.platforms) {
  console.error('❌ no hay latest.json previo con platforms para tomar de base');
  process.exit(1);
}
console.error(`🔁 targets base del release previo (v${prev.version})`);

// 3) resolver cada target contra el release nuevo: mismo nombre de asset
// (la versión cambia solo en el tag de la URL), .sig embebido desde el asset .sig.
const platforms = {};
for (const [plat, info] of Object.entries(prev.platforms)) {
  const oldUrl = String(info.url || '');
  const fileName = oldUrl.split('/').pop();
  if (!fileName) {
    console.error(`  ⚠️ ${plat}: sin nombre de asset en URL previa — se omite`);
    continue;
  }
  const asset = byName.get(fileName);
  if (!asset) {
    console.error(`  ❌ ${plat}: no existe asset "${fileName}" en ${tag}`);
    process.exit(1);
  }
  const sigName = `${fileName}.sig`;
  const sigAsset = byName.get(sigName);
  if (!sigAsset) {
    console.error(`  ❌ ${plat}: no existe "${sigName}" en ${tag}`);
    process.exit(1);
  }
  const sig = Buffer.from(
    gh(['--jq', `.assets[] | select(.name=="${sigName}") | .content`]),
    'base64',
  ).toString('utf8').trim();
  platforms[plat] = {
    signature: sig,
    url: `https://github.com/${REPO}/releases/download/${tag}/${fileName}`,
  };
  console.error(`  ✅ ${plat} ← ${fileName} (sig ${sig.length} chars)`);
}

const manifest = {
  version: tag.replace(/^v/, ''),
  notes: release.tag_name,
  pub_date: new Date().toISOString(),
  platforms,
};
const out = `${JSON.stringify(manifest, null, 2)}\n`;
if (outPath) {
  writeFileSync(outPath, out);
  console.error(`📄 latest.json escrito en ${outPath} (${out.length} bytes)`);
} else {
  process.stdout.write(out);
}
// 4) validación local básica: URLs 200
const bad = [];
for (const [plat, info] of Object.entries(platforms)) {
  try {
    const r = await fetch(info.url, { method: 'HEAD' });
    if (r.status !== 200) bad.push(`${plat}: HTTP ${r.status}`);
  } catch (e) {
    bad.push(`${plat}: ${e.message}`);
  }
}
if (bad.length) {
  console.error(`❌ URLs que no responden 200: ${bad.join(' | ')}`);
  process.exit(1);
}
console.error('✅ todas las URLs responden 200');