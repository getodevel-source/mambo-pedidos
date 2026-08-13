/**
 * ImportGates — the single composed verification seam for the import pipeline
 * and the batch export (Slice 1, catalog-reliability-verification).
 *
 * Today `importFlow.js` calls `CatalogValidator.runFullValidation` at 6 sites
 * and `export-catalog-batch.js` calls nothing; `CatalogAssignmentGates.runAll`
 * runs only in `scripts/measure-catalog-assignment.js`. This module makes the
 * preview semaphore identical to the import-time semaphore and to the
 * batch-export semaphore ('GREEN = reliable').
 *
 * Composition order is FIXED (validation → image-text → assignment):
 *  1. CatalogValidator.runFullValidation(items)   # R1-R10 + _statFlag advisory + IQR×3 outliers
 *  2. ImageTextGates.runAll(items)                # interior color + category-aspect
 *  3. CatalogAssignmentGates.runAll(items)        # cross-cat/cross-brand/placeholder + model quality
 *
 * Gates only degrade (GREEN→YELLOW), never promote. `runFullValidation` runs
 * FIRST because it rebuilds `p.warnings`; later gate warnings therefore survive.
 * Products are cloned by the gates (spread preserves `_selected` and evidence);
 * callers swap their array with `result.products` and the split (accepted /
 * review / rejected) is recomputed AFTER the gates.
 *
 * Browser-global + CommonJS compatible (same convention as the other modules).
 */
const ImportGates = {
  /** True when any image-text/assignment gate flagged the product. */
  isGateFlagged(item) {
    return (
      Array.isArray(item && item._imgTextWarnings) &&
      item._imgTextWarnings.length > 0
    );
  },

  /**
   * Runs the full verification chain over the items and returns the final
   * split over the gated product clones.
   * @param {Array} items
   * @returns {{accepted:Array, review:Array, rejected:Array, stats:Object, products:Array}}
   */
  runImportVerification(items) {
    const products = (Array.isArray(items) ? items : []).slice();

    // 1. Deterministic cross-validation + catalog stats. Rebuilds p.warnings,
    //    so it MUST run before the gates append theirs.
    if (typeof CatalogValidator !== 'undefined') {
      CatalogValidator.runFullValidation(products);
    }

    // 2. Image-text gates (interior color, category-aspect).
    if (typeof ImageTextGates !== 'undefined') {
      const afterImages = ImageTextGates.runAll(products);
      products.length = 0;
      products.push(...afterImages.products);
    }

    // 3. Assignment gates (cross-category/cross-brand sharing, placeholder,
    //    model quality).
    if (typeof CatalogAssignmentGates !== 'undefined') {
      const afterAssignment = CatalogAssignmentGates.runAll(products);
      products.length = 0;
      products.push(...afterAssignment.products);
    }

    // Split recomputed AFTER the gates: accepted/review/rejected reference the
    // final clones so a gate-flagged product never stays in `accepted`.
    const accepted = products.filter((p) => p.status === 'GREEN');
    const review = products.filter((p) => p.status === 'YELLOW');
    const rejected = products.filter((p) => p.status === 'RED');
    for (const p of products) {
      p.importable = p.status !== 'RED';
      p.qualityReason = (p.warnings && p.warnings[0]) || 'Sin observaciones';
    }

    return {
      accepted,
      review,
      rejected,
      stats: {
        total: products.length,
        green: accepted.length,
        yellow: review.length,
        red: rejected.length,
        greenPct: Math.round(
          (accepted.length / Math.max(1, products.length)) * 100,
        ),
      },
      products,
    };
  },
};

if (typeof window !== 'undefined') window.ImportGates = ImportGates;
if (typeof module !== 'undefined') module.exports = ImportGates;
