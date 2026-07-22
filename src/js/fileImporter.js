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

  exportExecutiveReport(pedido) {
    if (!pedido || !pedido.items || !pedido.items.length) {
      if (typeof toast === 'function') toast('No hay pedido para generar el reporte ejecutivo', 'error');
      return false;
    }

    const t = pedido.totals || {};
    const c = pedido.costs || {};
    const tc = t.tipoCambio || c.tipoCambio || 1400;
    const wb = XLSX.utils.book_new();

    // PESTAÑA 1: Dashboard Ejecutivo
    const dashData = [
      ['REPORTE EJECUTIVO DE IMPORTACIÓN Y RENTABILIDAD'],
      [`Mambo Pedidos v1.0.0 — Generado el ${new Date().toLocaleDateString('es-AR')}`],
      [],
      ['INDICADOR FINANCIERO', 'VALOR USD', 'VALOR EQUIVALENTE ARS'],
      ['Nombre del Pedido', pedido.name || 'Sin nombre', ''],
      ['Total Unidades', t.qty || 0, ''],
      ['Inversión Total FOB (China/Origen)', (t.fob || 0).toFixed(2), ((t.fob || 0) * tc).toFixed(2)],
      ['Costo Total Puesto (CIF + Gastos)', (t.costo || 0).toFixed(2), ((t.costo || 0) * tc).toFixed(2)],
      ['Facturación Total Proyectada (PVP)', (t.facturacion || 0).toFixed(2), ((t.facturacion || 0) * tc).toFixed(2)],
      ['Ganancia Neta Limpia', (t.margen || 0).toFixed(2), ((t.margen || 0) * tc).toFixed(2)],
      ['Margen Neto Sobre Venta (%)', `${(t.margenPct || 0).toFixed(1)}%`, ''],
      ['Retorno de Inversión (ROI %)', `${(t.roi || 0).toFixed(1)}%`, ''],
      ['IVA Estimado Total', (t.ivaUsd || 0).toFixed(2), ((t.ivaUsd || 0) * tc).toFixed(2)],
      ['Tipo de Cambio Aplicado ($/USD)', `$${tc} ARS`, '']
    ];

    const wsDash = XLSX.utils.aoa_to_sheet(dashData);
    wsDash['!cols'] = [{ wch: 38 }, { wch: 22 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, wsDash, 'Dashboard Ejecutivo');

    // PESTAÑA 2: Detalle por Producto
    const prodHeaders = [
      'Item #', 'SKU', 'Categoría', 'Marca', 'Modelo', 'Variante',
      'Unidades', 'FOB Unit (USD)', 'FOB Subtotal (USD)',
      'Costo Unit Puesto (USD)', 'Costo Subtotal (USD)',
      'PVP Unit (USD)', 'PVP Unit (ARS)', 'Facturación Subtotal (USD)',
      'Ganancia Limpia Subtotal (USD)', 'Margen %'
    ];

    const prodRows = pedido.items.map((r, idx) => {
      const q = r.qty || 1;
      const subFob = (r.fob || 0) * q;
      const unitCost = r.costoUnit || (t.costo && t.fob ? (r.fob * (t.costo / t.fob)) : r.fob * 1.2);
      const subCost = unitCost * q;
      const pvpUsd = r.pvp || (unitCost * 2.5);
      const pvpArs = r.pvpArs || (pvpUsd * tc);
      const subFact = pvpUsd * q;
      const subProfit = subFact - subCost;
      const marginPct = subFact > 0 ? ((subProfit / subFact) * 100).toFixed(1) : 0;

      return [
        idx + 1, r.sku, r.cat || 'OTRO', r.marca, r.modelo, r.color || r.variante || '-',
        q, r.fob.toFixed(2), subFob.toFixed(2),
        unitCost.toFixed(2), subCost.toFixed(2),
        pvpUsd.toFixed(2), Math.round(pvpArs), subFact.toFixed(2),
        subProfit.toFixed(2), `${marginPct}%`
      ];
    });

    const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
    wsProd['!cols'] = [
      { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 25 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsProd, 'Detalle de Productos');

    // PESTAÑA 3: Desglose de Logística e Impuestos
    const logHeaders = ['CONCEPTO LOGÍSTICO / FISCAL', 'TIPO / VALOR CONFIGURADO', 'IMPORTE EST. (USD)', 'IMPORTE EST. (ARS)'];
    const logRows = [
      ['Régimen de Importación', c.regimen || 'Courier', '-', '-'],
      ['Modo de Transporte', c.transporte || 'Aéreo', '-', '-'],
      ['Flete Internacional', `${c.flete || 15}% FOB / $${c.costoPorKg || 12} Kg`, (t.fob ? t.fob * ((c.flete || 15)/100) : 0).toFixed(2), (t.fob ? t.fob * ((c.flete || 15)/100) * tc : 0).toFixed(2)],
      ['Seguro Internacional', `${c.seguro || 2}% FOB`, (t.fob ? t.fob * ((c.seguro || 2)/100) : 0).toFixed(2), (t.fob ? t.fob * ((c.seguro || 2)/100) * tc : 0).toFixed(2)],
      ['Derechos de Importación', `${c.derechos || 16}% CIF`, (t.cif ? t.cif * ((c.derechos || 16)/100) : 0).toFixed(2), (t.cif ? t.cif * ((c.derechos || 16)/100) * tc : 0).toFixed(2)],
      ['Tasa Estadística Aduanera', `${c.tasa || 3}% CIF`, (t.cif ? t.cif * ((c.tasa || 3)/100) : 0).toFixed(2), (t.cif ? t.cif * ((c.tasa || 3)/100) * tc : 0).toFixed(2)],
      ['Percepción Ganancias', `${c.perc || 6}% CIF`, (t.cif ? t.cif * ((c.perc || 6)/100) : 0).toFixed(2), (t.cif ? t.cif * ((c.perc || 6)/100) * tc : 0).toFixed(2)],
      ['IVA Estimado Aprox', `${c.ivaPct || 21}%`, (t.ivaUsd || 0).toFixed(2), ((t.ivaUsd || 0) * tc).toFixed(2)],
      ['Honorarios Despachante', `$${c.despachante || 500} ARS`, ((c.despachante || 500) / tc).toFixed(2), (c.despachante || 500).toFixed(2)],
      ['Procesamiento Courier Fijo', `$${c.courier || 8} USD / unidad`, ((c.courier || 8) * (t.qty || 0)).toFixed(2), ((c.courier || 8) * (t.qty || 0) * tc).toFixed(2)]
    ];

    const wsLog = XLSX.utils.aoa_to_sheet([logHeaders, ...logRows]);
    wsLog['!cols'] = [{ wch: 32 }, { wch: 25 }, { wch: 20 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsLog, 'Desglose Logística e Impuestos');

    const fileName = `REPORTE_EJECUTIVO_${(pedido.name || 'PEDIDO').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    if (typeof toast === 'function') toast('📊 Reporte Ejecutivo Financiero generado en Excel', 'success');
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
