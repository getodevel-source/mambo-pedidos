// ============================================
// Mambo Pedidos - NCM Database (IT22/IT23)
// Carga la base completa de NCM (ARCA/AFIP), busca por código/texto y
// autoclasifica un producto a su NCM por superposición de palabras.
// ============================================

const NcmDatabase = {
  _db: null,
  _index: null, // token -> Set de índices de registros
  _glossary: null, // supplier-token -> [tokens de descripción NCM] (src/data/ncmGlossary.json)
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
    const recs = (NcmDatabase._db.registros || []);
    recs.forEach((r, i) => {
      const tokens = NcmDatabase._tokenize(NcmDatabase._normalizeDesc(r.desc || '') + ' ' + r.ncm);
      tokens.forEach(t => {
        if (!NcmDatabase._index.has(t)) NcmDatabase._index.set(t, new Set());
        NcmDatabase._index.get(t).add(i);
      });
    });
    // IDF: rare tokens weigh more. log(N/df), N = record count, df = records with token.
    NcmDatabase._idf = new Map();
    const n = Math.max(recs.length, 1);
    NcmDatabase._index.forEach((hits, t) => {
      NcmDatabase._idf.set(t, Math.log(n / hits.size));
    });
  },

  // Peso IDF de un token (0 si ausente del índice).
  _idfOf(t) {
    if (!NcmDatabase._idf) return 1;
    return NcmDatabase._idf.get(t) || 0;
  },

  _tokenize(s) {
    return String(s || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/).filter(w => w.length > 2);
  },

  // Normalización de descripciones con corrupción `?` (sustitución lossy de
  // latín-1 → ASCII en la fuente ARCA: 4015/10504 registros). El `?` no es
  // recuperable a byte-exacto (vocal original ambigua), así que se trata
  // como separador —idéntico a lo que ya hacía _tokenize—, solo que explícito
  // y testeable. NO inventa texto.
  _normalizeDesc(s) {
    return String(s || '').replace(/\?/g, ' ');
  },

  // Inyecta el glosario ES/EN (objeto { entries: { token: [expansion...] } }).
  // En la app se carga vía fetch; en tests vía require directo del JSON.
  setGlossary(g) {
    NcmDatabase._glossary = (g && g.entries) || null;
  },

  // Expansión de query: por cada token con entrada en el glosario agrega los
  // tokens de vocabulario NCM. Scoring idéntico al overlap existente (+1 por
  // token). Sin glosario cargado, devuelve los tokens sin cambios.
  _expandTokens(tokens) {
    if (!NcmDatabase._glossary) return tokens;
    const out = tokens.slice();
    tokens.forEach(t => {
      const vs = NcmDatabase._glossary[t];
      if (vs) vs.forEach(v => { if (out.indexOf(v) === -1) out.push(v); });
    });
    return out;
  },

  // Lookup por código NCM exacto (con o sin puntos).
  byCode(code) {
    if (!NcmDatabase._db) NcmDatabase.load();
    const norm = String(code || '').replace(/[.\s]/g, '');
    return (NcmDatabase._db.registros || []).find(r => r.ncm.replace(/[.\s]/g, '') === norm);
  },

  // Búsqueda por texto sobre las descripciones (top-K). Scoring IDF:
  // cada token aporta log(N/df) en vez de +1 plano — tokens raros
  // ('teclados', 'auriculares') pesan más que genéricos ('white', 'black').
  search(query, k = 8) {
    if (!NcmDatabase._db) NcmDatabase.load();
    if (!NcmDatabase._index) NcmDatabase._buildIndex();
    const tokens = NcmDatabase._expandTokens(NcmDatabase._tokenize(query));
    if (!tokens.length) return [];
    const scores = new Map();
    tokens.forEach(t => {
      const hits = NcmDatabase._index.get(t);
      if (hits) hits.forEach(i => scores.set(i, (scores.get(i) || 0) + NcmDatabase._idfOf(t)));
    });
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([i, score]) => Object.assign({ score }, NcmDatabase._db.registros[i]));
  },

};

if (typeof window !== 'undefined') window.NcmDatabase = NcmDatabase;
if (typeof module !== 'undefined') module.exports = NcmDatabase;
