// ============================================
//  Mambo Pedidos - Módulo de Importación y Exportación de Archivos (CSV / Excel)
// ============================================

const FileImporter = {
  // Generar SKU único si falta en la fila
  generateUniqueSku(catalog, marca, cat) {
    const prefix = (marca || 'NEW').substring(0, 3).toUpperCase();
    const catCode = (cat || 'OTRO').substring(0, 3).toUpperCase();
    let n = 1;
    while (catalog.find(c => c.sku === `${prefix}-${catCode}-${String(n).padStart(4, '0')}`)) {
      n++;
    }
    return `${prefix}-${catCode}-${String(n).padStart(4, '0')}`;
  },

  async processCsvFile(file, catalog = []) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => {
          const items = [];
          for (const row of r.data) {
            const modelo = (row.Modelo || row.modelo || '').toString().trim();
            if (!modelo) continue;
            const fob = parseFloat(row['FOB USD'] || row['FOB unit USD'] || row.fob || 0);
            if (!fob) continue;

            const marca = (row.Marca || row.marca || '').toString().trim();
            const cat = (row.Categoría || row.Cat || row.cat || '').toString().trim() || 'OTRO';
            const sku = (row.SKU || row.sku || '').toString().trim() || this.generateUniqueSku([...catalog, ...items], marca, cat);

            items.push({
              sku,
              cat,
              marca,
              modelo,
              variante: (row.Color || row.color || row.Variante || '').toString().trim(),
              fob,
            });
          }
          resolve(items);
        },
        error: reject,
      });
    });
  },

  async processExcelFile(file, catalog = []) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws);
    const items = [];

    for (const row of json) {
      const modelo = (row.Modelo || row.modelo || '').toString().trim();
      if (!modelo) continue;
      const fob = parseFloat(row['FOB USD'] || row['FOB unit USD'] || row.fob || 0);
      if (!fob) continue;

      const marca = (row.Marca || row.marca || '').toString().trim();
      const cat = (row.Categoría || row.Cat || row.cat || '').toString().trim() || 'OTRO';
      const sku = (row.SKU || row.sku || '').toString().trim() || this.generateUniqueSku([...catalog, ...items], marca, cat);

      items.push({
        sku,
        cat,
        marca,
        modelo,
        variante: (row.Color || row.color || '').toString().trim(),
        fob,
      });
    }

    return items;
  },

  exportCSV(pedido) {
    if (!pedido || !pedido.items.length) return false;
    const headers = ['SKU', 'Categoría', 'Marca', 'Modelo', 'Color', 'FOB unit USD', 'Cantidad'];
    const rows = pedido.items.map(r => [r.sku, r.cat, r.marca, r.modelo, r.color || '', r.fob, r.qty]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    this.download('\uFEFF' + csv, `${pedido.name || 'Pedido'}.csv`, 'text/csv;charset=utf-8;');
    return true;
  },

  exportXLSX(pedido) {
    if (!pedido || !pedido.items.length) return false;
    const headers = ['SKU', 'Categoría', 'Marca', 'Modelo', 'Color', 'FOB unit USD', 'Cantidad'];
    const rows = pedido.items.map(r => [r.sku, r.cat, r.marca, r.modelo, r.color || '', r.fob, r.qty]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
    XLSX.writeFile(wb, `${pedido.name || 'Pedido'}.xlsx`);
    return true;
  },

  exportCustomsPackingList(pedido) {
    if (!pedido || !pedido.items || !pedido.items.length) {
      if (typeof toast === 'function') toast('No hay pedido para exportar', 'error');
      return false;
    }

    const t = pedido.totals || {};
    const headers = [
      'Item #',
      'SKU',
      'Posición / Categoría',
      'Marca / Proveedor',
      'Modelo / Descripción',
      'Variante',
      'Unidades (Qty)',
      'Peso Est. Total (Kg)',
      'FOB Unit (USD)',
      'FOB Subtotal (USD)',
      'Costo Puesto Unit (USD)',
      'Costo Puesto Total (USD)'
    ];

    const totalWeight = pedido.costs ? (parseFloat(pedido.costs.pesoKg) || 0) : 0;
    const totalQty = pedido.items.reduce((sum, i) => sum + (i.qty || 0), 0);
    const avgWeightPerUnit = totalQty > 0 ? (totalWeight / totalQty) : 0.25;

    const rows = pedido.items.map((r, idx) => {
      const itemQty = r.qty || 1;
      const subFob = (r.fob || 0) * itemQty;
      const itemWeight = (avgWeightPerUnit * itemQty).toFixed(2);
      const unitCost = r.costoUnit || (t.costo && t.fob ? (r.fob * (t.costo / t.fob)) : r.fob * 1.2);
      const subCost = unitCost * itemQty;

      return [
        idx + 1,
        r.sku,
        r.cat || 'PERIFERICOS_GAMER',
        r.marca,
        r.modelo,
        r.color || r.variante || '-',
        itemQty,
        itemWeight,
        r.fob.toFixed(2),
        subFob.toFixed(2),
        unitCost.toFixed(2),
        subCost.toFixed(2)
      ];
    });

    rows.push([]);
    rows.push([
      'TOTALES',
      '',
      '',
      '',
      '',
      '',
      t.qty || totalQty,
      totalWeight ? totalWeight.toFixed(2) : (avgWeightPerUnit * totalQty).toFixed(2),
      '',
      (t.fob || 0).toFixed(2),
      '',
      (t.costo || 0).toFixed(2)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    ws['!cols'] = [
      { wch: 8 },  // #
      { wch: 16 }, // SKU
      { wch: 22 }, // Cat
      { wch: 15 }, // Marca
      { wch: 30 }, // Modelo
      { wch: 12 }, // Variante
      { wch: 14 }, // Qty
      { wch: 18 }, // Peso
      { wch: 16 }, // FOB Unit
      { wch: 18 }, // FOB Sub
      { wch: 20 }, // Costo Unit
      { wch: 20 }  // Costo Sub
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Packing List Aduanero');

    const fileName = `PACKING_LIST_${(pedido.name || 'PEDIDO').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    if (typeof toast === 'function') toast('📦 Packing List Aduanero exportado en Excel', 'success');
    return true;
  },

  download(content, filename, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
};

window.FileImporter = FileImporter;
