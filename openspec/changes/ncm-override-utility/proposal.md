# NCM override con utilidad real (IT40)

## Problema
El wizard permitía elegir un NCM por categoría (`ncmOverrides[cat] = { ncm, derechos }`),
pero el calculador (`calculateDoorToDoorExactCost`) SOLO usaba `derechos` (DI) e
ignoraba el `ncm` elegido: el resultado seguía mostrando y usando el NCM de la
matriz automática. El campo NCM era inerte (feature a medias).

## Solución
El override NCM ahora es operativo de punta a punta:

1. **`src/js/calculator.js`** (`calculateDoorToDoorExactCost`):
   - Si el override tiene `ncm`, ese código reemplaza al de la matriz en el resultado.
   - Si el código mapea a OTRA entrada de la matriz (ej: NCM de mousepad en un
     teclado), se usan SUS rates completos (TE/IVA/adic/Ganancias/IIBB/certs).
   - Si el código NO mapea a la matriz, se muestran el código elegido + se usan
     los rates estructurales de la categoría (dependen del tipo de producto) y
     el DI del override.
2. **`src/js/ui/importWizard.js`** (`_render_impuestos`): la tabla del paso 4
   muestra el NCM override (si existe) en vez del default de la matriz.

## Verificación
- Tests IT40 nuevos (6 asserts): override mapea a otra entrada (muestra el NCM,
  usa TE 3% de MOUSEPAD, DI 35%) + override no mapeado (muestra el NCM, mantiene
  rates estructurales, DI 10%).
- Browser e2e: override `TECLADO_CABLE → 3926.90.90` → tabla muestra 3926.90.90
  (no el default), cálculo devuelve ncm 3926.90.90 + tasa 3%.
- Suite 1026/1026 + lint 0 + build OK.

## Nota
El `ov.derechos` (DI) almacenado al elegir el NCM es el autoritativo de ARCA
(viene del NCM DB en `_setNcmOverride`). El override re-resuelve el código contra
la matriz para los rates estructurales; los DI por categoría que se auto-cargan
desde ARCA (`_cargarDI`) no tocan el `ncm` (solo DI), preservando el default.