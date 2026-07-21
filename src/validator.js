// ============================================
//  Mambo Pedidos - Sistema de Validaciones
//  Validación estricta de TODOS los inputs
// ============================================

const Validations = {
  // Reglas de validación
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
      max: 500,
      type: 'number',
      message: 'FOB debe estar entre $0.01 y $500'
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

  // Categorías válidas
  validCategories: ['TECLADO', 'MOUSE', 'MOUSEPAD', 'HEADSET', 'CONTROLLER', 'SWITCH', 'AUDIO', 'OTRO'],

  // Validar un campo individual
  validateField(field, value) {
    const rule = this.rules[field];
    if (!rule) return { valid: true, value };

    // Required
    if (rule.required && (value === '' || value === null || value === undefined)) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    // Si está vacío y no es required, ok
    if (value === '' || value === null || value === undefined) {
      return { valid: true, value };
    }

    const strValue = String(value);
    const trimmed = strValue.trim();

    // Max length
    if (rule.maxLength && trimmed.length > rule.maxLength) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    // Min length
    if (rule.minLength && trimmed.length < rule.minLength) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    // Pattern
    if (rule.pattern && !rule.pattern.test(trimmed)) {
      return { valid: false, error: rule.message, severity: 'error' };
    }

    // Number
    if (rule.type === 'number') {
      const num = parseFloat(trimmed);
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

  // Validar un producto completo
  validateProduct(product) {
    const errors = [];
    const warnings = [];

    // SKU
    const skuCheck = this.validateField('sku', product.sku);
    if (!skuCheck.valid) errors.push({ field: 'sku', message: skuCheck.error });

    // SKU duplicado (chequear contra el catálogo)
    if (product._checkDuplicateSku && product._checkDuplicateSku(product.sku)) {
      errors.push({ field: 'sku', message: 'SKU duplicado' });
    }

    // Marca
    const marcaCheck = this.validateField('marca', product.marca);
    if (!marcaCheck.valid) errors.push({ field: 'marca', message: marcaCheck.error });

    // Modelo
    const modeloCheck = this.validateField('modelo', product.modelo);
    if (!modeloCheck.valid) errors.push({ field: 'modelo', message: modeloCheck.error });

    // Categoría
    const catCheck = this.validateField('categoria', product.cat);
    if (!catCheck.valid) {
      errors.push({ field: 'cat', message: catCheck.error });
    } else if (!this.validCategories.includes(product.cat)) {
      warnings.push({ field: 'cat', message: 'Categoría no estándar: ' + product.cat });
    }

    // FOB
    const fobCheck = this.validateField('fob', product.fob);
    if (!fobCheck.valid) {
      errors.push({ field: 'fob', message: fobCheck.error });
    } else {
      // Warnings de precio
      if (product.fob < 1) warnings.push({ field: 'fob', message: 'FOB muy bajo (<$1)' });
      if (product.fob > 200) warnings.push({ field: 'fob', message: 'FOB alto (>$200), verificá' });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  },

  // Validar un pedido completo
  validateOrder(order) {
    const errors = [];
    const warnings = [];

    if (!order.items || order.items.length === 0) {
      errors.push({ field: 'items', message: 'El pedido no tiene items' });
      return { valid: false, errors, warnings };
    }

    // Verificar que todos los items sean válidos
    const seen = new Set();
    order.items.forEach((item, idx) => {
      const product = this.validateProduct(item);
      product.errors.forEach(e => {
        errors.push({ field: `items[${idx}].${e.field}`, message: `#${idx + 1} ${e.message}` });
      });
      product.warnings.forEach(w => {
        warnings.push({ field: `items[${idx}].${w.field}`, message: `#${idx + 1} ${w.message}` });
      });

      // SKUs duplicados
      if (seen.has(item.sku)) {
        errors.push({ field: `items[${idx}]`, message: `SKU duplicado: ${item.sku}` });
      }
      seen.add(item.sku);

      // Validar cantidad
      const qtyCheck = this.validateField('qty', item.qty);
      if (!qtyCheck.valid) {
        errors.push({ field: `items[${idx}].qty`, message: `#${idx + 1} ${qtyCheck.error}` });
      }
    });

    // Verificar coherencia
    const totalFob = order.items.reduce((s, i) => s + (i.fob || 0) * (i.qty || 0), 0);
    if (totalFob <= 0) errors.push({ field: 'total', message: 'Total FOB debe ser > 0' });
    if (totalFob > 50000) warnings.push({ field: 'total', message: 'Total FOB muy alto (>$50,000), verificá' });

    return { valid: errors.length === 0, errors, warnings };
  },

  // Validar y sanitizar input en tiempo real
  sanitizeInput(field, value) {
    const rule = this.rules[field];
    if (!rule) return value;
    let v = String(value || '');

    if (field === 'sku') {
      v = v.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    }
    if (field === 'fob') {
      v = v.replace(/[^0-9.]/g, '');
    }
    if (field === 'qty') {
      v = v.replace(/[^0-9]/g, '');
    }
    if (rule.maxLength && v.length > rule.maxLength) {
      v = v.substring(0, rule.maxLength);
    }
    return v;
  }
};

// Exportar globalmente para que esté disponible en toda la app
window.Validations = Validations;
