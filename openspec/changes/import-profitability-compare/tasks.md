# Import Profitability + Compare — Tasks (Etapas B y C)

## Iteración B — Rentabilidad por ítem ✅

- [x] `state.margenObjetivo` (default 40%) editable en el paso 6.
- [x] `_profitRows(res)`: multiplicador, costo neto unit, precio sugerido por ítem,
      ordenado desc. Deriva del motor (res.items), no lo toca.
- [x] `_profitHtml(res)`: tabla en el paso 6 + total sugerido vs precio local.
- [x] Tests: orden, sugerido = neto × (1+m), margen editable, total por cantidad.
- [x] Alcance recortado a propósito: peso/origen por SKU en catálogo queda cubierto
      por los overrides A3; no se toca el parser.

## Iteración C — Comparador de regímenes ✅

- [x] `_compareHtml(items)`: tarjetas general vs courier-personal (caja/neto/mult),
      recomendación, nota de regímenes que no aplican (postal, zona franca, 334/2025).
- [x] courier+reventa calcula igual que general (d1, Decreto 1065/2024) — no se
      compara dos veces.
- [x] Tests: ambas tarjetas, nota de no-aplican, fuera de límites → "No entra".

## d1 — courier comercial (cerrado con fuente primaria)

- [x] Verificado en texto del Boletín Oficial: Decreto 1065/2024 (BO 02/12/2024),
      Art. 1º: el simplificado PSP/Courier rige "sin finalidad comercial", 5
      envíos/año por persona, franquicia USD 400 FOB; el excedente "no quedará
      alcanzado por los beneficios". 50kg por paquete: Decreto 1187/93 art. 1º bis
      (citado en su VISTO). Tope USD 3.000: RG AFIP 4450/19 (citada en el VISTO).
- [x] Motor: courier + reventa = matriz NCM completa (regresión pineada: personal
      byte-identical a lo auditado). Plan: paso `tributos-completos` reemplaza al
      simplificado en reventa + paso `regimen-fiscal` con la cita.
- [x] Citas "Decreto 333/25" corregidas a su scope real en app/docs/FAQ:
  courier → 1065/2024; aranceles BIT → 333/2025 (BO 20/05/2025: Art. 1 modifica
  557/23, Art. 2 confirma controllers 9504.50 → AEC 20%, Art. 3 crea II 9,5% a
  celulares/monitores — la app lo avisa aunque no lo calcula).
- [x] Decreto 334/2025 verificado: solo Tierra del Fuego (Ley 19.640), 3 unidades/
      año + USD 3.000 FOB por envío, solo consumo particular — no aplica a
      periféricos de Asia; documentado en el comparador.

## Fuentes todavía ⚠️ (marcadas como estimadas en la app)

- Base FOB vs CIF del excedente courier: el decreto dice FOB; la app usa CIF
  (conservador: calcula un poco más). FAQ lo explica.
- Costo/plazos ENACOM, excepción IATA batería integrada, requisitos SIM, plazos
  DHL/FedEx, comisiones bancarias: estimados en el plan, marcados ⚠️.