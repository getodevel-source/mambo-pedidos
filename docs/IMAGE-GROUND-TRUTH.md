# Image Ground Truth — labeling packet

Measures photo correctness (IMPORT-PIPELINE-PROGRESS remaining work #2):
wrong-photo rate + per-mechanism association accuracy over a stratified
sample of ~150-200 rows.

## Generate the packet

```bash
MAMBO_CATALOG_DIR="/home/geto/Projects/Mambo-app/Catalogos" \
  node scripts/export-catalog-batch.js /tmp/gt-packet-export.json
# optional: materialize crops (packet `view.imgFile` names match these)
node scripts/export-catalog-batch.js /tmp/gt-packet-export.json --images /tmp/gt-packet-images
node scripts/sample-image-ground-truth.js /tmp/gt-packet-export.json --out /tmp/image-ground-truth-packet.json
```

Flags mirror `scripts/ground-truth.js`: `--per-pdf` / `GT_PER_PDF`
(default 18), `--keep-first` / `GT_KEEP_FIRST` (default 5, guaranteed rows
per stratum), `--target` (default 180), seed fixed at 42 (mulberry32).
Output MUST stay outside `ground-truth/` (versioned); the script refuses
paths inside it.

Each row carries: `id` (IMG-001…), `sku`, `pdf`, `page`, `marca/modelo/cat`,
`status`, `mechanism`, `imageEvidence{pdfIdentity,page,canvasDecode,
association,imageFormat,width,height}`, `imgWarnings`, a `view` pointer
(`exportFile`, `exportIndex`, `pdfPage`, `imgFile`), and an empty label slot
`{ correctPhoto: null, notes: "" }`.

Mechanisms (read-only classification, no parser change): `matched`
(greedy/strict pass, evidence association matched), `backfill` (relaxed
pass — imgWarnings mention backfill), `inherited` (family identity
inheritance, `_imageInherited`), `gallery` (P3 gallery/orphan passes —
photo present but no evidence/backfill marker), `none` (no usable photo).

## How to label

Set `label.correctPhoto` to `true` / `false` (`null` = unlabeled).
Use the `view` pointer: open the PDF at `pdfPage`, compare with the
materialized `imgFile` crop.

- `true`: the photo shows the labeled product (right model/family).
- `false`: wrong product photo, placeholder kept as photo, or empty/
  decorative crop (background only, logo-only, spec tile).
- Edge cases:
  - **Sibling-variant sharing one photo = correct (`true`)** — e.g. the
    same switch/cable photo reused for two colors, or the TECLADO/MOUSE
    pair of one combo line sharing the combo photo. Mark `true` and note
    `"shared sibling photo"` in `notes`. Rationale: the photo depicts the
    product; variant-level color identity is not photo-falsifiable here.
  - Combo photo on only ONE of the pair rows: `true` for the row showing
    the combo, `false` for a row whose own distinct product is not visible.
  - `mechanism: none` rows: leave `correctPhoto: null`, note `"no photo"`.
    They measure placeholder rate, not correctness.

## Scorer contract (future script)

The scorer reads the LABELED packet (same file, labels filled in) and:

1. Skips rows with `correctPhoto: null`. `N_labeled` = rows with boolean.
2. `wrongPhotoRate = #{false} / #{true,false over mechanisms != none}`.
3. Per-mechanism accuracy: for each `mechanism` in
   {matched, backfill, inherited, gallery}: `acc = #{true} / #{labeled}`.
4. Reports 95% Wilson intervals per rate + per-PDF breakdown from `pdf`.
5. Exit non-zero if `N_labeled < 100` (sample too small to trust).

Schema the scorer MUST accept: `rows[].{id, pdf, page, status, mechanism,
imageEvidence{association, canvasDecode}, label{correctPhoto: boolean|null,
notes: string}}`. Unknown extra fields ignored.
