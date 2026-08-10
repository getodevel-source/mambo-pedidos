// ============================================
//  Mambo Pedidos - Módulo de Validaciones de Datos
//  Validación estricta de TODOS los inputs + Categorías Dinámicas
// ============================================

const Validations = {
  rules: {
    sku: {
      required: true,
      maxLength: 50,
      pattern: /^[A-Z0-9_-]+$/i,
      message: 'SKU debe tener solo letras, números, guiones y guiones bajos (max 50)'
    },
    marca: {
      required: true,
      maxLength: 50,
      minLength: 1,
      message: 'Marca es obligatoria (1-50 chars)'
    },
    modelo: {
      required: true,
      maxLength: 200,
      minLength: 1,
      message: 'Modelo es obligatorio (1-200 chars)'
    },
    categoria: {
      required: true,
      maxLength: 50,
      message: 'Categoría es obligatoria'
    },
    fob: {
      required: true,
      min: 0.01,
      max: 5000,
      type: 'number',
      message: 'FOB debe estar entre $0.01 y $5000'
    },
    qty: {
      required: true,
      min: 1,
      max: 9999,
      integer: true,
      type: 'number',
      message: 'Cantidad debe ser entero entre 1 y 9999'
    },
    color: {
      maxLength: 100,
      message: 'Color max 100 chars'
    }
  },

  validCategories: ['TECLADO', 'MOUSE', 'MOUSEPAD', 'HEADSET', 'AURICULAR', 'CONTROLLER', 'SWITCH', 'CAMARA', 'CUIDADO_PERSONAL', 'MONITOR', 'SILLA', 'WEBCAM', 'ACCESORIO', 'OTRO'],

  addCategory(categoryName) {
    if (!categoryName) return;
    const cat = categoryName.toString().trim().toUpperCase();
    if (cat && !this.validCategories.includes(cat)) {
      this.validCategories.push(cat);
    }
  },

  validateField(field, value) {
    const rule = this.rules[field];
    if (!rule) return { valid: true, value };

    if (rule.required && (value === '' || value === null || value === undefined)) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    if (value === '' || value === null || value === undefined) {
      return { valid: true, value };
    }

    const strValue = String(value);
    const trimmed = strValue.trim();

    if (rule.maxLength && trimmed.length > rule.maxLength) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    if (rule.minLength && trimmed.length < rule.minLength) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    if (rule.pattern && !rule.pattern.test(trimmed)) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    if (rule.type === 'number') {
      const num = parseFloat(trimmed.replace(',', '.'));
      if (isNaN(num)) {
        return { valid: false, error: 'Debe ser un número válido', severity: 'error' };
      }
      if (rule.min !== undefined && num < rule.min) {
        return { valid: false, error: `Mínimo: ${rule.min}`, severity: 'error' };
      }
      if (rule.max !== undefined && num > rule.max) {
        return { valid: false, error: `Máximo: ${rule.max}`, severity: 'error' };
      }
      if (rule.integer && !Number.isInteger(num)) {
        return { valid: false, error: 'Debe ser un número entero', severity: 'error' };
      }
      return { valid: true, value: num, parsed: true };
    }

    return { valid: true, value: trimmed };
  },

  validateProduct(product) {
    const errors = [];
    const warnings = [];

    const skuCheck = this.validateField('sku', product.sku);
    if (!skuCheck.valid) errors.push({ field: 'sku', message: skuCheck.error });

    if (product._checkDuplicateSku && product._checkDuplicateSku(product.sku)) {
      errors.push({ field: 'sku', message: 'SKU duplicado' });
    }

    const marcaCheck = this.validateField('marca', product.marca);
    if (!marcaCheck.valid) errors.push({ field: 'marca', message: marcaCheck.error });

    const modeloCheck = this.validateField('modelo', product.modelo);
    if (!modeloCheck.valid) errors.push({ field: 'modelo', message: modeloCheck.error });

    const catCheck = this.validateField('categoria', product.cat);
    if (!catCheck.valid) {
      errors.push({ field: 'cat', message: catCheck.error });
    } else {
      const upperCat = (product.cat || '').toString().trim().toUpperCase();
      if (!this.validCategories.includes(upperCat)) {
        this.addCategory(upperCat);
      }
    }

    const fobCheck = this.validateField('fob', product.fob);
    if (!fobCheck.valid) {
      errors.push({ field: 'fob', message: fobCheck.error });
    } else {
      if (product.fob < 1) warnings.push({ field: 'fob', message: 'FOB muy bajo (<$1)' });
      if (product.fob > 500) warnings.push({ field: 'fob', message: 'FOB alto (>$500), verificá' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  validateOrder(order) {
    const errors = [];
    const warnings = [];

    if (!order || !order.items || order.items.length === 0) {
      errors.push({ field: 'items', message: 'El pedido no tiene items' });
      return { valid: false, errors, warnings };
    }

    const seen = new Set();
    order.items.forEach((item, idx) => {
      const product = this.validateProduct(item);
      product.errors.forEach(e => {
        errors.push({ field: `items[${idx}].${e.field}`, message: `#${idx + 1} ${e.message}` });
      });
      product.warnings.forEach(w => {
        warnings.push({ field: `items[${idx}].${w.field}`, message: `#${idx + 1} ${w.message}` });
      });

      if (seen.has(item.sku)) {
        errors.push({ field: `items[${idx}]`, message: `SKU duplicado: ${item.sku}` });
      }
      seen.add(item.sku);

      const qtyCheck = this.validateField('qty', item.qty);
      if (!qtyCheck.valid) {
        errors.push({ field: `items[${idx}].qty`, message: `#${idx + 1} ${qtyCheck.error}` });
      }
    });

    const totalFob = order.items.reduce((s, i) => s + (i.fob || 0) * (i.qty || 0), 0);
    if (totalFob <= 0) errors.push({ field: 'total', message: 'Total FOB debe ser > 0' });
    if (totalFob > 100000) warnings.push({ field: 'total', message: 'Total FOB muy alto (>$100,000), verificá' });

    return { valid: errors.length === 0, errors, warnings };
  }
};

if (typeof window !== 'undefined') window.Validations = Validations;
if (typeof module !== 'undefined') module.exports = Validations;

