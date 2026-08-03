// ============================================
//  Mambo Pedidos - Catálogo Demo (datos de muestra)
//  Extraído de app.js para mantener el controlador limpio.
//  Carga antes que app.js (ver index.html).
// ============================================
const DEMO_CATALOG = [

    {sku:'TEC-001',cat:'TECLADO',marca:'AULA',modelo:'F75 Reaper Switch',variante:'Glacier Blue',fob:31.75},
    {sku:'TEC-002',cat:'TECLADO',marca:'AULA',modelo:'F75 Reaper Switch',variante:'Cedar Green',fob:31.75},
    {sku:'TEC-003',cat:'TECLADO',marca:'AULA',modelo:'F75 Reaper Switch',variante:'Sea Salt Blue',fob:31.75},
    {sku:'TEC-004',cat:'TECLADO',marca:'AULA',modelo:'F75MAX',variante:'Thunder Black',fob:39.48},
    {sku:'TEC-005',cat:'TECLADO',marca:'AULA',modelo:'F75MAX',variante:'Glacier Blue',fob:39.48},
    {sku:'TEC-006',cat:'TECLADO',marca:'AULA',modelo:'F99',variante:'Light Grey',fob:36.04},
    {sku:'TEC-007',cat:'TECLADO',marca:'MCHOSE',modelo:'ACE 68 V2 HE',variante:'Peachy Pink',fob:37.75},
    {sku:'TEC-008',cat:'TECLADO',marca:'MCHOSE',modelo:'ACE 68 V2 HE',variante:'Berry Red',fob:37.75},
    {sku:'TEC-009',cat:'TECLADO',marca:'MCHOSE',modelo:'Mix 87 8KHz',variante:'Black',fob:40.39},
    {sku:'TEC-010',cat:'TECLADO',marca:'Madlions',modelo:'MAD 60 V2 White Horse',variante:'Matte White',fob:25.57},
    {sku:'TEC-011',cat:'TECLADO',marca:'Madlions',modelo:'MAD 60 V2 White Horse',variante:'Matte Black',fob:25.57},
    {sku:'TEC-012',cat:'TECLADO',marca:'Madlions',modelo:'TITAN 68 TURBO',variante:'Black',fob:42.74},
    {sku:'TEC-013',cat:'TECLADO',marca:'ATK',modelo:'Z87',variante:'Caribbean Blue',fob:32.80},
    {sku:'TEC-014',cat:'TECLADO',marca:'ATK',modelo:'Z87 PRO',variante:'Foggy Black',fob:46.00},
    {sku:'MOU-001',cat:'MOUSE',marca:'ATK',modelo:'X1 Ultimate 8KHz',variante:'White',fob:60.70},
    {sku:'MOU-002',cat:'MOUSE',marca:'ATK',modelo:'X1 Ultimate 8KHz',variante:'Black',fob:60.70},
    {sku:'MOU-003',cat:'MOUSE',marca:'ATK',modelo:'A9 Ultra PAW3950',variante:'White',fob:51.70},
    {sku:'MOU-004',cat:'MOUSE',marca:'ATK',modelo:'A9 Ultra PAW3950',variante:'Black',fob:51.70},
    {sku:'MOU-005',cat:'MOUSE',marca:'VXE',modelo:'R1 Pro Max 8KHz',variante:'Sunset Orange',fob:32.80},
    {sku:'MOU-006',cat:'MOUSE',marca:'VXE',modelo:'R1 Pro Max 8KHz',variante:'Lilac Purple',fob:32.80},
    {sku:'MOU-007',cat:'MOUSE',marca:'Attack Shark',modelo:'R5 Ultra',variante:'Black',fob:45.97},
    {sku:'MOU-008',cat:'MOUSE',marca:'Attack Shark',modelo:'R5 Ultra',variante:'White',fob:45.97},
    {sku:'MOU-009',cat:'MOUSE',marca:'Attack Shark',modelo:'X8 SE Tri-mode',variante:'White',fob:13.37},
    {sku:'MOU-010',cat:'MOUSE',marca:'Attack Shark',modelo:'X3 PRO 4K',variante:'Black',fob:29.25},
    {sku:'PAD-001',cat:'MOUSEPAD',marca:'ATK',modelo:'Sky Large 900x400',variante:'Black',fob:13.10},
    {sku:'PAD-002',cat:'MOUSEPAD',marca:'ATK',modelo:'Sky Large 900x400',variante:'Orange',fob:13.10},
    {sku:'PAD-003',cat:'MOUSEPAD',marca:'ATK',modelo:'99G Carbon eSport',variante:'Matcha Green',fob:13.10},
    {sku:'PAD-004',cat:'MOUSEPAD',marca:'ATK',modelo:'Anime Mouse Pad Reverie',variante:'Black-White',fob:8.10},
    {sku:'PAD-005',cat:'MOUSEPAD',marca:'ATK',modelo:'Anime Mouse Pad NANA',variante:'Anime',fob:8.10},
    {sku:'PAD-006',cat:'MOUSEPAD XL',marca:'ATK',modelo:'99G Air PRO XL',variante:'Green',fob:32.80},
    {sku:'PAD-007',cat:'MOUSEPAD',marca:'ATK',modelo:'99G Air Carbon',variante:'Green',fob:6.70},
    {sku:'HEA-001',cat:'HEADSET',marca:'MCHOSE',modelo:'V9 Turbo+ Magnetic',variante:'Black Gold',fob:60.58},
    {sku:'HEA-002',cat:'HEADSET',marca:'MCHOSE',modelo:'V9 Turbo+ Magnetic',variante:'White Gold',fob:60.58},
    {sku:'HEA-003',cat:'HEADSET',marca:'MCHOSE',modelo:'X9 53mm 7.1',variante:'White',fob:40.39},
    {sku:'HEA-004',cat:'HEADSET',marca:'ATK',modelo:'Neptune N9 eSports',variante:'White',fob:24.50},
    {sku:'HEA-005',cat:'HEADSET',marca:'Attack Shark',modelo:'L50 PRO Wireless',variante:'Black',fob:23.17},
  
];

if (typeof window !== 'undefined') window.DEMO_CATALOG = DEMO_CATALOG;
if (typeof module !== 'undefined') module.exports = DEMO_CATALOG;
