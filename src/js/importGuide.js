// ============================================
//  Mambo Pedidos - ImportGuide (Etapa A)
//  Motor de plan de acción EXHAUSTIVO por régimen: la app guía TODO el proceso
//  de importación (marítimo 14 pasos / courier 8), cada paso con responsable,
//  costo, plazo estimado y fuente. Validación fail-closed: cada paso declara
//  sus requisitos y `planFor()` devuelve qué falta y con qué impacto; un plan
//  con bloqueantes es inválido y nunca se puede guardar en silencio.
//  Motor puro: sin DOM. Los tests de exhaustividad afirman el SET COMPLETO de
//  pasos: agregar un paso sin actualizar el test = rojo ("no nos falta nada").
// ============================================

const ImportGuide = {

  // Peso por unidad por categoría (d4: editable por ítem vía item.weightKg).
  // Default solo si el ítem no trae peso propio. Estimados para periféricos.
  PESO_UNITARIO_KG: {
    TECLADO_CABLE: 1.0, TECLADO_WIRELESS: 1.0,
    MOUSE_CABLE: 0.15, MOUSE_WIRELESS: 0.15,
    HEADSET_CABLE: 0.4, HEADSET_WIRELESS: 0.4,
    CONTROLLER_WIRELESS: 0.5,
    MONITOR: 5.0, MOUSEPAD: 0.1, SWITCH: 0.3,
    OTRO: 0.5
  },
  PESO_DEFAULT_KG: 0.5,

  // Límites del régimen courier — VERIFICADO con fuente primaria (BO 02/12/2024,
  // Decreto 1065/2024 Art. 1º + RG AFIP 4450/19 citada en su VISTO): 5 envíos/año por
  // persona, franquicia USD 400 FOB, sin finalidad comercial; tope operativo USD 3.000
  // y 50kg por paquete (Decreto 1187/93 art. 1º bis, citado en el VISTO: el peso se
  // refiere a cada paquete, no al total — la app usa el total como criterio
  // conservador). El arancel 50% sobre el excedente y el IVA 21% vienen de la
  // normativa complementaria ARCA (base del motor IT21).
  COURIER_LIMITS: { MAX_CIF_USD: 3000, MAX_PESO_KG: 50, FRANQUICIA_USD: 400, ARANCEL_EXCEDENTE: 0.50 },

  // ── helpers sobre el pedido ──

  ncmKey(item) {
    if (item && typeof Calculator !== 'undefined' && typeof Calculator.ncmKeyFor === 'function') {
      return Calculator.ncmKeyFor(item);
    }
    return String((item && item.cat) || 'OTRO').toUpperCase();
  },

  esInalambrico(item) {
    return ImportGuide.ncmKey(item).includes('WIRELESS');
  },

  // Peso de un ítem: item.weightKg gana (editable por producto); si no, default
  // de categoría; si no hay categoría conocida, default genérico.
  pesoItemKg(item) {
    const p = Number(item && item.weightKg);
    if (Number.isFinite(p) && p > 0) return p;
    const k = ImportGuide.ncmKey(item);
    const porCat = ImportGuide.PESO_UNITARIO_KG[k];
    return porCat != null ? porCat : ImportGuide.PESO_DEFAULT_KG;
  },

  pesoTotalKg(pedido) {
    return (pedido || []).reduce((a, it) => a + ImportGuide.pesoItemKg(it) * (Number(it && it.qty) || 0), 0);
  },

  tieneInalambricos(pedido) {
    return (pedido || []).some((it) => ImportGuide.esInalambrico(it));
  },

  // ── catálogo de pasos (fuente y estado: ✓ auditado / ⚠️ verificar) ──

  // Paso: { id, titulo, descripcion, responsable, costoUsd (0 = ya modelado en
  // el motor), plazo (estimado), fuente, requiere?: [{queFalta, impacto, check}],
  // condicion?: fn(pedido, state) }.

  pasoSeco(id, titulo, descripcion, responsable, costoUsd, plazo, fuente, requiere) {
    return { id, titulo, descripcion, responsable, costoUsd, plazo, fuente, requiere: requiere || [] };
  },

  MARITIMO: [
    (s) => s.pasoSeco('orden-compra', 'Orden de compra con el proveedor (pro forma)',
      'Confirmá incoterm FOB, moneda USD y plazo de producción antes de pagar. El precio del catálogo es solo del producto.',
      'vos', 0, '1-3 días', 'práctica comercial ✓',
      [{ queFalta: 'Pedido con productos y precios (FOB)', impacto: 'sin pedido no hay importación que planificar', check: (pedido) => pedido.length > 0 && pedido.every((it) => (Number(it.fob) || 0) > 0) }]),
    (s) => s.pasoSeco('pago', 'Pago al proveedor (TT / carta de crédito)',
      'Transferencia bancaria o carta de crédito. El costo financiero (~1-3%) no está modelado en el motor: sumalo si tu banco cobra comisión.',
      'vos', 0, '1-5 días', 'bancos ⚠️ verificar'),
    (s) => s.pasoSeco('produccion', 'Producción e inspección de calidad (opcional)',
      'Si es pedido a fábrica, conviene inspección (fotos/video del proveedor o servicio tercero) antes de embarcar.',
      'proveedor', 0, '7-30 días', 'práctica comercial ✓'),
    (s) => s.pasoSeco('documentacion', 'Documentación de embarque',
      'Factura comercial, packing list, Bill of Lading (BL) o guía aérea (AWB) y póliza de seguro. SIN estos papeles no se puede despachar en destino.',
      'proveedor', 0, 'al embarcar', 'práctica comercial ✓',
      [{ queFalta: 'Confirmar factura comercial + packing list + BL/AWB + póliza', impacto: 'sin la documentación el despacho no se puede presentar ante Aduana', check: (p, st) => !!(st.checks && st.checks['documentacion']) }]),
    (s) => s.pasoSeco('flete', 'Flete internacional (forwarder)',
      'Definilo en el paso 3 del asistente: por peso (USD/kg) o % del FOB. El forwarder consolida y emite el BL.',
      'forwarder', 0, 'marítimo ~30-45 días / aéreo 5-10', 'práctica ✓ (ya calculado)',
      [{ queFalta: 'Flete definido (peso, % del FOB o monto USD)', impacto: 'sin flete el CIF no es real: el motor usa un default y el número no describe tu caso', check: (p, st) => (st.fleteModo === 'peso' && (Number(st.pesoKg) > 0 || Number(st.pesoVolKg) > 0 || ImportGuide.pesoTotalKg(p) > 0)) || (st.fleteModo === 'pct' && Number(st.fletePct) > 0) || (st.fleteModo === 'usd' && Number(st.fleteUsd) > 0) }]),
    (s) => s.pasoSeco('arribo', 'Arribo a puerto/aeropuerto',
      'El forwarder avisa el arribo (Buenos Aires o Ezeiza). Acá ya no se puede cambiar el modo de transporte.',
      'forwarder', 0, 'aviso al llegar', 'práctica ✓'),
    (s) => s.pasoSeco('despachante', 'Contratar despachante de aduana',
      'En barco es OBLIGATORIO: el despacho ante Aduana solo lo presenta un despachante matriculado (no se puede hacer solo). Honorarios en el paso 5 del asistente.',
      'vos', 0, '1-3 días', 'práctica ✓ (honorarios ya en wizard)'),
    (s) => s.pasoSeco('sim', 'Registro del despacho en SIM (digitalización)',
      'El despachante registra el despacho en el Sistema Informático Malvina con los datos del BL y las facturas. El gasto de digitalización está en el paso 5 del asistente.',
      'despachante', 0, '1-3 días hábiles', 'AFIP ⚠️ requisitos a verificar'),
    (s) => s.pasoSeco('ncm-aforo', 'Clasificación NCM y aforo',
      'La app ya clasifica tus productos (paso 4). El despachante valida el NCM y el valor; puede caer en canal verde (sale directo) o rojo (revisión).',
      'despachante', 0, '1-5 días hábiles', 'ARCA/CNCE ✓ (matriz auditada)'),
    (s) => s.pasoSeco('tributos', 'Pago de tributos (DI, TE, IVA, IVA adicional, Ganancias, IIBB)',
      'La app calcula cada tributo por NCM (paso 6 del asistente); el despachante liquida y vos pagás antes del levante. Son pagos a cuenta recuperables salvo DI y TE.',
      'vos', 0, 'al despachar', 'ARCA ✓ (matriz auditada)',
      [{ queFalta: 'Cálculo completo (flete + seguro definidos)', impacto: 'los tributos se calculan sobre CIF: si falta flete o seguro, el número no es el real', check: (p, st) => (st.fleteModo === 'peso' && (Number(st.pesoKg) > 0 || Number(st.pesoVolKg) > 0 || ImportGuide.pesoTotalKg(p) > 0)) || (st.fleteModo === 'pct' && Number(st.fletePct) > 0) || (st.fleteModo === 'usd' && Number(st.fleteUsd) > 0) }]),
    (s) => s.pasoSeco('deposito', 'Depósito fiscal / TCA (almacenaje + THC)',
      'Mientras se despacha, la mercadería está en depósito fiscal y se paga almacenaje y THC portuario (paso 5 del asistente).',
      'vos', 0, 'durante el despacho', 'práctica ✓ (ya en wizard)'),
    (s) => s.pasoSeco('levante', 'Levante y retiro',
      'Pagado todo, la Aduana da el levante y retirás la mercadería con flete interno a tu depósito (paso 5 del asistente).',
      'vos', 0, '1-2 días', 'práctica ✓ (ya en wizard)'),
    (s) => s.pasoSeco('recepcion', 'Conteo de recepción + crédito fiscal en DDJJ',
      'Contá contra la packing list y guardá las facturas: IVA, IVA adicional, Ganancias e IIBB pagados son crédito fiscal que se compensa en tu declaración jurada.',
      'vos', 0, 'al recibir', 'ARCA ✓')
  ],

  COURIER: [
    (s) => s.pasoSeco('compra', 'Compra directa al proveedor',
      'Confirmá si el precio incluye envío y despacho (DDP) o si pagás tributos acá (DDU): la app calcula el escenario DDU; si es DDP, no pagues dos veces.',
      'vos', 0, '1 día', 'práctica ⚠️ d3'),
    (s) => s.pasoSeco('despacho-origen', 'El vendedor despacha con el courier',
      'DHL/FedEx/UPS: pasá dirección, DNI/CUIT y declaración de contenido. Te dan el tracking.',
      'proveedor', 0, '1-3 días', 'couriers ✓'),
    (s) => s.pasoSeco('limites', 'Chequeo de límites del régimen courier',
      'Máximo USD 3.000 y 50kg por envío, franquicia de USD 400 (sobre valor FOB) y tope de 5 envíos/año por persona (Decreto 1065/2024 Art. 1º). Si lo superás, el envío NO entra por courier: hay que pasar a régimen importador (barco).',
      'vos', 0, 'antes de comprar', 'Decreto 1065/2024 ✓ (BO 02/12/2024, Art. 1º)',
      [{ queFalta: 'CIF y peso dentro de los límites courier', impacto: 'fuera de límites el régimen courier no aplica: el plan es inválido', check: (p, st, meta) => meta.cifUsd <= ImportGuide.COURIER_LIMITS.MAX_CIF_USD && meta.pesoTotal <= ImportGuide.COURIER_LIMITS.MAX_PESO_KG }]),
    (s) => s.pasoSeco('transito', 'Tránsito aéreo internacional',
      '2 a 7 días hasta Argentina. Seguilo con el tracking del courier.',
      'courier', 0, '2-7 días', 'couriers ⚠️'),
    (s) => s.pasoSeco('arribo-simplificado', 'Arribo: el courier despacha solo',
      'NO necesitás despachante de aduana: el courier presenta el despacho simplificado ante Aduana. Te cobra sus gastos (paso 5 del asistente).',
      'courier', 0, 'al llegar', 'AFIP ✓'),
    (s) => s.pasoSeco('tributos-simplificados', 'Tributos simplificados (solo uso personal)',
      'Si el valor supera la franquicia de USD 400 (FOB; la app compara el CIF como criterio conservador): 50% de arancel sobre el excedente + IVA 21% sobre el total. El courier te los factura antes de entregar. Sin anticipos (Ganancias/IIBB/IVA adicional).',
      'courier', 0, 'antes de entregar', 'Decreto 1065/2024 + normativa complementaria ARCA ✓',
      [{ queFalta: 'CIF conocido (flete + seguro definidos)', impacto: 'sin CIF real no se sabe si pagás arancel ni cuánto', check: (p, st, meta) => meta.cifUsd != null }]),
    (s) => s.pasoSeco('entrega', 'Entrega y verificación contra factura',
      'Recibí, contá contra la factura del vendedor y guardala para contabilidad.',
      'courier', 0, '1 día', 'práctica ✓'),
    (s) => s.pasoSeco('registro', 'Registrar la importación en la app',
      'Guardala como importación (IMP-xxxx): lleva el conteo de envíos del año (personal) o el registro contable (reventa).',
      'vos', 0, '1 minuto', 'app ✓')
  ],

  // Paso de aviso cuando courier + reventa: CONFIRMADO con fuente primaria (Decreto
  // 1065/2024 Art. 1º: el simplificado rige "sin finalidad comercial"; el excedente
  // "no quedará alcanzado por los beneficios"). Con reventa la app calcula la
  // matriz NCM completa automáticamente (ver motor) — este paso lo explica.
  COURIER_REVENTA_AVISO() {
    return ImportGuide.pasoSeco('regimen-fiscal', 'Régimen fiscal: uso comercial',
      'El régimen simplificado courier rige "sin finalidad comercial" (Decreto 1065/2024 Art. 1º). Como este envío es para reventa, la app lo calcula con la matriz NCM completa (DI + TE + IVA + IVA adicional + Ganancias + IIBB): el courier despacha por cuenta y orden y te los factura antes de entregar.',
      'vos', 0, '—', 'Decreto 1065/2024 Art. 1º ✓ (BO 02/12/2024)');
  },

  // En courier + reventa el paso de tributos simplificados NO aplica: se reemplaza
  // por el de matriz completa (mismo dato requerido: CIF conocido).
  COURIER_TRIBUTOS_COMPLETOS() {
    return ImportGuide.pasoSeco('tributos-completos', 'Tributos completos (matriz NCM)',
      'Con finalidad comercial el simplificado no aplica: pagás DI + TE + IVA + IVA adicional + Ganancias + IIBB según el NCM de cada producto (la app ya los calcula). El courier los liquida por cuenta y orden.',
      'courier', 0, 'antes de entregar', 'Decreto 1065/2024 Art. 1º ✓ + matriz NCM ✓',
      [{ queFalta: 'CIF conocido (flete + seguro definidos)', impacto: 'sin CIF real los tributos no son los reales', check: (p, st, meta) => meta.cifUsd != null }]);
  },

  // Paso de recargo por batería de litio en AÉREO (documental: el costo ya
  // está en el motor). En marítimo no aplica el recargo IATA.
  LITIO_AEREO(regimen) {
    return ImportGuide.pasoSeco('litio-aereo', 'Batería de litio: recargo DG y documentación',
      'Envío aéreo con baterías de litio (inalámbricos): el transportista aplica recargo de mercadería peligrosa (IATA DG) y exige declaración. El recargo (USD 75) ya está en el motor.',
      regimen === 'maritimo' ? 'forwarder' : 'courier', 75, 'al cotizar', 'IATA ⚠️ verificar excepción batería integrada');
  },

  // ── plan ──

  // `doorConfig`: config del motor (la misma que ImportWizard._doorConfig()).
  // `state`: state del wizard (regimen, proposito, fleteModo, checks...).
  planFor(pedido, state = {}, doorConfig = {}) {
    const items = Array.isArray(pedido) ? pedido : ((pedido && pedido.items) || []);
    const st = Object.assign({ regimen: 'importador', proposito: 'personal', fleteModo: 'peso', pesoKg: 0, fletePct: 0.15, checks: {} }, state || {});
    const regimen = st.regimen === 'courier' ? 'courier' : 'maritimo';
    const proposito = st.proposito === 'reventa' ? 'reventa' : 'personal';

    // CIF y peso: del motor si hay config, o estimados con defaults de ítems.
    let cifUsd = null;
    if (typeof Calculator !== 'undefined' && typeof Calculator.calculateDoorToDoorExactCost === 'function' && items.length) {
      try {
        const res = Calculator.calculateDoorToDoorExactCost(items, doorConfig);
        if (res && res.summary) cifUsd = Number(res.summary.cifTotalUsd) || null;
      } catch { /* si el motor falla, el plan queda sin CIF y la validación lo marca */ }
    }
    const pesoTotal = Number(doorConfig.pesoKg) > 0 ? Number(doorConfig.pesoKg) : ImportGuide.pesoTotalKg(items);
    const meta = { cifUsd, pesoTotal, items };

    const pasos = ImportGuide._planSteps(regimen, proposito, items, st);
    const { bloqueantes, avisos } = ImportGuide._planValidity(regimen, proposito, items, st, meta);

    // Validación por paso (fail-closed).
    const pasosOut = pasos.map((paso) => {
      const faltantes = (paso.requiere || [])
        .filter((r) => !r.check(items, st, meta))
        .map((r) => ({ queFalta: r.queFalta, impacto: r.impacto }));
      return Object.assign({}, paso, { completo: faltantes.length === 0, faltantes });
    });

    return {
      regimen, proposito, valido: bloqueantes.length === 0,
      bloqueantes, avisos,
      cifUsd, pesoTotal,
      pasos: pasosOut
    };
  },

  // Pasos por régimen + condicionales (ENACOM, régimen-fiscal, litio).
  _planSteps(regimen, proposito, items, st) {
    const base = regimen === 'courier' ? ImportGuide.COURIER : ImportGuide.MARITIMO;
    let pasos = base.map((f) => f(ImportGuide));

    if ((regimen === 'maritimo' || proposito === 'reventa') && ImportGuide.tieneInalambricos(items)) {
      // ENACOM vive acá y solo acá (la base MARITIMO no lo trae): un pedido
      // solo-cable no lo necesita. Mismo id en ambos regímenes para que el
      // checklist del proyecto persista igual.
      const conEnacom = ImportGuide.pasoSeco('enacom', 'Homologación ENACOM antes de vender',
        'Tus productos inalámbricos necesitan homologación ENACOM para comercializarse legalmente. Si el fabricante tiene certificado, se transfiere con su autorización; si no, es trámite propio (semanas). El costo (USD 350) ya está en el motor.',
        'vos', 350, 'semanas (verificar)', 'ENACOM ⚠️ plazos a verificar',
        [{ queFalta: 'Definir titular de la homologación (fabricante o propia)', impacto: 'sin homologación no podés vender los inalámbricos', check: (p, s) => !!s.enacomTitular }]);
      // Se inserta DESPUÉS del pago de tributos (antes de depósito/levante) y, en
      // courier, después de los tributos simplificados: es requisito previo a vender.
      const ancla = regimen === 'courier' ? 'tributos-simplificados' : 'tributos';
      const i = pasos.findIndex((p) => p.id === ancla);
      if (i >= 0) pasos.splice(i + 1, 0, conEnacom);
      else pasos.push(conEnacom);
    }
    if (regimen === 'courier' && proposito === 'reventa') {
      pasos = [ImportGuide.COURIER_REVENTA_AVISO(), ...pasos];
      // El simplificado no aplica con finalidad comercial: se sale el paso de
      // tributos simplificados y entra el de matriz completa (mismo lugar).
      const j = pasos.findIndex((p) => p.id === 'tributos-simplificados');
      if (j >= 0) pasos.splice(j, 1, ImportGuide.COURIER_TRIBUTOS_COMPLETOS());
    }
    if ((st.transporte === 'aereo' || st.transporte === 'courier') && ImportGuide.tieneInalambricos(items)) {
      pasos.push(ImportGuide.LITIO_AEREO(regimen));
    }
    return pasos;
  },

  // Bloqueantes (plan inválido) + avisos: límites courier, peso, franquicia.
  _planValidity(regimen, proposito, items, st, meta) {
    const cifUsd = meta.cifUsd;
    const pesoTotal = meta.pesoTotal;
    const bloqueantes = [];
    const avisos = [];
    if (!items.length) {
      bloqueantes.push({ paso: 'orden-compra', queFalta: 'No hay pedido', impacto: 'sin pedido no hay plan de importación' });
    }
    if (regimen === 'courier' && cifUsd != null && cifUsd > ImportGuide.COURIER_LIMITS.MAX_CIF_USD) {
      bloqueantes.push({ paso: 'limites', queFalta: `CIF $${Math.round(cifUsd)} supera USD ${ImportGuide.COURIER_LIMITS.MAX_CIF_USD}`, impacto: 'este envío NO entra por courier: cambiá a régimen importador (barco)' });
    }
    if (regimen === 'courier' && pesoTotal > ImportGuide.COURIER_LIMITS.MAX_PESO_KG) {
      bloqueantes.push({ paso: 'limites', queFalta: `Peso ${Math.round(pesoTotal)}kg supera 50kg`, impacto: 'este envío NO entra por courier: cambiá a régimen importador (barco)' });
    }
    if (regimen === 'courier' && proposito === 'reventa') {
      avisos.push('Reventa con régimen courier: se calcula con la matriz NCM completa (Decreto 1065/2024 Art. 1º — el simplificado rige "sin finalidad comercial").');
    }
    if (st.fleteModo === 'peso' && !(Number(st.pesoKg) > 0) && ImportGuide.pesoTotalKg(items) > 0) {
      avisos.push(`Sin peso manual definido: el estimado calculado de tus productos es ${Math.round(ImportGuide.pesoTotalKg(items) * 100) / 100}kg. Podés editarlo por ítem o fijar el peso total.`);
    }
    if (regimen === 'courier' && cifUsd != null && cifUsd > ImportGuide.COURIER_LIMITS.FRANQUICIA_USD) {
      avisos.push(`CIF $${Math.round(cifUsd)} supera la franquicia de USD ${ImportGuide.COURIER_LIMITS.FRANQUICIA_USD}: pagás 50% de arancel sobre el excedente + IVA 21%.`);
    }
    return { bloqueantes, avisos };
  }
};

if (typeof window !== 'undefined') window.ImportGuide = ImportGuide;
if (typeof module !== 'undefined') module.exports = ImportGuide;