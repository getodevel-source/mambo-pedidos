// ============================================
//  Mambo Pedidos - Módulo de Validaciones de Datos
// ============================================

const Validations = {
  validateField(field, value) {
    if (field === 'sku') {
      const val = String(value || '').trim();
      const valid = /^[A-Z0-9_-]+$/i.test(val);
      return { valid, value: val, error: valid ? null : 'SKU contiene caracteres inválidos' };
    }
    if (field === 'fob') {
      const str = String(value || '').replace(',', '.');
      const num = parseFloat(str);
      const valid = !isNaN(num) && num > 0 && num <= 5000;
      return { valid, value: num, error: valid ? null : 'FOB debe ser mayor a 0 y menor a 5000 USD' };
    }
    return { valid: true, value };
  },

  validateOrder(order) {
    const errors = [];
    if (!order || !order.items || !order.items.length) {
      errors.push('El pedido no contiene ítems');
    }
    return { valid: errors.length === 0, errors };
  }
};

window.Validations = Validations;
