#!/usr/bin/env node
/**
 * Calibrate assessModelQuality() against the visual ground-truth verdicts.
 * Reports recall on CRITICO/CAMPO (dirty models we WANT flagged) and the
 * false-positive rate on OK/MENOR (clean-ish models we should NOT flag).
 */
'use strict';
const path = require('path');
const GT = path.join(__dirname, '..', 'ground-truth');
global.TextSanitizer = require('../src/js/textSanitizer.js');
const TS = global.TextSanitizer;
const manifest = require(path.join(GT, 'manifest.json'));
const verdicts = require(path.join(GT, 'verdicts.json'));
const vById = Object.fromEntries(verdicts.items.map(v => [v.id, v.veredicto]));

const DIRT = new Set(['CRITICO', 'CAMPO']);   // should be flagged (Y or R)
const _CLEAN = new Set(['OK', 'MENOR']);        // ideally NOT flagged

let tp = 0, fn = 0, fp = 0, tn = 0;
const fpList = [], fnList = [];
    // PIL iteración 2: casos anclados sin producto extraído (posición vacía) —
    // no son datos sucios, son cobertura perdida; se reportan aparte.
    const missingTotal = manifest.length;
    const missing = manifest.filter(m => m.modelo == null).length;
    for (const m of manifest) {
      if (m.modelo == null) continue;
      const v = vById[m.id];
      const q = TS.assessModelQuality(m.modelo, m.variante, m.cat, m.raw);
      const flagged = q.level !== 'GREEN';
      const isDirty = DIRT.has(v);
      if (isDirty && flagged) tp++;
      else if (isDirty && !flagged) { fn++; fnList.push(`#${m.id} [${v}] modelo="${m.modelo}" -> ${q.level}`); }
      else if (!isDirty && flagged) { fp++; fpList.push(`#${m.id} [${v}] modelo="${m.modelo}" -> ${q.level} (${q.reasons.join('; ')})`); }
      else tn++;
    }
const dirtyN = tp + fn, cleanN = fp + tn;
    console.log('Confusion vs visual ground truth (n=' + (missingTotal - missing) + ', missing=' + missing + '):');
console.log(`  TP (dirty & flagged)   = ${tp}/${dirtyN}  recall_dirty = ${(100 * tp / dirtyN).toFixed(0)}%`);
console.log(`  FN (dirty & missed)    = ${fn}`);
console.log(`  FP (clean & flagged)   = ${fp}/${cleanN}  FP_rate_clean = ${(100 * fp / cleanN).toFixed(0)}%`);
console.log(`  TN (clean & not flag)  = ${tn}`);
console.log('\nFALSE POSITIVES (clean models we flagged — review each):');
fpList.forEach(x => console.log('  ' + x));
console.log('\nFALSE NEGATIVES (dirty models we missed):');
fnList.forEach(x => console.log('  ' + x));
