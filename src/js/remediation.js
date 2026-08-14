/**
 * Remediation — pure, deterministic remediation engine for the catalog
 * remediation loop (Slice 2, catalog-remediation-loop).
 *
 * Every non-GREEN product gets an atomic reason (deriveReasonCode), then the
 * config-gated strategy for that failure class runs over (item, rowEvidence)
 * and returns { item', evidence } | null. A strategy result is promoted ONLY
 * when the remediated item re-passes the full gate stack AND its
 * remediationEvidence traces to the real source artifacts
 * (assertPromotionEvidence — fail-closed: missing/fabricated evidence is a
 * pipeline defect, never promoted). Items that cannot be honestly fixed stay
 * flagged and are declared bounded-irremediable (class + why).
 *
 * All strategies are pure functions over a spread clone — no I/O, no
 * randomness, no mutation of stored catalog data. Browser-global + CommonJS
 * (same convention as ImportGates).
 */

// Code pattern: real product codes look like "AJ139", "F75", "M720" — 1-6
// letters + 1-4 digits (optionally a trailing +/suffix char). Never matches
// pure words or pure numbers, so "Standard", "TECLADO" and "68 Keys" are out.
const MODEL_CODE_RE = /(?:^|[\s\-/])(?!paw\d)([A-Za-z]{1,6}\d{1,4}[\w+]?)/i;

const COLOR_WORDS_FALLBACK = [
	"black",
	"white",
	"pink",
	"blue",
	"red",
	"green",
	"purple",
	"grey",
	"gray",
	"silver",
	"gold",
	"orange",
	"brown",
	"cyan",
	"magenta",
	"yellow",
	"cream",
	"negro",
	"blanco",
	"rosa",
	"azul",
	"rojo",
	"verde",
	"violeta",
	"gris",
	"plateado",
	"dorado",
	"naranja",
	"marron",
	"amarillo",
];
const COLOR_FAMILY_FALLBACK = {
	black: "BLACK",
	negro: "BLACK",
	white: "WHITE",
	blanco: "WHITE",
	cream: "WHITE",
	grey: "GRAY",
	gray: "GRAY",
	gris: "GRAY",
	silver: "SILVER",
	plateado: "SILVER",
	blue: "BLUE",
	azul: "BLUE",
	purple: "PURPLE",
	violet: "PURPLE",
	violeta: "PURPLE",
	pink: "PINK",
	rosa: "PINK",
	magenta: "PINK",
	red: "RED",
	rojo: "RED",
	green: "GREEN",
	verde: "GREEN",
	gold: "GOLD",
	dorado: "GOLD",
	orange: "ORANGE",
	naranja: "ORANGE",
	brown: "ORANGE",
	marron: "ORANGE",
	yellow: "YELLOW",
	amarillo: "YELLOW",
};
const COLOR_COMPATIBLE_FALLBACK = {
	GRAY: ["GRAY", "SILVER", "WHITE"],
	SILVER: ["GRAY", "SILVER", "WHITE"],
	WHITE: ["GRAY", "SILVER", "WHITE"],
	PURPLE: ["PURPLE", "BLUE", "PINK"],
	BLUE: ["PURPLE", "BLUE", "PINK"],
	PINK: ["PURPLE", "BLUE", "PINK"],
	CYAN: ["CYAN", "BLUE", "GREEN"],
	GREEN: ["CYAN", "BLUE", "GREEN"],
	GOLD: ["GOLD", "ORANGE"],
	ORANGE: ["GOLD", "ORANGE"],
};
const COMPACT_CATS_FALLBACK = [
	"MOUSE",
	"HEADSET",
	"AURICULAR",
	"CONTROLLER",
	"SWITCH",
];
const WIDE_CATS_FALLBACK = ["TECLADO", "MOUSEPAD"];

// Engine epsilons reused from the parser (verifyGrounding): 30px row band,
// 40px column band.
const ROW_TOLERANCE = 30;
const COLUMN_TOLERANCE = 40;

// Atomic reason → strategy registry (dispatch table for runRemediationPass).
// FOB_NEIGHBOR_ANCHOR is deliberately absent: fused/shifted cells never promote.
const REASON_TO_STRATEGY = {
	COLOR_MISMATCH: "colorFromImage",
	COLOR_AMBIGUOUS: "varianteColorAdoption",
	OUTLIER_PRICE: "literalPriceRegrounding",
	FOB_NO_LITERAL_EVIDENCE: "literalAnchorSearch",
	FOB_UNALIGNED: "literalAnchorSearch",
	MODEL_MARKETING: "codeAdoption",
	MODEL_TRUNCATED: "truncationRepair",
	SWITCH_IN_MODEL: "switchToVariante",
	MODEL_GENERIC_WORD: "rowContextDisambiguation",
	SPEC_FRAGMENT: "codeAdoption",
	ASPECT_MISMATCH: "sharedImageReassign",
	SHARED_IMAGE: "sharedImageReassign",
	LEGACY_ONLY_CLEAN: "legacyOnlyClean",
};

// Atomic reason → legible Spanish label for the human-review report. Keeps
// reporting honest: an item flagged YELLOW with structured evidence but no
// legacy warning string must show its real degradation reason, never the
// "Sin observaciones" fallback. LEGACY_ONLY_CLEAN and COLOR_AMBIGUOUS are
// covered so a degenerate item never loses its true reason.
const REASON_TEXT = {
	COLOR_MISMATCH: "Color de imagen no coincide con el color declarado",
	COLOR_AMBIGUOUS: "Color de imagen ambiguo (multi-color)",
	ASPECT_MISMATCH: "Ratio de imagen incompatible con la categoría",
	SHARED_IMAGE: "Imagen compartida entre categorías (asignación inválida)",
	OUTLIER_PRICE: "Precio atípico (outlier IQR×3)",
	FOB_NO_LITERAL_EVIDENCE:
		"FOB sin evidencia literal suficiente (ancla geométrica)",
	FOB_NEIGHBOR_ANCHOR:
		"FOB anclado a fila vecina/fusionada (sin evidencia literal propia)",
	FOB_UNALIGNED: "FOB con ancla desalineada respecto a la fila",
	MODEL_GENERIC_WORD:
		"Modelo es una palabra genérica (no un código de producto)",
	MODEL_MARKETING:
		"Modelo tiene palabras de marketing sin un identificador real",
	MODEL_TRUNCATED: "Modelo truncado (paréntesis/llave sin cerrar)",
	MODEL_TEMPLATE: "Modelo con plantilla/placeholders sin identidad real",
	MODEL_TYPE_GLUED: "Modelo con keyword de tipo/switch pegada (specs)",
	SWITCH_IN_MODEL:
		"El modelo incluye el tipo de switch/axis (debería ir aparte)",
	SPEC_FRAGMENT: "Modelo = fragmento de especificación técnica",
	CATEGORY_DOUBTFUL: "Categoría dudosa en la imagen",
	IMAGE_MISSING: "Sin imagen de producto",
	UNCLASSIFIED_YELLOW: "Degradación sin razón atómica (defecto de pipeline)",
	LEGACY_ONLY_CLEAN: "Sin observaciones (solo warnings legacy ya resueltos)",
};

/**
 * Legible Spanish label for a non-GREEN item. Prefers the real structured
 * reason (`_atomicReason`) mapped to its human label; falls back to the first
 * legacy warning, then to a generic UNCLASSIFIED label. An item that is
 * genuinely unobserved stays YELLOW only with a real reason — "Sin
 * observaciones" is never emitted for a flagged item when atomic evidence
 * exists.
 * @param {Object} item
 * @returns {string}
 */
function resolveReasonLabel(item) {
	const atomic = item && item._atomicReason;
	if (atomic && REASON_TEXT[atomic]) return REASON_TEXT[atomic];
	const warnings = Array.isArray(item && item.warnings) ? item.warnings : [];
	if (warnings.length && typeof warnings[0] === "string") return warnings[0];
	if (atomic) return atomic;
	return "Sin observaciones";
}

/** Parses a literal price token ("$89.00", "23,90") into a number, or null. */
function parsePriceToken(str) {
	const s = String(str || "").trim();
	if (!s) return null;
	if (!/^[$€£¥]?\s?[\d.,]+$/.test(s)) return null;
	const cleaned = s.replace(/[$€£¥\s]/g, "");
	if (!/^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?$/.test(cleaned)) return null;
	// Remove thousand separators (e.g. "1,299.00" → "1299.00"), then decimal comma.
	const norm = cleaned
		.replace(/(\d)[.,](\d{3})(?=\D|$)/g, "$1$2")
		.replace(",", ".");
	const val = parseFloat(norm);
	return Number.isFinite(val) ? val : null;
}

/** Deterministic short hash of an image data URL (for shared-image grouping). */
function imageHashOf(img) {
	const s = String(img || "");
	if (!s) return null;
	let h1 = 5381;
	let h2 = 52711;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = ((h1 << 5) + h1 + c) | 0;
		h2 = ((h2 << 5) + h2 + c) | 0;
	}
	return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

function escapeRe(s) {
	return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const Remediation = {
	MODEL_CODE_RE,
	REASON_TO_STRATEGY,
	REASON_TEXT,
	resolveReasonLabel,

	/** Interior sample read from the item (parser or imageEvidence). */
	interiorOf(item) {
		return (
			(item &&
				(item._interiorColor ||
					(item.imageEvidence && item.imageEvidence.interiorColor))) ||
			null
		);
	},

	/** Color vocabulary/family/compat helpers (ImageTextGates when present). */
	colorVocabulary(ctx) {
		const words =
			(ctx && ctx.colorVocabulary) ||
			(typeof ImageTextGates !== "undefined" &&
				ImageTextGates.COLOR_KEEP_WORDS) ||
			COLOR_WORDS_FALLBACK;
		return new Set(words.map((w) => String(w).toUpperCase()));
	},
	colorFamilyOf(word, ctx) {
		const fam =
			(ctx && ctx.colorFamily) ||
			(typeof ImageTextGates !== "undefined" && ImageTextGates.COLOR_FAMILY) ||
			COLOR_FAMILY_FALLBACK;
		return fam[String(word || "").toLowerCase()] || null;
	},
	compatibleColor(family, top, ctx) {
		const d = String(family || "").toUpperCase();
		const a = String(top || "").toUpperCase();
		if (d === a) return true;
		const group =
			(ctx && ctx.compatible) ||
			(typeof ImageTextGates !== "undefined" &&
				ImageTextGates.COLOR_COMPATIBLE) ||
			COLOR_COMPATIBLE_FALLBACK;
		const g = group[d];
		return Array.isArray(g) && g.includes(a);
	},

	/** First color word (original casing) on color → variante → modelo. */
	firstDeclaredColor(item) {
		const words =
			typeof ImageTextGates !== "undefined" && ImageTextGates.COLOR_KEEP_RE
				? null
				: COLOR_WORDS_FALLBACK;
		const fields = [
			item && item.color,
			item && item.variante,
			item && item.modelo,
		];
		for (const field of fields) {
			const s = String(field || "");
			if (!s.trim()) continue;
			if (words) {
				const re = new RegExp("\\b(?:" + words.join("|") + ")\\b", "i");
				const m = s.match(re);
				if (m) return m[0];
			} else if (typeof ImageTextGates.COLOR_KEEP_RE !== "undefined") {
				const m = s.match(ImageTextGates.COLOR_KEEP_RE);
				if (m) return m[0];
			}
		}
		return null;
	},

	/** All color words (original casing) inside a string. */
	colorTokensIn(text) {
		const s = String(text || "");
		if (!s.trim()) return [];
		const re =
			typeof ImageTextGates !== "undefined" && ImageTextGates.COLOR_KEEP_RE
				? new RegExp(ImageTextGates.COLOR_KEEP_RE.source, "gi")
				: new RegExp("\\b(?:" + COLOR_WORDS_FALLBACK.join("|") + ")\\b", "gi");
		const seen = new Set();
		const out = [];
		let m;
		while ((m = re.exec(s)) !== null) {
			const tok = m[0];
			const key = tok.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				out.push(tok);
			}
		}
		return out;
	},

	/** Unique color families for a list of color tokens (declared spelling). */
	familiesOfTokens(tokens, ctx) {
		const seen = new Set();
		const out = [];
		for (const t of tokens) {
			const fam = this.colorFamilyOf(t, ctx);
			if (fam && !seen.has(fam)) {
				seen.add(fam);
				out.push(fam);
			}
		}
		return out;
	},

	/** First real product code inside text, or null. */
	firstCodeIn(text) {
		const m = String(text || "").match(MODEL_CODE_RE);
		return m ? m[1] : null;
	},

	/** Sibling rows: same page and same row band (engine 30px epsilon). */
	rowSiblings(item, ctx) {
		if (!ctx || !Array.isArray(ctx.siblings)) return [];
		return ctx.siblings.filter(
			(s) =>
				s &&
				s.sku !== item.sku &&
				s.pageNum === item.pageNum &&
				Math.abs((s.y || 0) - (item.y || 0)) <= ROW_TOLERANCE,
		);
	},

	categoryAspectViolation(cat, aspect) {
		const c = String(cat || "").toUpperCase();
		const a = Number(aspect);
		const compact =
			(typeof ImageTextGates !== "undefined" && ImageTextGates.COMPACT_CATS) ||
			COMPACT_CATS_FALLBACK;
		const wide =
			(typeof ImageTextGates !== "undefined" && ImageTextGates.WIDE_CATS) ||
			WIDE_CATS_FALLBACK;
		if (!Number.isFinite(a)) return { violation: false };
		if (compact.includes(c) && a > 1.9) return { violation: true };
		if (wide.includes(c) && a < 0.65) return { violation: true };
		return { violation: false };
	},

	/**
	 * Atomic reason classifier: structured evidence FIRST (_modelQuality.marketing,
	 * _imgTextWarnings.type, _outlierEvidence, grounding), Spanish string fallback
	 * for legacy warnings. Delegates to ImportGates.deriveReasonCode when present
	 * (Slice 1 owns the full warning map); local fallback covers the strategy
	 * classes deterministically.
	 * @param {Object} item
	 * @returns {string}
	 */
	deriveReasonCode(item) {
		if (!item) return "UNCLASSIFIED_YELLOW";
		if (
			typeof ImportGates !== "undefined" &&
			typeof ImportGates.deriveReasonCode === "function"
		) {
			return ImportGates.deriveReasonCode(item);
		}
		const mq = item._modelQuality;
		if (mq && mq.marketing) {
			if (mq.marketing.class === "switch-axis") return "SWITCH_IN_MODEL";
			if (
				mq.marketing.class === "puffery" ||
				mq.marketing.class === "marketing-only"
			)
				return "MODEL_MARKETING";
		}
		const itw = Array.isArray(item._imgTextWarnings)
			? item._imgTextWarnings
			: [];
		for (const w of itw) {
			const t = w && w.type;
			if (t === "color-ambiguous") return "COLOR_AMBIGUOUS";
			if (t === "color-mismatch") return "COLOR_MISMATCH";
			if (t === "category-aspect") return "ASPECT_MISMATCH";
			if (t === "cross-category" || t === "cross-brand") return "SHARED_IMAGE";
			if (t === "generic-model" || t === "ambiguous-model")
				return "MODEL_GENERIC_WORD";
			if (t === "truncated-model") return "MODEL_TRUNCATED";
		}
		if (item._outlierEvidence) return "OUTLIER_PRICE";
		if (item.grounded === false) {
			const reason = String(item.groundingReason || "");
			if (/vecina|neighbor/i.test(reason)) return "FOB_NEIGHBOR_ANCHOR";
			if (/alinead|misalign/i.test(reason)) return "FOB_UNALIGNED";
			return "FOB_NO_LITERAL_EVIDENCE";
		}
		const warnings = Array.isArray(item.warnings) ? item.warnings : [];
		for (const w of warnings) {
			const t = String(w || "");
			if (/palabras de marketing/i.test(t)) return "MODEL_MARKETING";
			if (/switch\/axis/i.test(t)) return "SWITCH_IN_MODEL";
			if (/truncado/i.test(t)) return "MODEL_TRUNCATED";
			if (/palabra genérica|modelo genérico/i.test(t))
				return "MODEL_GENERIC_WORD";
			if (/categoría\/fragmento de especificación/i.test(t))
				return "SPEC_FRAGMENT";
			if (/color de imagen ambiguo/i.test(t)) return "COLOR_AMBIGUOUS";
			if (/no coincide con el producto/i.test(t)) return "COLOR_MISMATCH";
			if (/imagen ancha|imagen angosta/i.test(t)) return "ASPECT_MISMATCH";
			if (/imagen compartida/i.test(t)) return "SHARED_IMAGE";
			if (/outlier de precio/i.test(t)) return "OUTLIER_PRICE";
			if (/fob sin evidencia literal/i.test(t))
				return "FOB_NO_LITERAL_EVIDENCE";
			if (/ancla de fila vecina/i.test(t)) return "FOB_NEIGHBOR_ANCHOR";
			if (/ancla no alineada/i.test(t)) return "FOB_UNALIGNED";
		}
		return "UNCLASSIFIED_YELLOW";
	},

	/** Literal price token of THIS row: matches fob, in row band, same column. */
	findLiteralPriceToken(item, rowEvidence) {
		const candidates = [];
		if (rowEvidence && Array.isArray(rowEvidence.textItems)) {
			for (const t of rowEvidence.textItems) {
				candidates.push({
					str: String((t && t.str) || ""),
					x: t && typeof t.x === "number" ? t.x : null,
					y: t && typeof t.y === "number" ? t.y : null,
					page: (t && t.page) || (rowEvidence && rowEvidence.page),
				});
			}
		}
		// The parser stores row prices in `anchors` (with rawLine/str), not in
		// textItems — scan both so literal-anchor-search can verify the FOB.
		if (rowEvidence && Array.isArray(rowEvidence.anchors)) {
			for (const a of rowEvidence.anchors) {
				candidates.push({
					str:
						(a && typeof a.rawLine === "string" ? a.rawLine : a && a.str) || "",
					x: a && typeof a.x === "number" ? a.x : null,
					y: a && typeof a.y === "number" ? a.y : null,
					page: (a && a.page) || (rowEvidence && rowEvidence.page),
				});
			}
		}
		if (!candidates.length) return null;
		const fob = parseFloat(item && item.fob);
		if (!Number.isFinite(fob)) return null;
		const rowY =
			typeof rowEvidence.rowTextY === "number" ? rowEvidence.rowTextY : null;
		const anchorX = typeof item.x === "number" ? item.x : null;
		for (const t of candidates) {
			const str = String((t && t.str) || "").trim();
			const val = parsePriceToken(str);
			if (val === null) continue;
			if (Math.abs(val - fob) >= 0.01) continue; // must be THIS row's price
			const dy = typeof t.y === "number" && rowY !== null ? t.y - rowY : 0;
			// The parser separates the price cell from the row text by a fixed
			// offset (the row's own groundingEvidence dy). Accept either the row
			// band OR the item's own y (the price anchor sits at the row's price
			// cell, ~36px below the text median on these layouts).
			const anchorDy =
				typeof t.y === "number" && typeof item.y === "number"
					? Math.abs(t.y - item.y)
					: 0;
			if (Math.abs(dy) > ROW_TOLERANCE && anchorDy > ROW_TOLERANCE) continue; // not in the row band
			if (
				anchorX !== null &&
				typeof t.x === "number" &&
				Math.abs(t.x - anchorX) > COLUMN_TOLERANCE
			)
				continue; // neighbor/fused cell
			return {
				str,
				x: t.x,
				page: t.page || (rowEvidence && rowEvidence.page),
				dy,
			};
		}
		return null;
	},

	/**
	 * 1. color-from-image (COLOR_MISMATCH): interior sample unambiguous (occupancy
	 * ≥ 35, single dominant, in color vocabulary, box-art heuristic off) → color =
	 * interior sample, declared color → variante. Evidence traces to the sample.
	 */
	colorFromImage(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "colorFromImage")) return null;
		const interior = this.interiorOf(item);
		if (!interior || typeof interior.name !== "string") return null;
		const occupancy =
			typeof interior.occupancy === "number"
				? interior.occupancy
				: interior.confidence;
		// Box-art / unreadable heuristic off — same unreadable rule as the gate:
		// UNKNOWN, MULTICOLOR, low confidence or low occupancy → WATCH, no change.
		if (
			interior.name === "UNKNOWN" ||
			interior.name === "MULTICOLOR" ||
			occupancy < 35 ||
			interior.confidence < 65
		)
			return null;
		const vocab = this.colorVocabulary(ctx);
		if (!vocab.has(String(interior.name).toUpperCase())) return null; // non-vocabulary interior
		const declared = this.firstDeclaredColor(item);
		if (!declared) return null;
		const clone = { ...item };
		clone.color = String(interior.name);
		const varParts = [String(item.variante || "").trim(), declared].filter(
			Boolean,
		);
		clone.variante = [...new Set(varParts)].join(" ").trim();
		return {
			item: clone,
			evidence: {
				remediated: "color-from-image",
				actual: String(interior.name),
				declared,
				occupancy,
				sampleRegion: "center-60%",
			},
		};
	},

	/**
	 * 2. variante-color-adoption (COLOR_AMBIGUOUS): variante names explicit colors
	 * that compatibly match the photo's top interior colors → intentional design.
	 */
	varianteColorAdoption(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "varianteColorAdoption"))
			return null;
		const interior = this.interiorOf(item);
		if (
			!interior ||
			!Array.isArray(interior.topColors) ||
			!interior.topColors.length
		)
			return null;
		const colorsFromVariante = this.colorTokensIn(item.variante);
		if (!colorsFromVariante.length) return null; // empty variante
		const families = this.familiesOfTokens(colorsFromVariante, ctx);
		if (!families.length) return null;
		const photoTopColors = [
			...new Set(interior.topColors.map((t) => t && t.name).filter(Boolean)),
		];
		if (!photoTopColors.length) return null;
		const compatible = families.every((fam) =>
			photoTopColors.some((top) => this.compatibleColor(fam, top, ctx)),
		);
		if (!compatible) return null; // contradictory variante
		return {
			item: { ...item },
			evidence: {
				remediated: "variante-color-adoption",
				colorsFromVariante,
				photoTopColors,
			},
		};
	},

	/**
	 * 3. literal-price-regrounding (OUTLIER_PRICE): literal currency/decimal token
	 * in the row band with alignment → real price tier. Never geometric-only.
	 */
	literalPriceRegrounding(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "literalPriceRegrounding"))
			return null;
		const token = this.findLiteralPriceToken(item, rowEvidence);
		if (!token) return null;
		const clone = { ...item };
		clone._priceGroundingLiteral = {
			text: token.str,
			page: token.page,
			dy: token.dy,
		};
		return {
			item: clone,
			evidence: {
				remediated: "literal-price-regrounding",
				groundingMode: "literal",
				text: token.str,
				page: token.page,
				dy: token.dy,
			},
		};
	},

	/**
	 * 4. literal-anchor-search (FOB_NO_LITERAL_EVIDENCE): price-like literal token
	 * aligned in the row band → grounded:true DERIVED from the literal token
	 * (never hardcoded). Fused-cell neighbors never promote.
	 */
	literalAnchorSearch(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "literalAnchorSearch"))
			return null;
		const token = this.findLiteralPriceToken(item, rowEvidence);
		if (!token) return null;
		const dx =
			typeof token.x === "number" && typeof item.x === "number"
				? token.x - item.x
				: 0;
		const clone = {
			...item,
			grounded: true,
			groundedFob: true,
			isGroundedPrice: true,
		};
		clone.groundingReason = "FOB verificado por ancla literal";
		clone.groundingEvidence = {
			groundingMode: "literal",
			page: token.page,
			anchorX: token.x,
			rowX: token.x,
			dx,
			dy: token.dy,
			price: parseFloat(item.fob) || null,
			text: token.str,
		};
		return {
			item: clone,
			evidence: {
				remediated: "literal-anchor-search",
				groundingMode: "literal",
				text: token.str,
				page: token.page,
				alignment: { dx, dy: token.dy },
			},
		};
	},

	/**
	 * 5. truncation-repair (MODEL_TRUNCATED): unclosed paren/brace whose closing
	 * token exists as a separate text item in the row band → repair.
	 */
	truncationRepair(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "truncationRepair")) return null;
		const modelo = String(item.modelo || "").trim();
		const closes = { "(": ")", "{": "}", "[": "]" };
		let missing = null;
		for (const open of Object.keys(closes)) {
			if (modelo.includes(open) && !modelo.includes(closes[open])) {
				missing = closes[open];
				break;
			}
		}
		if (!missing) return null;
		if (
			!rowEvidence ||
			!Array.isArray(rowEvidence.textItems) ||
			!rowEvidence.textItems.length
		)
			return null;
		const rowY =
			typeof rowEvidence.rowTextY === "number" ? rowEvidence.rowTextY : null;
		let found = false;
		for (const t of rowEvidence.textItems) {
			const str = String((t && t.str) || "").trim();
			if (str !== missing && !str.startsWith(missing)) continue;
			if (
				rowY !== null &&
				typeof t.y === "number" &&
				Math.abs(t.y - rowY) > ROW_TOLERANCE
			)
				continue;
			found = true;
			break;
		}
		if (!found) return null; // genuinely truncated in the source
		const after = modelo + missing;
		return {
			item: { ...item, modelo: after },
			evidence: { remediated: "truncation-repaired", before: modelo, after },
		};
	},

	/** Switch/axis token extraction (TextSanitizer.extractSwitchToken when present). */
	extractSwitchTokenLocal(modelo, ctx) {
		if (ctx && typeof ctx.switchToken === "function")
			return ctx.switchToken(modelo);
		const m = String(modelo || "").trim();
		if (!m) return null;
		const sw = m.match(/\bswitch(?:es)?\b/i);
		if (sw && sw.index !== undefined) {
			const before = m.slice(0, sw.index).trim();
			const words = before.split(/\s+/).filter(Boolean).slice(-2);
			return [...words, sw[0]].join(" ");
		}
		if (/\bmagnetic\b/i.test(m)) return "Magnetic";
		const hall = m.match(/\bhall\s*effect\b/i);
		if (hall) return hall[0];
		const axis = m.match(/\b[\w.-]*axis(?:es)?\b/i);
		if (axis) return axis[0];
		return null;
	},

	/** Real identity check for the remaining model: digits, noun or code. */
	hasModelIdentity(remaining, ctx) {
		const r = String(remaining || "").trim();
		if (!r) return false;
		if (/\d/.test(r)) return true;
		const nouns =
			(ctx && ctx.productNouns) ||
			(typeof TextSanitizer !== "undefined" &&
				TextSanitizer.PRODUCT_NOUN_WORDS) ||
			[];
		if (nouns.length) {
			const re = new RegExp("\\b(?:" + nouns.join("|") + ")\\b", "i");
			if (re.test(r)) return true;
		}
		return MODEL_CODE_RE.test(r);
	},

	/**
	 * 6. switch-to-variante (SWITCH_IN_MODEL): move the switch/axis token to
	 * variante (same pattern as sanitizeColorField) when the remaining model
	 * keeps a real identity (noun, code or digits).
	 */
	switchToVariante(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "switchToVariante")) return null;
		const modelo = String(item.modelo || "").trim();
		const token = this.extractSwitchTokenLocal(modelo, ctx);
		if (!token) return null;
		const remaining = modelo
			.replace(new RegExp("\\b" + escapeRe(token) + "\\b", "i"), "")
			.replace(/\s+/g, " ")
			.trim();
		if (!this.hasModelIdentity(remaining, ctx)) return null; // identity-less → stays
		const clone = { ...item };
		const varParts = [String(item.variante || "").trim(), token].filter(
			Boolean,
		);
		clone.variante = [...new Set(varParts)].join(" ").trim();
		clone.modelo = remaining;
		return {
			item: clone,
			evidence: {
				remediated: "switch-to-variante",
				moved: [token],
				to: "variante",
			},
		};
	},

	/**
	 * 7. row-context-disambiguation (MODEL_GENERIC_WORD): adopt a real product
	 * code from the row's other columns (variante → marca → cat) or a sibling row.
	 */
	rowContextDisambiguation(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "rowContextDisambiguation"))
			return null;
		const fields = [
			{ source: "sku", value: item.sku },
			{ source: "modelo", value: item.modelo },
			{ source: "variante", value: item.variante },
			{ source: "marca", value: item.marca },
			{ source: "cat", value: item.cat },
		];
		for (const f of fields) {
			const code = this.firstCodeIn(f.value);
			if (code) {
				return {
					item: { ...item, modelo: code },
					evidence: {
						remediated: "row-context-disambiguation",
						adopted: code,
						source: f.source,
					},
				};
			}
		}
		for (const sib of this.rowSiblings(item, ctx)) {
			const code = this.firstCodeIn(sib.modelo);
			if (code) {
				return {
					item: { ...item, modelo: code },
					evidence: {
						remediated: "row-context-disambiguation",
						adopted: code,
						source: "sibling-row",
					},
				};
			}
		}
		return null; // generic word has no identity on its own
	},

	/**
	 * 8. code-adoption (SPEC_FRAGMENT): adopt a real code from another row column
	 * or a same-row text item.
	 */
	codeAdoption(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "codeAdoption")) return null;
		const fields = [
			{ source: "sku", value: item.sku },
			{ source: "modelo", value: item.modelo },
			{ source: "variante", value: item.variante },
			{ source: "marca", value: item.marca },
			{ source: "cat", value: item.cat },
		];
		for (const f of fields) {
			const code = this.firstCodeIn(f.value);
			if (code) {
				return {
					item: { ...item, modelo: code },
					evidence: {
						remediated: "code-adoption",
						adopted: code,
						source: f.source,
					},
				};
			}
		}
		if (rowEvidence && Array.isArray(rowEvidence.textItems)) {
			for (const t of rowEvidence.textItems) {
				const code = this.firstCodeIn(t && t.str);
				if (code) {
					return {
						item: { ...item, modelo: code },
						evidence: {
							remediated: "code-adoption",
							adopted: code,
							source: "row-text",
						},
					};
				}
			}
		}
		for (const sib of this.rowSiblings(item, ctx)) {
			const code = this.firstCodeIn(sib.modelo);
			if (code) {
				return {
					item: { ...item, modelo: code },
					evidence: {
						remediated: "code-adoption",
						adopted: code,
						source: "sibling-row",
					},
				};
			}
		}
		return null;
	},

	/**
	 * 9. shared-image-reassign (ASPECT_MISMATCH / SHARED_IMAGE): the image is
	 * shared with a sibling whose category aspect fits; same brand + model
	 * identity proves a legit assignment artifact → reassign category, image-
	 * integrity gates re-run. Cross-brand sharing without identity fails closed.
	 */
	sharedImageReassign(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "sharedImageReassign"))
			return null;
		const aspect =
			typeof item._imgAspect === "number"
				? item._imgAspect
				: typeof item.imgAspect === "number"
					? item.imgAspect
					: null;
		if (aspect === null || !Number.isFinite(aspect)) return null;
		const hash = imageHashOf(item.img);
		if (!hash) return null;
		const siblings = ctx && Array.isArray(ctx.siblings) ? ctx.siblings : [];
		const myBrand = String(item.marca || "").toUpperCase();
		const myModel = String(item.modelo || "")
			.trim()
			.toLowerCase();
		for (const sib of siblings) {
			if (!sib || sib.sku === item.sku) continue;
			if (imageHashOf(sib.img) !== hash) continue;
			if (String(sib.marca || "").toUpperCase() !== myBrand) continue; // cross-brand → fail closed
			const sibModel = String(sib.modelo || "")
				.trim()
				.toLowerCase();
			if (
				!myModel ||
				!sibModel ||
				(myModel !== sibModel &&
					!myModel.includes(sibModel) &&
					!sibModel.includes(myModel))
			)
				continue;
			const sibCat = String(sib.cat || "").toUpperCase();
			if (this.categoryAspectViolation(sibCat, aspect).violation) continue; // sibling aspect must fit the image
			return {
				item: { ...item, cat: sibCat },
				evidence: {
					remediated: "shared-image-reassign",
					reassignedToCategory: sibCat,
					siblingSku: sib.sku,
					imageHash: hash,
				},
			};
		}
		return null;
	},

	/**
	 * 10. legacy-only-clean (LEGACY_ONLY_CLEAN): the item is flagged YELLOW only
	 * by a STALE legacy warning (e.g. "Modelo truncado") that the extraction
	 * already fixed — sourceStatus GREEN, no structured image/marketing/outlier
	 * evidence, and the model has NO actually-unclosed bracket. Clearing the
	 * stale warning and re-verifying yields GREEN. Structural and generalizable:
	 * it never trusts the warning, it re-checks the model for a real unclosed
	 * bracket and requires clean structured evidence.
	 */
	legacyOnlyClean(item, rowEvidence, ctx) {
		if (!item || this.alreadyRemediated(item, "legacyOnlyClean")) return null;
		if (String(item.sourceStatus || "") !== "GREEN") return null;
		if (item._outlierEvidence) return null;
		if (item.grounded === false) return null;
		const itw = Array.isArray(item._imgTextWarnings)
			? item._imgTextWarnings
			: [];
		if (itw.length) return null; // real structured evidence present → not legacy-only
		const mq = item._modelQuality;
		if (
			mq &&
			mq.marketing &&
			(mq.marketing.class === "puffery" ||
				mq.marketing.class === "marketing-only")
		)
			return null; // real marketing issue → not clean
		const model = String(item.modelo || "");
		// Structural check: the model must NOT have a real unclosed bracket.
		if (/[({[]/.test(model) && !/[)}\]]/.test(model)) return null; // genuinely truncated
		const warnings = Array.isArray(item.warnings) ? item.warnings : [];
		const stale = warnings.filter((w) => /truncad/i.test(String(w)));
		if (!stale.length) return null; // nothing stale to clear
		const clone = {
			...item,
			warnings: warnings.filter((w) => !/truncad/i.test(String(w))),
		};
		return {
			item: clone,
			evidence: {
				remediated: "legacy-only-clean",
				sourceStatus: "GREEN",
				staleWarning: stale[0],
				model,
			},
		};
	},

	/**
	 * Per-strategy already-remediated detection (no global flag): evidence key
	 * present, variante already carries the moved color/token, code already
	 * adopted, literal grounding already groundingMode:'literal'.
	 * @param {Object} item
	 * @param {string} strategyKey
	 * @returns {boolean}
	 */
	alreadyRemediated(item, strategyKey) {
		if (!item) return false;
		const ev = item.remediationEvidence;
		switch (strategyKey) {
			case "colorFromImage":
				return !!(ev && ev.remediated === "color-from-image");
			case "varianteColorAdoption":
				return (
					!!(ev && ev.remediated === "variante-color-adoption") ||
					!!item._colorAmbiguityResolved
				);
			case "literalPriceRegrounding":
				return (
					!!(ev && ev.remediated === "literal-price-regrounding") ||
					!!item._priceGroundingLiteral
				);
			case "literalAnchorSearch": {
				if (ev && ev.remediated === "literal-anchor-search") return true;
				return !!(
					item.groundingEvidence &&
					item.groundingEvidence.groundingMode === "literal"
				);
			}
			case "truncationRepair":
				return !!(ev && ev.remediated === "truncation-repaired");
			case "switchToVariante": {
				if (ev && ev.remediated === "switch-to-variante") return true;
				const modelToken = this.extractSwitchTokenLocal(
					String(item.modelo || ""),
					{},
				);
				const varToken = this.extractSwitchTokenLocal(
					String(item.variante || ""),
					{},
				);
				return !!varToken && !modelToken; // variante carries the token, modelo no longer does
			}
			case "rowContextDisambiguation":
				return !!(ev && ev.remediated === "row-context-disambiguation");
			case "codeAdoption":
				return !!(ev && ev.remediated === "code-adoption");
			case "sharedImageReassign":
				return !!(ev && ev.remediated === "shared-image-reassign");
			case "legacyOnlyClean":
				return !!(ev && ev.remediated === "legacy-only-clean");
			default:
				return false;
		}
	},

	/**
	 * Mandatory remediationEvidence contract (fail-closed): every promotion
	 * carries non-empty evidence whose keys are the stable English names and
	 * whose values trace to the exact source artifact the strategy read. Missing
	 * or fabricated evidence → pipeline defect, never promoted.
	 * @param {Object} item
	 * @returns {boolean}
	 */
	assertPromotionEvidence(item) {
		if (!item || item.status !== "GREEN") return false;
		const ev = item.remediationEvidence;
		if (!ev || typeof ev !== "object" || Array.isArray(ev) || !ev.remediated)
			return false;
		switch (ev.remediated) {
			case "color-from-image": {
				const interior = this.interiorOf(item);
				if (!interior || typeof interior.name !== "string") return false;
				if (
					String(ev.actual || "").toUpperCase() !==
					String(interior.name).toUpperCase()
				)
					return false; // fabricated actual
				const occupancy =
					typeof interior.occupancy === "number"
						? interior.occupancy
						: interior.confidence;
				return (
					ev.occupancy === occupancy &&
					ev.sampleRegion === "center-60%" &&
					!!ev.declared
				);
			}
			case "variante-color-adoption": {
				const interior = this.interiorOf(item);
				if (
					!interior ||
					!Array.isArray(interior.topColors) ||
					!interior.topColors.length
				)
					return false;
				const tops = interior.topColors.map((t) => t && t.name).filter(Boolean);
				const evTops = Array.isArray(ev.photoTopColors)
					? ev.photoTopColors
					: [];
				if (!evTops.length || evTops.join("|") !== tops.join("|")) return false;
				return (
					Array.isArray(ev.colorsFromVariante) &&
					ev.colorsFromVariante.length > 0
				);
			}
			case "literal-price-regrounding": {
				const gl = item._priceGroundingLiteral;
				if (!gl || !gl.text) return false;
				return (
					ev.groundingMode === "literal" &&
					ev.text === gl.text &&
					ev.page === gl.page
				);
			}
			case "literal-anchor-search": {
				const g = item.groundingEvidence;
				if (!g || g.groundingMode !== "literal" || !g.text) return false;
				return (
					ev.groundingMode === "literal" &&
					ev.text === g.text &&
					ev.page === g.page
				);
			}
			case "truncation-repaired":
				return (
					!!ev.before && !!ev.after && ev.after === String(item.modelo || "")
				);
			case "switch-to-variante": {
				const moved = Array.isArray(ev.moved) ? ev.moved : [];
				if (!moved.length || ev.to !== "variante") return false;
				const varLower = String(item.variante || "").toLowerCase();
				const modelLower = String(item.modelo || "").toLowerCase();
				return moved.every(
					(t) =>
						varLower.includes(String(t).toLowerCase()) &&
						!modelLower.includes(String(t).toLowerCase()),
				);
			}
			case "row-context-disambiguation":
			case "code-adoption":
				return (
					!!ev.adopted &&
					String(item.modelo || "")
						.toLowerCase()
						.includes(String(ev.adopted).toLowerCase())
				);
			case "shared-image-reassign":
				return (
					!!ev.reassignedToCategory &&
					String(item.cat || "").toUpperCase() ===
						String(ev.reassignedToCategory).toUpperCase() &&
					!!ev.siblingSku &&
					typeof ev.imageHash === "string"
				);
			case "legacy-only-clean":
				return (
					ev.sourceStatus === "GREEN" &&
					String(item.sourceStatus || "") === "GREEN" &&
					ev.model === String(item.modelo || "") &&
					typeof ev.staleWarning === "string" &&
					// the model must not have a real unclosed bracket (trace to artifact)
					!(
						/[({[]/.test(String(item.modelo || "")) &&
						!/[)}\]]/.test(String(item.modelo || ""))
					)
				);
			default:
				return false; // unknown strategy → fail closed
		}
	},

	/**
	 * Bounded-irremediable declaration: every non-GREEN item that cannot be fixed
	 * from source data stays flagged with its atomic reason and is declared
	 * bounded-irremediable (class + why) for the human-review report. Never
	 * promoted, never silently accepted.
	 * @param {Array} items
	 * @returns {Array} same array with _boundedIrremediable attached
	 */
	classifyRemaining(items) {
		const list = Array.isArray(items) ? items : [];
		for (const item of list) {
			if (!item || item.status === "GREEN") continue;
			const reason = this.deriveReasonCode(item);
			const mq = item._modelQuality && item._modelQuality.marketing;
			let cls;
			let why;
			switch (reason) {
				case "MODEL_MARKETING":
					cls =
						mq && mq.class === "puffery"
							? "model-marketing-puffery"
							: "model-marketing";
					why = "Puffery stack sin nombre de producto ni código";
					break;
				case "COLOR_MISMATCH":
					cls = "color-mismatch";
					why =
						"Foto sin color dominante en vocabulario (ocupación < 35% o box-art)";
					break;
				case "COLOR_AMBIGUOUS":
					cls = "color-ambiguous";
					why = "Variante sin colores explícitos o contradictoria con la foto";
					break;
				case "OUTLIER_PRICE":
					cls = "outlier-price";
					why = "Sin token literal de precio en la banda de fila";
					break;
				case "FOB_NO_LITERAL_EVIDENCE":
				case "FOB_UNALIGNED":
					cls = "fob-literal";
					why = "Sin token literal de precio en la fila";
					break;
				case "MODEL_TRUNCATED":
					cls = "model-truncated";
					why = "Truncado real del origen (sin token de cierre en la banda)";
					break;
				case "SWITCH_IN_MODEL":
					cls = "switch-in-model";
					why = "Modelo sin identidad restante tras quitar el token switch";
					break;
				case "MODEL_GENERIC_WORD":
					cls = "model-generic-word";
					why = "Sin código real en columnas de la fila ni filas hermanas";
					break;
				case "SPEC_FRAGMENT":
					cls = "spec-fragment";
					why = "Sin código real en la fila";
					break;
				case "ASPECT_MISMATCH":
				case "SHARED_IMAGE":
					cls = "shared-image";
					why = "Sharing cross-brand sin identidad marca+modelo+categoría";
					break;
				default:
					cls = String(reason || "unclassified").toLowerCase();
					why = "Sin estrategia aplicable ni evidencia de origen";
			}
			item._boundedIrremediable = {
				class: cls,
				atomicReason: reason,
				whyNotRemediable: why,
			};
		}
		return list;
	},

	/**
	 * Delta-only re-verify: full item-level gate stack over the remediated items
	 * only (validateItem → image-text → assignment). validateCatalogStats runs
	 * once per pass at the loop level (corpus-level O(n log n)).
	 * @param {Array} items
	 * @returns {Array} verified products
	 */
	remediateVerify(items) {
		const products = Array.isArray(items) ? items.slice() : [];
		if (
			typeof CatalogValidator !== "undefined" &&
			typeof CatalogValidator.runFullValidation === "function"
		) {
			CatalogValidator.runFullValidation(products);
		}
		// Re-run the price-statistics layer so a literal-grounded outlier
		// (_priceGroundingLiteral) degrades to advisory instead of YELLOW.
		if (
			typeof CatalogValidator !== "undefined" &&
			typeof CatalogValidator.validateCatalogStats === "function"
		) {
			CatalogValidator.validateCatalogStats(products);
		}
		if (
			typeof ImageTextGates !== "undefined" &&
			typeof ImageTextGates.runAll === "function"
		) {
			const r = ImageTextGates.runAll(products);
			products.length = 0;
			products.push(...r.products);
		}
		if (
			typeof CatalogAssignmentGates !== "undefined" &&
			typeof CatalogAssignmentGates.runAll === "function"
		) {
			const r = CatalogAssignmentGates.runAll(products);
			products.length = 0;
			products.push(...r.products);
		}
		return products;
	},

	/** Shared strategy context for a pass (siblings, vocabularies). */
	buildContext(products) {
		return {
			siblings: Array.isArray(products) ? products : [],
			colorVocabulary:
				(typeof ImageTextGates !== "undefined" &&
					ImageTextGates.COLOR_KEEP_WORDS) ||
				COLOR_WORDS_FALLBACK,
			colorFamily:
				(typeof ImageTextGates !== "undefined" &&
					ImageTextGates.COLOR_FAMILY) ||
				COLOR_FAMILY_FALLBACK,
			compatible:
				(typeof ImageTextGates !== "undefined" &&
					ImageTextGates.COLOR_COMPATIBLE) ||
				COLOR_COMPATIBLE_FALLBACK,
			productNouns:
				(typeof TextSanitizer !== "undefined" &&
					TextSanitizer.PRODUCT_NOUN_WORDS) ||
				[],
			switchToken:
				typeof TextSanitizer !== "undefined" &&
				typeof TextSanitizer.extractSwitchToken === "function"
					? TextSanitizer.extractSwitchToken.bind(TextSanitizer)
					: null,
		};
	},

	/**
	 * Per-item loop shell: diagnose → remediate (config-gated) → delta-only
	 * re-verify → promote-or-stay. Promotion = full gate pass AND valid
	 * remediationEvidence; else stays flagged (bounded-irremediable handled by
	 * classifyRemaining at the loop level).
	 * @param {Array} products
	 * @param {Object} rowEvidenceMap - sku → _rowEvidence side channel
	 * @param {Object} config - overrides over DEFAULT_REMEDIATION_CONFIG
	 * @returns {{products:Array, ledger:Array, stats:Object, remediatedCount:number}}
	 */
	runRemediationPass(products, rowEvidenceMap, config) {
		const list = Array.isArray(products) ? products.slice() : [];
		let cfg = { enabled: true, strategies: {} };
		if (
			typeof RemediationConfig !== "undefined" &&
			typeof RemediationConfig.deepMerge === "function"
		) {
			cfg = RemediationConfig.deepMerge(
				RemediationConfig.DEFAULT_REMEDIATION_CONFIG,
				config || {},
			);
		} else if (config && typeof config === "object") {
			cfg = {
				enabled: config.enabled !== false,
				strategies: config.strategies || {},
			};
		}
		const statsOf = (arr) => {
			const green = arr.filter((p) => p && p.status === "GREEN").length;
			const yellow = arr.filter((p) => p && p.status === "YELLOW").length;
			const red = arr.filter((p) => p && p.status === "RED").length;
			return {
				total: arr.length,
				green,
				yellow,
				red,
				greenPct: Math.round((green / Math.max(1, arr.length)) * 100),
			};
		};
		if (cfg.enabled !== true) {
			return {
				products: list,
				ledger: [],
				stats: statsOf(list),
				remediatedCount: 0,
			};
		}
		const rowMap =
			rowEvidenceMap && typeof rowEvidenceMap === "object"
				? rowEvidenceMap
				: {};
		const ctx = this.buildContext(list);
		const ledger = [];
		const out = [];
		let remediatedCount = 0;
		for (const item of list) {
			if (!item || item.status === "GREEN") {
				out.push(item);
				continue;
			}
			const reason = this.deriveReasonCode(item);
			const key = REASON_TO_STRATEGY[reason] || null;
			if (
				!key ||
				cfg.strategies[key] === false ||
				this.alreadyRemediated(item, key)
			) {
				out.push(item);
				continue;
			}
			let rowEvidence = rowMap[item.sku] || null;
			// Slice 3: the batch export embeds _rowEvidence per item; use it when
			// the caller did not build a SKU->rowEvidence map.
			if (!rowEvidence && item && item._rowEvidence) {
				rowEvidence = item._rowEvidence;
			}
			const result = this.strategies[key](item, rowEvidence, ctx);
			if (!result) {
				out.push(item);
				continue;
			}
			const verified = this.remediateVerify([result.item]);
			const promoted = verified[0];
			if (promoted && promoted.status === "GREEN") {
				// Attach evidence BEFORE the contract check: assertPromotionEvidence
				// validates the item's own remediationEvidence, so the evidence
				// must be on the item first (Slice 3 loop-orchestration fix).
				promoted.remediationEvidence = result.evidence;
			}
			// Partial remediation: the strategy resolved THIS reason but the item
			// is still YELLOW for another one. Keep the verified item (with the
			// resolved reason gone) AND record the partial evidence so the next
			// pass targets the next atomic reason instead of re-running this one.
			if (promoted && promoted.status !== "GREEN" && result.evidence) {
				promoted.remediationEvidence = {
					...result.evidence,
					partial: true,
					resolvedReason: reason,
				};
				ledger.push({
					sku: item.sku,
					originalReason: reason,
					class: String(reason).toLowerCase(),
					strategy: key,
					outcome: "partial",
					evidence: result.evidence,
					iteration: 1,
				});
				out.push(promoted);
				continue;
			}
			if (
				promoted &&
				promoted.status === "GREEN" &&
				this.assertPromotionEvidence(promoted)
			) {
				remediatedCount++;
				ledger.push({
					sku: item.sku,
					originalReason: reason,
					class: String(reason).toLowerCase(),
					strategy: key,
					outcome: "promoted",
					evidence: result.evidence,
					iteration: 1,
				});
				out.push(promoted);
			} else {
				ledger.push({
					sku: item.sku,
					originalReason: reason,
					class: String(reason).toLowerCase(),
					strategy: key,
					outcome: "stayed",
					evidence: { atomicReason: reason },
					iteration: 1,
				});
				out.push(item);
			}
		}
		return { products: out, ledger, stats: statsOf(out), remediatedCount };
	},
};

// Strategy registry — bound arrow aliases so `this` is always Remediation
// regardless of how the strategy is invoked.
Remediation.strategies = {
	colorFromImage: (item, rowEvidence, ctx) =>
		Remediation.colorFromImage(item, rowEvidence, ctx),
	varianteColorAdoption: (item, rowEvidence, ctx) =>
		Remediation.varianteColorAdoption(item, rowEvidence, ctx),
	literalPriceRegrounding: (item, rowEvidence, ctx) =>
		Remediation.literalPriceRegrounding(item, rowEvidence, ctx),
	literalAnchorSearch: (item, rowEvidence, ctx) =>
		Remediation.literalAnchorSearch(item, rowEvidence, ctx),
	truncationRepair: (item, rowEvidence, ctx) =>
		Remediation.truncationRepair(item, rowEvidence, ctx),
	switchToVariante: (item, rowEvidence, ctx) =>
		Remediation.switchToVariante(item, rowEvidence, ctx),
	rowContextDisambiguation: (item, rowEvidence, ctx) =>
		Remediation.rowContextDisambiguation(item, rowEvidence, ctx),
	codeAdoption: (item, rowEvidence, ctx) =>
		Remediation.codeAdoption(item, rowEvidence, ctx),
	sharedImageReassign: (item, rowEvidence, ctx) =>
		Remediation.sharedImageReassign(item, rowEvidence, ctx),
	legacyOnlyClean: (item, rowEvidence, ctx) =>
		Remediation.legacyOnlyClean(item, rowEvidence, ctx),
};

if (typeof window !== "undefined") window.Remediation = Remediation;
if (typeof module !== "undefined") module.exports = Remediation;
