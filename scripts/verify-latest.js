#!/usr/bin/env node
/**
 * verify-latest.js — valida el latest.json publicado de un release.
 *
 * Uso: node scripts/verify-latest.js [tag]   (default: último release)
 *   GH_REPO=getodevel-source/mambo-pedidos
 *
 * Falla (exit != 0) si: el JSON no existe/parsea, la versión no coincide con
 * el tag, faltan plataformas, las URLs son placeholders, alguna URL devuelve
 * algo distinto de 200, o la firma .sig de una URL no responde 200.
 */

const REPO = process.env.GH_REPO || 'getodevel-source/mambo-pedidos';
const tag = process.argv[2];
const BASE = `https://github.com/${REPO}/releases`;
const API = `https://api.github.com/repos/${REPO}`;

const REQUIRED = ['windows-x86_64', 'darwin-aarch64', 'linux-x86_64'];
const PLACEHOLDER = /placeholder|CHANGE_ME|example\.com|\burldel\b/i;

const failures = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const fail = (m) => { failures.push(m); console.log(`  ❌ ${m}`); };

async function getJSON(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function head200(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.status;
  } catch { return 0; }
}

async function main() {
  const releaseTag = tag || (await getJSON(`${API}/releases/latest`)).tag_name;
  await getJSON(`${API}/releases/tags/${releaseTag}`);
  ok(`release ${releaseTag} encontrado`);

  // latest.json entre los assets (puede no estar en assets y servirse por URL directa)
  let latest;
  try {
    latest = await getJSON(`${BASE}/download/${releaseTag}/latest.json`);
  } catch {
    // si no es un asset, quizás se sirve como archivo suelto: intentar directo
    throw new Error(`latest.json no disponible en el release ${releaseTag}`);
  }
  ok('latest.json presente');

  const norm = releaseTag.replace(/^v/, '');
  if (String(latest.version) !== norm) fail(`version == tag (got ${latest.version}, esperado ${norm})`);
  else ok(`version ${latest.version} == ${norm}`);

  const platforms = latest.platforms || {};
  for (const p of REQUIRED) {
    const entry = platforms[p];
    if (!entry) { fail(`plataforma ${p} presente`); continue; }
    ok(`plataforma ${p} presente`);
    const entries = Array.isArray(entry) ? entry
      : typeof entry === 'string' ? [{ url: entry }]
      : entry.url ? [entry] : Object.values(entry);
    for (const e of entries) {
      const u = typeof e === 'string' ? e : e.url;
      const sigField = typeof e === 'object' && e ? e.signature : null;
      if (!u || PLACEHOLDER.test(u)) { fail(`URL no-placeholder en ${p}: ${u}`); continue; }
      const st = await head200(u);
      if (st !== 200) fail(`URL 200 en ${p}: ${st} ${u}`);
      else ok(`URL 200 en ${p}`);
      const sig = `${u}.sig`;
      const stSig = await head200(sig);
      if (stSig !== 200) fail(`firma .sig 200 en ${p}: ${stSig} ${sig}`);
      else ok(`firma .sig 200 en ${p}`);
      if (sigField) ok(`signature embebida en latest.json (${String(sigField).slice(0, 16)}...)`);
      else fail(`latest.json ${p}: campo signature ausente`);
    }
  }

  console.log(failures.length === 0
    ? `\n✅ verify-latest OK — release ${releaseTag} actualizable en todas las plataformas`
    : `\n❌ ${failures.length} fallos en ${releaseTag}`);
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });