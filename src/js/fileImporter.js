// ============================================
//  Mambo Pedidos - Módulo de Importación y Exportación de Archivos (CSV / Excel)
// ============================================

const FileImporter = {
  // Column aliases for fuzzy matching (normalized lowercase, accent-stripped)
  COLUMN_ALIASES: {
    modelo: ['modelo', 'model', 'product name', 'producto', 'nombre', 'descripcion', 'description', 'item name'],
    marca: ['marca', 'brand', 'fabricante', 'manufacturer', 'fabricante'],
    categoria: ['categoria', 'categoría', 'cat', 'category', 'tipo', 'type', 'rubro'],
    fob: ['fob usd', 'fob unit usd', 'fob', 'precio', 'price', 'usd', 'unit price', 'precio usd', 'valor'],
    sku: ['sku', 'codigo', 'código', 'code', 'id', 'referencia', 'ref', 'part number', 'pn'],
    variante: ['color/variante', 'variante', 'color', 'variacion', 'variación', 'variant', 'color/variation'],
    cantidad: ['cantidad', 'qty', 'quantity', 'units', 'unidades', 'stock', 'cant']
  },

  /**
   * Normalize a column header for fuzzy matching.
   * Strips accents, lowercases, trims whitespace.
   */
  normalizeHeader(header) {
    return String(header || '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  },

  /**
   * Resolve a field value from a row using fuzzy column matching.
   * @param {Object} row - The parsed row object
   * @param {string} field - Logical field name (modelo, marca, categoria, fob, sku, variante, cantidad)
   * @returns {string} The resolved value (trimmed), or ''
   */
  resolveField(row, field) {
    if (!row || !field) return '';
    const aliases = this.COLUMN_ALIASES[field];
    if (!aliases) return '';

    // Build a normalized map of the row's keys
    const normalizedRow = {};
    for (const key of Object.keys(row)) {
      normalizedRow[this.normalizeHeader(key)] = row[key];
    }

    for (const alias of aliases) {
      const normalized = this.normalizeHeader(alias);
      if (normalizedRow[normalized] !== undefined && normalizedRow[normalized] !== null) {
        return String(normalizedRow[normalized]).trim();
      }
    }
    return '';
  },

  getVariant(row = {}) {
    return this.resolveField(row, 'variante') || (row['Color/Variante'] || row.Variante || row.variante || row.Color || row.color || '').toString().trim();
  },

  // Generar SKU único si falta en la fila
  generateUniqueSku(catalog, marca, cat, modelo = '', variante = '') {
    if (typeof SkuAllocator !== 'undefined') {
      return SkuAllocator.allocateBatch([{ marca, cat, modelo, variante }], catalog)[0].sku;
    }
    const prefix = (marca || 'NEW').substring(0, 3).toUpperCase();
    const catCode = (cat || 'OTRO').substring(0, 3).toUpperCase();
    let n = 1;
    while (catalog.find(c => c.sku === `${prefix}-${catCode}-${String(n).padStart(4, '0')}`)) n++;
    return `${prefix}-${catCode}-${String(n).padStart(4, '0')}`;
  },

  // IT27: parseo compartido de filas (DRY — usado por CSV y Excel).
  // Devuelve { items, skippedNoModel, skippedNoFob }.
  _parseItems(jsonRows, catalog) {
    const items = [];
    let skippedNoModel = 0;
    let skippedNoFob = 0;
    for (const row of jsonRows) {
      const modelo = this.resolveField(row, 'modelo');
      if (!modelo) { skippedNoModel++; continue; }
      const fobRaw = this.resolveField(row, 'fob');
      const fob = parseFloat(fobRaw) || 0;
      if (!fob) { skippedNoFob++; continue; }
      const marca = this.resolveField(row, 'marca');
      const cat = this.resolveField(row, 'categoria') || 'OTRO';
      const variante = this.getVariant(row);
      const sku = this.resolveField(row, 'sku') || this.generateUniqueSku([...catalog, ...items], marca, cat, modelo, variante);
      items.push({ sku, cat, marca, modelo, variante, fob });
    }
    return { items, skippedNoModel, skippedNoFob };
  },

  _reportSkipped(skippedNoModel, skippedNoFob, total, source) {
    if (skippedNoModel > 0 || skippedNoFob > 0) {
      const msg = `${source}: ${skippedNoModel} filas sin Modelo, ${skippedNoFob} sin FOB (de ${total} totales)`;
      console.warn(msg);
      if (typeof toast === 'function') toast(`⚠️ ${source}: se saltaron ${skippedNoModel + skippedNoFob} filas incompletas`, 'warning');
    }
  },

  async processCsvFile(file, catalog = []) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: r => {
          // #2: Mojibake detection — check headers for encoding artifacts
          const headers = r.meta.fields || [];
          const mojibakePattern = /[Ã¡-ÃºÂ¿Â¡ÃƒÃ‚]/;
          const hasMojibake = headers.some(h => mojibakePattern.test(h));
          if (hasMojibake) {
            console.warn(`CSV encoding: headers contienen mojibake (probable Latin-1/Windows-1252 leído como UTF-8). Headers: ${headers.join(', ')}. Considerá re-exportar el archivo como UTF-8.`);
            if (typeof toast === 'function') {
              toast('⚠️ CSV con encoding incorrecto (Latin-1). Columnas pueden no reconocerse. Re-exportá como UTF-8.', 'error');
            }
          }

          const { items, skippedNoModel, skippedNoFob } = this._parseItems(r.data, catalog);
          this._reportSkipped(skippedNoModel, skippedNoFob, r.data.length, 'CSV import');
          resolve(items);
        },
        error: reject,
      });
    });
  },

  async processExcelFile(file, catalog = []) {
    // P17 opción 2: lazy-load de xlsx (solo al primer Excel real)
    if (typeof ensureXlsxLib === 'function') await ensureXlsxLib();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });

    // Multi-sheet detection: find the sheet with the most data rows
    let bestSheetName = wb.SheetNames[0];
    let bestRowCount = 0;
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      const rows = XLSX.utils.sheet_to_json(sheet);
      if (rows.length > bestRowCount) {
        bestRowCount = rows.length;
        bestSheetName = name;
      }
    }
    if (wb.SheetNames.length > 1) {
      console.info(`XLSX: ${wb.SheetNames.length} hojas detectadas. Usando "${bestSheetName}" (${bestRowCount} filas).`);
    }

    const ws = wb.Sheets[bestSheetName];
    const json = XLSX.utils.sheet_to_json(ws);

    // #12: Merged cells / formula sheet detection
    if (json.length > 0) {
      const keys = Object.keys(json[0]);
      const emptyKeys = keys.filter(k => /^__EMPTY|^_\d+$/.test(k));
      if (emptyKeys.length > keys.length * 0.5) {
        console.warn(`XLSX: hoja "${bestSheetName}" tiene celdas mergeadas o headers no reconocidos (${emptyKeys.length}/${keys.length} columnas son __EMPTY). Keys: ${keys.join(', ')}. El archivo puede tener formato inesperado.`);
        if (typeof toast === 'function') {
          toast(`⚠️ XLSX "${bestSheetName}": estructura no reconocida (celdas mergeadas). Verificá el formato del archivo.`, 'error');
        }
      }
    }

    const items = this._parseItems(json, catalog);
    this._reportSkipped(items.skippedNoModel, items.skippedNoFob, json.length, `XLSX "${bestSheetName}"`);
    return items.items;
  },

  exportCSV(pedido) {
    if (!pedido || !pedido.items.length) return false;
    const headers = ['SKU', 'Categoría', 'Marca', 'Modelo', 'Color/Variante', 'FOB unit USD', 'Cantidad', 'Costo neto unit USD', 'IVA unit USD', 'IVA subtotal USD'];
    const rows = pedido.items.map(r => [r.sku, r.cat, r.marca, r.modelo, r.variante || r.color || '', r.fob, r.qty, r.costoU || 0, r.ivaU || 0, r.subIva || 0]);
    const csv = [headers, ...rows].map(row => row.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    this.download('\uFEFF' + csv, `${pedido.name || 'Pedido'}.csv`, 'text/csv;charset=utf-8;');
    return true;
  },

  async exportXLSX(pedido) {
    // P17 opción 2: lazy-load de xlsx (solo al exportar Excel)
    if (typeof XLSX === 'undefined' && typeof ensureXlsxLib === 'function') {
      await ensureXlsxLib();
    }
    if (!pedido || !pedido.items.length) return false;
    const headers = ['SKU', 'Categoría', 'Marca', 'Modelo', 'Color/Variante', 'FOB unit USD', 'Cantidad', 'Costo neto unit USD', 'IVA unit USD', 'IVA subtotal USD'];
    const rows = pedido.items.map(r => [r.sku, r.cat, r.marca, r.modelo, r.variante || r.color || '', r.fob, r.qty, r.costoU || 0, r.ivaU || 0, r.subIva || 0]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pedido');
    XLSX.writeFile(wb, `${pedido.name || 'Pedido'}.xlsx`);
    return true;
  },

  async exportCustomsPackingList(pedido) {
    // P17 opción 2: lazy-load de xlsx (solo al exportar Excel)
    if (typeof XLSX === 'undefined' && typeof ensureXlsxLib === 'function') {
      await ensureXlsxLib();
    }
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
      'Costo Neto Puesto Total (USD)',
      'IVA Subtotal (USD)'
    ];

    const totalWeight = pedido.costs ? (parseFloat(pedido.costs.pesoKg) || 0) : 0;
    const totalQty = pedido.items.reduce((sum, i) => sum + (i.qty || 0), 0);
    const avgWeightPerUnit = totalQty > 0 ? (totalWeight / totalQty) : 0.25;

    const rows = pedido.items.map((r, idx) => {
      const itemQty = r.qty || 1;
      const subFob = (r.fob || 0) * itemQty;
      const itemWeight = (avgWeightPerUnit * itemQty).toFixed(2);
      const unitCost = r.costoU || r.costoUnit || (t.costo && t.fob ? (r.fob * (t.costo / t.fob)) : r.fob * 1.2);
      const subCost = unitCost * itemQty;

      return [
        idx + 1,
        r.sku,
        r.cat || 'PERIFERICOS_GAMER',
        r.marca,
        r.modelo,
        r.variante || r.color || '-',
        itemQty,
        itemWeight,
        r.fob.toFixed(2),
        subFob.toFixed(2),
        unitCost.toFixed(2),
        subCost.toFixed(2),
        (r.subIva || 0).toFixed(2)
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
      (t.costoNeto || t.costo || 0).toFixed(2),
      (t.ivaUsd || 0).toFixed(2)
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
      { wch: 20 }, // Costo Sub
      { wch: 18 }  // IVA Sub
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Packing List Aduanero');

    const fileName = `PACKING_LIST_${(pedido.name || 'PEDIDO').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    if (typeof toast === 'function') toast('📦 Packing List Aduanero exportado en Excel', 'success');
    return true;
  },

  async exportExecutiveReport(pedido) {
    // P17 opción 2: lazy-load de xlsx (solo al exportar Excel)
    if (typeof XLSX === 'undefined' && typeof ensureXlsxLib === 'function') {
      await ensureXlsxLib();
    }
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
      ['Costo Neto Puesto (sin IVA)', (t.costoNeto || t.costo || 0).toFixed(2), ((t.costoNeto || t.costo || 0) * tc).toFixed(2)],
      ['IVA separado / repercutible', (t.ivaUsd || 0).toFixed(2), ((t.ivaUsd || 0) * tc).toFixed(2)],
      ['Total Bruto con IVA', (t.totalBrutoConIva || (t.costo || 0) + (t.ivaUsd || 0)).toFixed(2), ((t.totalBrutoConIva || (t.costo || 0) + (t.ivaUsd || 0)) * tc).toFixed(2)],
      ['Facturación Total Proyectada (PVP)', (t.facturacion || 0).toFixed(2), ((t.facturacion || 0) * tc).toFixed(2)],
      ['Ganancia Neta Limpia', (t.margen || 0).toFixed(2), ((t.margen || 0) * tc).toFixed(2)],
      ['Margen Neto Sobre Venta (%)', `${(t.margenPct || 0).toFixed(1)}%`, ''],
      ['Retorno de Inversión (ROI %)', `${(t.roiPct || 0).toFixed(1)}%`, ''],
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
      'Ganancia Limpia Subtotal (USD)', 'IVA Subtotal (USD)', 'Margen %'
    ];

    const prodRows = pedido.items.map((r, idx) => {
      const q = r.qty || 1;
      const subFob = (r.fob || 0) * q;
      const unitCost = r.costoU || r.costoUnit || (t.costo && t.fob ? (r.fob * (t.costo / t.fob)) : r.fob * 1.2);
      const subCost = unitCost * q;
      const pvpUsd = r.pvp || (unitCost * 2.5);
      const pvpArs = r.pvpArs || (pvpUsd * tc);
      const subFact = pvpUsd * q;
      const subProfit = subFact - subCost;
      const marginPct = subFact > 0 ? ((subProfit / subFact) * 100).toFixed(1) : 0;

      return [
        idx + 1, r.sku, r.cat || 'OTRO', r.marca, r.modelo, r.variante || r.color || '-',
        q, r.fob.toFixed(2), subFob.toFixed(2),
        unitCost.toFixed(2), subCost.toFixed(2),
        pvpUsd.toFixed(2), Math.round(pvpArs), subFact.toFixed(2),
        subProfit.toFixed(2), (r.subIva || 0).toFixed(2), `${marginPct}%`
      ];
    });

    const wsProd = XLSX.utils.aoa_to_sheet([prodHeaders, ...prodRows]);
    wsProd['!cols'] = [
      { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 25 }, { wch: 12 },
      { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 20 },
      { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 25 }, { wch: 12 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, wsProd, 'Detalle de Productos');

    // PESTAÑA 3: Desglose de Logística e Impuestos
    const fleteVal = c.flete !== undefined ? c.flete : (c.fletePct ? c.fletePct * 100 : 15);
    const despUsd = parseFloat(c.desp !== undefined ? c.desp : (c.despachante || 500));
    const logHeaders = ['CONCEPTO LOGÍSTICO / FISCAL', 'TIPO / VALOR CONFIGURADO', 'IMPORTE EST. (USD)', 'IMPORTE EST. (ARS)'];
    const logRows = [
      ['Régimen de Importación', c.logisticaModo || c.regimen || 'Courier', '-', '-'],
      ['Modo de Transporte', c.transporteModo || c.transporte || 'Aéreo', '-', '-'],
      ['Flete Internacional', `${fleteVal}% FOB / $${c.costoPorKg || 12} Kg`, (t.fleteUsd || (t.fob ? t.fob * (fleteVal / 100) : 0)).toFixed(2), (t.fleteArs || (t.fob ? t.fob * (fleteVal / 100) * tc : 0)).toFixed(2)],
      ['Seguro Internacional', `${c.seguro || 2}% FOB`, (t.fob ? t.fob * ((c.seguro || 2)/100) : 0).toFixed(2), (t.fob ? t.fob * ((c.seguro || 2)/100) * tc : 0).toFixed(2)],
      ['Derechos de Importación', `${c.derechos !== undefined ? c.derechos : 0}% CIF`, (t.derechosUsd || 0).toFixed(2), ((t.derechosUsd || 0) * tc).toFixed(2)],
      ['Tasa Estadística Aduanera', `${c.tasa !== undefined ? c.tasa : 3}% CIF`, (t.tasaUsd || 0).toFixed(2), ((t.tasaUsd || 0) * tc).toFixed(2)],
      ['Percepción Ganancias', `${c.perc !== undefined ? c.perc : 6}% CIF`, (t.percUsd || 0).toFixed(2), ((t.percUsd || 0) * tc).toFixed(2)],
      ['IVA separado / repercutible', `${c.ivaPct !== undefined ? c.ivaPct : 21}%`, (t.ivaUsd || 0).toFixed(2), ((t.ivaUsd || 0) * tc).toFixed(2)],
      ['Honorarios Despachante', `$${despUsd} USD`, despUsd.toFixed(2), (despUsd * tc).toFixed(2)],
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

if (typeof window !== 'undefined') window.FileImporter = FileImporter;
if (typeof module !== 'undefined') module.exports = FileImporter;
