// ============================================
// Mambo Pedidos - Glosario global de términos técnicos (tooltip "i")
// Define window.tip(term) para mostrar una definición al pasar el cursor.
// ============================================

(function () {
  const GLOSSARY = {
    DI: '<b>Derecho de Importación</b>El arancel que pagás por el producto según su NCM. En periféricos BIT es 0%.',
    TE: '<b>Tasa de Estadística</b>Tributo del 3% sobre el CIF (con tope por tramo). Exento (0%) para bienes BIT/BK nuevos.',
    IVA: '<b>Impuesto al Valor Agregado</b>21%. Es RECUPERABLE si revendés como responsable inscripto (crédito fiscal).',
    IVAD: '<b>IVA adicional</b>20% sobre la base. Pago a cuenta RECUPERABLE contra tu IVA de ventas.',
    GAN: '<b>Percepción Ganancias</b>6% (responsable inscripto). Pago a cuenta RECUPERABLE contra tu Ganancias.',
    IIBB: '<b>Ingresos Brutos</b>Impuesto provincial. Santa Fe 3%, CABA 2.5%, PBA 3.5%. Percepción recuperable.',
    CIF: '<b>CIF (costo, seguro y flete)</b>La base imponible aduanera: valor del producto + seguro + flete. Sobre esto se calculan todos los tributos.',
    FOB: '<b>FOB (valor en origen)</b>El precio del producto en el puerto de origen (China), sin flete ni seguro.',
    BIT: '<b>Bienes de Informática y Telecomunicaciones</b>Categoría que paga DI 0% y TE 0% (Dto. 557/23). Incluye teclados, mouse, monitores, celulares.',
    NCM: '<b>Nomenclatura Común del Mercosur</b>Código de 8 dígitos que identifica cada producto para la aduana. Determina su arancel.',
    ENACOM: '<b>ENACOM</b>Homologación obligatoria para dispositivos inalámbricos (bluetooth, RF). Certifica que el equipo cumple normas argentinas.',
    LIBS: '<b>LITIO DG</b>Trámite de transporte de baterías de litio (mercadería peligrosa Clase 9) para productos con batería.',
    COURIER: '<b>Régimen courier</b>Envíos ≤ USD 3.000 y 50kg. USD 400 exentos + arancel simplificado 50% sobre el excedente + IVA, sin anticipos.',
    SIM: '<b>SEDI/SIM</b>Sistema de registro de la operación de importación ante la aduana (dato del embarque).',
    CRED: '<b>Crédito fiscal</b>Los anticipos (IVA, IVA adicional, Ganancias, IIBB) te los compensan si facturás ventas. Tu costo real descuenta esto.',
    PVP: '<b>Precio de Venta al Público</b>El precio al que vendés el producto. El margen se calcula contra tu costo.',
    MARGEN: '<b>Margen</b>La diferencia entre tu precio de venta y tu costo, en % y USD. Es tu ganancia por producto.',
    SKU: '<b>SKU (stock keeping unit)</b>Código interno único que identifica cada producto/variante en tu catálogo.',
    ROI: '<b>Retorno sobre la inversión</b>Ganancia neta sobre el total invertido, en %. Mide si el pedido vale la pena.',
    DEPOSITO: '<b>Depósito fiscal / TCA</b>Costo de almacenar la mercadería en el depósito de la aduana/tierra mientras se despacha.',
    DESPACHANTE: '<b>Despachante de aduana</b>El agente profesional que gestiona el despacho de tu mercadería ante la aduana.',
    SMARK: '<b>S-Mark (Seguridad)</b>Certificación de seguridad eléctrica obligatoria para productos electrónicos que se conectan a la red.',
    PESO: '<b>Peso facturable</b>El peso que cobra el flete (mayor entre peso real y volumen). Base para calcular el costo de transporte aéreo/marítimo.'
  };

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.tip = function (term) {
    const def = GLOSSARY[term];
    if (!def) return '';
    return `<span class="tip" aria-label="${esc(def.replace(/<[^>]*>/g, ' ').trim())}">i<span class="tip-bubble">${def}</span></span>`;
  };
  window.TIP_GLOSSARY = GLOSSARY;
})();