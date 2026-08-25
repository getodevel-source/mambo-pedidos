// ============================================
// Mambo Pedidos - NCM Database (IT22/IT23)
// Carga la base completa de NCM (ARCA/AFIP), busca por código/texto y
// autoclasifica un producto a su NCM por superposición de palabras.
// ============================================

const NcmDatabase = {
  _db: null,
  _index: null, // token -> Set de índices de registros
  CACHE_KEY: 'mamboNcmDb',

  // Carga la base (desde localStorage si está cacheada, si no de window.NCM_DB).
  load() {
    if (NcmDatabase._db) return NcmDatabase._db;
    try {
      const cached = localStorage.getItem(NcmDatabase.CACHE_KEY);
      if (cached) { NcmDatabase._db = JSON.parse(cached); NcmDatabase._buildIndex(); return NcmDatabase._db; }
    } catch (e) {}
    if (typeof window !== 'undefined' && window.NCM_DB && window.NCM_DB.registros) {
      NcmDatabase._db = window.NCM_DB;
      NcmDatabase._buildIndex();
      try { localStorage.setItem(NcmDatabase.CACHE_KEY, JSON.stringify(NcmDatabase._db)); } catch (e) {}
      return NcmDatabase._db;
    }
    return null;
  },

  // Fallback: intenta fetch del archivo (Tauri asset protocol).
  async loadFromFile() {
    try {
      const res = await fetch('data/ncmDatabase.json');
      const db = await res.json();
      NcmDatabase._db = db;
      NcmDatabase._buildIndex();
      try { localStorage.setItem(NcmDatabase.CACHE_KEY, JSON.stringify(db)); } catch (e) {}
      return db;
    } catch (e) { return null; }
  },

  _buildIndex() {
    NcmDatabase._index = new Map();
    (NcmDatabase._db.registros || []).forEach((r, i) => {
      const tokens = NcmDatabase._tokenize((r.desc || '') + ' ' + r.ncm);
      tokens.forEach(t => {
        if (!NcmDatabase._index.has(t)) NcmDatabase._index.set(t, new Set());
        NcmDatabase._index.get(t).add(i);
      });
    });
  },

  _tokenize(s) {
    return String(s || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2);
  },

  // Lookup por código NCM exacto (con o sin puntos).
  byCode(code) {
    if (!NcmDatabase._db) NcmDatabase.load();
    const norm = String(code || '').replace(/[.\s]/g, '');
    return (NcmDatabase._db.registros || []).find(r => r.ncm.replace(/[.\s]/g, '') === norm);
  },

  // Búsqueda por texto sobre las descripciones (top-K).
  search(query, k = 8) {
    if (!NcmDatabase._db) NcmDatabase.load();
    if (!NcmDatabase._index) NcmDatabase._buildIndex();
    const tokens = NcmDatabase._tokenize(query);
    if (!tokens.length) return [];
    const scores = new Map();
    tokens.forEach(t => {
      const hits = NcmDatabase._index.get(t);
      if (hits) hits.forEach(i => scores.set(i, (scores.get(i) || 0) + 1));
    });
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([i, score]) => Object.assign({ score }, NcmDatabase._db.registros[i]));
  },

};

if (typeof window !== 'undefined') window.NcmDatabase = NcmDatabase;
if (typeof module !== 'undefined') module.exports = NcmDatabase;