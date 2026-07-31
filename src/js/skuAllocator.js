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
  }
};

if (typeof window !== 'undefined') window.SkuAllocator = SkuAllocator;
if (typeof module !== 'undefined') module.exports = SkuAllocator;
