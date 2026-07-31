// ============================================
// Mambo Pedidos - Identidad Global de SKU
// ============================================

const SkuAllocator = {
  normalizeSku(value) {
    return String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  },

  identityKey(item = {}) {
    const clean = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
    return [clean(item.marca), clean(item.modelo), clean(item.variante || item.color), clean(item.cat)].join('|');
  },

  hash(value) {
    let hash = 2166136261;
    for (const char of String(value)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  },

  generatedSku(item, salt = '') {
    const brand = this.normalizeSku(item.marca || 'NEW').substring(0, 3) || 'NEW';
    const cat = this.normalizeSku(item.cat || 'OTRO').substring(0, 3) || 'OTR';
    const identity = `${this.identityKey(item)}|${salt}`;
    return `${brand}-${cat}-${this.hash(identity)}`.substring(0, 50);
  },

  allocateBatch(items = [], existing = []) {
    if (!Array.isArray(items)) return [];

    const used = new Set();
    const identityToSku = new Map();
    const skuToIdentity = new Map();

    for (const item of Array.isArray(existing) ? existing : []) {
      const sku = this.normalizeSku(item && item.sku);
      if (!sku) continue;
      const identity = this.identityKey(item);
      used.add(sku);
      skuToIdentity.set(sku, identity);
      if (identity && !identityToSku.has(identity)) identityToSku.set(identity, item.sku.trim());
    }

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const identity = this.identityKey(item);
      const sourceSku = this.normalizeSku(item.sku);
      const knownSku = identityToSku.get(identity);
      let assignedSku = knownSku || '';
      let collision = false;

      if (!assignedSku && sourceSku) {
        const owner = skuToIdentity.get(sourceSku);
        if (!used.has(sourceSku) || owner === identity) {
          assignedSku = sourceSku;
        } else {
          collision = true;
        }
      }

      if (!assignedSku) {
        let salt = '';
        assignedSku = this.generatedSku(item, salt);
        while (used.has(assignedSku) && skuToIdentity.get(assignedSku) !== identity) {
          salt = `${salt || '#'}${this.hash(`${identity}|${salt}`).substring(0, 4)}`;
          assignedSku = this.generatedSku(item, salt);
        }
      }

      item.sku = assignedSku;
      used.add(assignedSku);
      skuToIdentity.set(assignedSku, identity);
      if (identity && !identityToSku.has(identity)) identityToSku.set(identity, assignedSku);

      if (collision) {
        item.skuCollision = { sourceSku, assignedSku };
        const warnings = Array.isArray(item.warnings) ? item.warnings : [];
        const warning = `SKU de origen ${sourceSku} colisionó con otro producto; se asignó ${assignedSku} sin sobrescribirlo`;
        if (!warnings.includes(warning)) warnings.push(warning);
        item.warnings = warnings;
        item.sourceWarnings = [...new Set([...(item.sourceWarnings || []), warning])];
      }
    }

    return items;
  },

  isEquivalent(a, b) {
    return this.identityKey(a) === this.identityKey(b);
  },

  // ── Slice 6: SKU Audit & Durable Mapping ──

  /**
   * Read-only SKU audit across catalog, history, and selection.
   * @param {Object} opts - { catalog: [], history: [], selection: {} }
   * @returns {Object} { missing: [], duplicates: [], collisions: [], legacy: [], summary: {} }
   */
  auditSkus(opts) {
    const { catalog = [], history = [], selection = {} } = opts || {};
    const audit = { missing: [], duplicates: [], collisions: [], legacy: [], summary: {} };

    const skuCounts = new Map();
    const identityCounts = new Map();
    const catalogSkus = new Set();

    for (const item of catalog) {
      const sku = this.normalizeSku(item.sku);
      const identity = this.identityKey(item);
      if (!sku) {
        audit.missing.push({ domain: 'catalog', identity, reason: 'Empty SKU' });
        continue;
      }
      catalogSkus.add(sku);
      skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
      identityCounts.set(identity, (identityCounts.get(identity) || 0) + 1);
    }

    // Duplicates: same SKU used by multiple rows
    for (const [sku, count] of skuCounts) {
      if (count > 1) {
        audit.duplicates.push({ sku, count, domain: 'catalog' });
      }
    }

    // Collisions: different identities sharing a SKU prefix pattern
    const prefixMap = new Map();
    for (const item of catalog) {
      const sku = this.normalizeSku(item.sku);
      if (!sku) continue;
      const prefix = sku.split('-').slice(0, 2).join('-');
      if (!prefixMap.has(prefix)) prefixMap.set(prefix, new Set());
      prefixMap.get(prefix).add(this.identityKey(item));
    }
    for (const [prefix, identities] of prefixMap) {
      if (identities.size > 1) {
        audit.collisions.push({ prefix, identityCount: identities.size });
      }
    }

    // Legacy: SKUs that don't match the current generated pattern
    const GENERATED_RE = /^[A-Z]{2,3}-[A-Z]{2,3}-[0-9A-F]{8}$/;
    for (const item of catalog) {
      const sku = this.normalizeSku(item.sku);
      if (sku && !GENERATED_RE.test(sku)) {
        audit.legacy.push({ sku, identity: this.identityKey(item), domain: 'catalog' });
      }
    }

    // History references not in catalog
    const historySkus = new Set();
    for (const entry of history) {
      const items = entry.items || entry;
      if (Array.isArray(items)) {
        for (const item of items) {
          const sku = this.normalizeSku(item.sku);
          if (sku) historySkus.add(sku);
        }
      }
    }
    const orphanedHistory = [...historySkus].filter(s => !catalogSkus.has(s));

    // Selection references not in catalog
    const selectionSkus = Object.keys(selection || {}).map(s => this.normalizeSku(s)).filter(Boolean);
    const orphanedSelection = selectionSkus.filter(s => !catalogSkus.has(s));

    audit.summary = {
      catalogRows: catalog.length,
      historyEntries: history.length,
      selectionKeys: selectionSkus.length,
      missing: audit.missing.length,
      duplicates: audit.duplicates.length,
      collisions: audit.collisions.length,
      legacy: audit.legacy.length,
      orphanedHistory: orphanedHistory.length,
      orphanedSelection: orphanedSelection.length
    };
    audit.orphanedHistory = orphanedHistory;
    audit.orphanedSelection = orphanedSelection;
    return audit;
  },

  /**
   * Build a deterministic SKU mapping from an audit.
   * @param {Array} catalog - Catalog items
   * @param {Object} audit - Result of auditSkus
   * @returns {Object} { mappings: [], ambiguous: [], receipt: {} }
   */
  buildSkuMapping(catalog, audit) {
    const mappings = [];
    const ambiguous = [];
    const usedSkus = new Set();

    for (const item of catalog) {
      const oldSku = this.normalizeSku(item.sku);
      const identity = this.identityKey(item);

      if (!oldSku) {
        // Missing SKU: generate one
        const newSku = this.generatedSku(item);
        mappings.push({ rowIdentity: identity, oldSku: null, newSku, action: 'generated' });
        usedSkus.add(newSku);
        continue;
      }

      if (usedSkus.has(oldSku)) {
        // Duplicate SKU: generate a distinct one
        let salt = '';
        let newSku = this.generatedSku(item, salt);
        while (usedSkus.has(newSku)) {
          salt = `${salt || '#'}${this.hash(`${identity}|${salt}`).substring(0, 4)}`;
          newSku = this.generatedSku(item, salt);
        }
        mappings.push({ rowIdentity: identity, oldSku, newSku, action: 'deduplicated' });
        usedSkus.add(newSku);
        continue;
      }

      // Keep existing SKU
      mappings.push({ rowIdentity: identity, oldSku, newSku: oldSku, action: 'preserved' });
      usedSkus.add(oldSku);
    }

    // Check for ambiguous history/selection references
    const catalogSkus = new Set(catalog.map(i => this.normalizeSku(i.sku)).filter(Boolean));
    for (const orphan of (audit.orphanedHistory || [])) {
      ambiguous.push({ sku: orphan, domain: 'history', reason: 'Not found in catalog' });
    }
    for (const orphan of (audit.orphanedSelection || [])) {
      ambiguous.push({ sku: orphan, domain: 'selection', reason: 'Not found in catalog' });
    }

    const receipt = {
      schema: 'sku-mapping-v1',
      inputIdentity: `sku-audit:${catalog.length}rows:${audit.summary.missing}missing:${audit.summary.duplicates}dup`,
      counts: {
        total: mappings.length,
        preserved: mappings.filter(m => m.action === 'preserved').length,
        generated: mappings.filter(m => m.action === 'generated').length,
        deduplicated: mappings.filter(m => m.action === 'deduplicated').length,
        ambiguous: ambiguous.length
      },
      mappings,
      committed: false
    };

    return { mappings, ambiguous, receipt };
  },

  /**
   * Check if migration is blocked by ambiguous references.
   * @param {Array} ambiguous - From buildSkuMapping
   * @returns {{ blocked: boolean, reason: string }}
   */
  checkAmbiguityGate(ambiguous) {
    if (!ambiguous || ambiguous.length === 0) {
      return { blocked: false, reason: 'No ambiguous references' };
    }
    return {
      blocked: true,
      reason: `${ambiguous.length} ambiguous reference(s) require resolution: ${ambiguous.map(a => `${a.domain}:${a.sku}`).join(', ')}`
    };
  }
};

if (typeof window !== 'undefined') window.SkuAllocator = SkuAllocator;
if (typeof module !== 'undefined') module.exports = SkuAllocator;
