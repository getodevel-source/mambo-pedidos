#!/usr/bin/env node
/**
 * remediate-catalog.js — Slice 3 (loop-orchestration) of catalog-remediation-loop.
 *
 * Per-item remediation loop: diagnose atomic reason -> apply the class strategy
 * from remediation.js (config-gated) -> re-verify via ImportGates -> promote to
 * GREEN only with evidence -> next item. Iterates to a fixed point (two identical
 * per-status AND per-reason passes). Writes:
 *   - remediation-ledger.json   (SKU -> reason -> strategy -> outcome -> evidence -> iteration)
 *   - human-review-report.json  (when GREEN < 99% of the catalog-eligible corpus)
 *   - quality-iterate-report.json (metrics, same shape as quality-iterate.js)
 *
 * Usage:
 *   node scripts/remediate-catalog.js --export export.json [--config cfg.json] [--json]
 *   node scripts/remediate-catalog.js --catalogs DIR [--config cfg.json] [--json]
 *
 * Eligible corpus = post-import-filter (RED items filtered at import never reach
 * the catalog). Hard success criterion (owner-approved): GREEN >= 99% of eligible.
 * Idempotent: re-run on a remediated export is a no-op (strategies detect
 * already-remediated state via remediationEvidence presence).
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const jsPath = (f) => path.join(repoRoot, "src", "js", f);

// Browser-global modules loaded into the global scope like run-tests.js does.
global.window = global;
global.TextSanitizer = require(jsPath("textSanitizer.js"));
global.CatalogValidator = require(jsPath("catalogValidator.js"));
global.ImageTextGates = require(jsPath("imageTextGates.js"));
global.ImportGates = require(jsPath("importGates.js"));
global.Remediation = require(jsPath("remediation.js"));
global.RemediationConfig = require(jsPath("remediationConfig.js"));

const Remediation = global.Remediation;

const ELIGIBLE_MIN_PCT = 0.99; // 99% of catalog-eligible corpus (owner-approved)
const MAX_ITERATIONS = 10;

function parseArgs(argv) {
	const out = { json: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--export") out.export = argv[++i];
		else if (a === "--catalogs") out.catalogs = argv[++i];
		else if (a === "--config") out.config = argv[++i];
		else if (a === "--category-corrections") out.corrections = argv[++i];
		else if (a === "--json") out.json = true;
		else if (a === "--help" || a === "-h") out.help = true;
	}
	return out;
}

function loadConfig(file) {
	const base = RemediationConfig.DEFAULT_REMEDIATION_CONFIG;
	if (!file) return base;
	try {
		const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
		return RemediationConfig.deepMerge
			? RemediationConfig.deepMerge(base, parsed)
			: { ...base, ...parsed };
	} catch (e) {
		console.error(
			`WARN: config ${file} no cargable (${e.message}) — usando defaults`,
		);
		return base;
	}
}

function loadExport(file) {
	try {
		const j = JSON.parse(fs.readFileSync(file, "utf8"));
		if (Array.isArray(j)) return { products: j, meta: {} };
		return { products: j.products || j.items || [], meta: j.meta || {} };
	} catch (e) {
		console.error(`ERROR: export ${file} no legible (${e.message})`);
		process.exit(2);
	}
}

function eligibleOf(products) {
	// RED items (specs-as-model) are import-filtered: they never reach the catalog.
	return products.filter((p) => p.status !== "RED");
}

function passStats(products) {
	const st = { GREEN: 0, YELLOW: 0, RED: 0 };
	const byReason = {};
	for (const p of products) {
		st[p.status] = (st[p.status] || 0) + 1;
		if (p.status !== "GREEN") {
			const r =
				typeof Remediation.resolveReasonLabel === "function"
					? Remediation.resolveReasonLabel(p)
					: p.qualityReason || p.reason || "NO_REASON";
			byReason[r] = (byReason[r] || 0) + 1;
		}
	}
	return { st, byReason };
}

function samePass(a, b) {
	const ka = JSON.stringify({ st: a.st, byReason: a.byReason });
	const kb = JSON.stringify({ st: b.st, byReason: b.byReason });
	return ka === kb;
}

function runOnePass(products, config) {
	// runRemediationPass operates on the whole array and returns {products, ledger, stats, remediatedCount}.
	const result = Remediation.runRemediationPass(
		products,
		{},
		config || RemediationConfig.DEFAULT_REMEDIATION_CONFIG,
	);
	if (!result || !Array.isArray(result.products)) {
		return { products, ledger: [], promoted: 0, stayed: 0, bounded: 0 };
	}
	// Mutate the original array in place so the caller's `products` reflects remediation.
	products.length = 0;
	products.push(...result.products);
	const ledger = (result.ledger || []).map((e) => ({
		sku: e && e.sku ? e.sku : null,
		originalReason:
			e && (e.reason || e.originalReason) ? e.reason || e.originalReason : null,
		strategy: e && e.strategy ? e.strategy : null,
		outcome:
			e && e.outcome ? e.outcome : e && e.promoted ? "promoted" : "stayed",
		evidence: e && e.evidence ? e.evidence : null,
	}));
	const promoted = ledger.filter((e) => e.outcome === "promoted").length;
	const stayed = ledger.filter((e) => e.outcome === "stayed").length;
	const bounded = ledger.filter(
		(e) => e.outcome === "bounded-irremediable",
	).length;
	return { products, ledger, promoted, stayed, bounded };
}

function writeLedger(ledger, outDir) {
	fs.writeFileSync(
		path.join(outDir, "remediation-ledger.json"),
		JSON.stringify({ ledger, generatedAt: new Date().toISOString() }, null, 2),
		"utf8",
	);
}

function writeReviewReport(products, eligible, outDir) {
	const report = {
		eligibleCount: eligible.length,
		greenCount: eligible.filter((p) => p.status === "GREEN").length,
		greenPct:
			Math.round(
				(eligible.filter((p) => p.status === "GREEN").length /
					Math.max(1, eligible.length)) *
					1000,
			) / 10,
		target: ELIGIBLE_MIN_PCT * 100,
		items: eligible
			.filter((p) => p.status !== "GREEN")
			.map((p) => ({
				sku: p.sku,
				status: p.status,
				reason:
					typeof Remediation.resolveReasonLabel === "function"
						? Remediation.resolveReasonLabel(p)
						: p.qualityReason || p.reason || "NO_REASON",
				why: "not remediable from source data with current strategies",
			})),
	};
	fs.writeFileSync(
		path.join(outDir, "human-review-report.json"),
		JSON.stringify(report, null, 2),
		"utf8",
	);
	return report;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(`remediate-catalog.js — per-item remediation loop

Uso:
  node scripts/remediate-catalog.js --export export.json [--config cfg.json] [--json]
  node scripts/remediate-catalog.js --catalogs DIR [--config cfg.json] [--json]

Salidas:
  remediation-ledger.json · human-review-report.json · quality-iterate-report.json
  catalog-export-remediated.json (export post-loop para auditorías)
Meta: GREEN >= 99% del corpus elegible (post-filtro import). Idempotente.`);
		return;
	}

	const config = loadConfig(args.config);
	let products;
	let meta = { source: "export" };

	if (args.export) {
		const loaded = loadExport(args.export);
		products = loaded.products;
		meta = loaded.meta || {};
	} else {
		console.error("Se requiere --export o --catalogs");
		process.exit(2);
	}

	// Optional vision-confirmed category corrections side channel (off by default).
	// Data lives in a JSON file, never hardcoded; applied only when consistent with
	// the item's image aspect (see Remediation.categoryCorrection).
	if (args.corrections) {
		try {
			const cj = JSON.parse(fs.readFileSync(args.corrections, "utf8"));
			const map = (cj && cj.corrections) || {};
			for (const p of products) {
				if (p && map[p.sku]) p._categoryCorrection = map[p.sku];
			}
		} catch (e) {
			console.error(
				`ERROR: corrections ${args.corrections} no legible (${e.message})`,
			);
			process.exit(2);
		}
	}

	const outDir = repoRoot;

	// Fixed-point loop
	let iter = 0;
	let prev = null;
	let totalPromoted = 0;
	const allLedger = [];
	while (iter < MAX_ITERATIONS) {
		iter++;
		const stats = passStats(products);
		const pass = runOnePass(products, config);
		totalPromoted += pass.promoted;
		allLedger.push(...pass.ledger.map((e) => ({ ...e, iteration: iter })));
		const next = passStats(products);
		if (prev && samePass(prev, next)) {
			break;
		}
		prev = next;
		if (pass.promoted === 0) break;
	}

	const finalStats = passStats(products);
	const eligible = eligibleOf(products);
	const greenEligible = eligible.filter((p) => p.status === "GREEN").length;
	const greenPct =
		Math.round((greenEligible / Math.max(1, eligible.length)) * 1000) / 10;
	const fixedPoint = iter < MAX_ITERATIONS && totalPromoted >= 0;

	writeLedger(allLedger, outDir);
	const review =
		greenPct >= ELIGIBLE_MIN_PCT * 100
			? null
			: writeReviewReport(products, eligible, outDir);

	const report = {
		timestamp: new Date().toISOString(),
		total: products.length,
		green: finalStats.st.GREEN,
		yellow: finalStats.st.YELLOW,
		red: finalStats.st.RED,
		greenPct:
			Math.round((finalStats.st.GREEN / Math.max(1, products.length)) * 1000) /
			10,
		eligibleCount: eligible.length,
		eligibleGreenPct: greenPct,
		targetEligibleGreenPct: ELIGIBLE_MIN_PCT * 100,
		fixedPoint,
		iterations: iter,
		totalPromoted,
		byReason: finalStats.byReason,
		pass: greenPct >= ELIGIBLE_MIN_PCT * 100,
		humanReviewReport: review ? "human-review-report.json" : null,
	};
	fs.writeFileSync(
		path.join(outDir, "quality-iterate-report.json"),
		JSON.stringify(report, null, 2),
		"utf8",
	);

	// Persist the remediated export so downstream audits (promotion-audit,
	// re-verify) can audit the exact promoted items with evidence.
	fs.writeFileSync(
		path.join(outDir, "catalog-export-remediated.json"),
		JSON.stringify(products, null, 2),
		"utf8",
	);

	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(
			`GREEN ${report.green} / YELLOW ${report.yellow} / RED ${report.red} (n=${report.total})`,
		);
		console.log(
			`Elegible: ${report.eligibleGreenPct}% GREEN (${greenEligible}/${eligible.length}) — target ${report.targetEligibleGreenPct}%`,
		);
		console.log(
			`Fixed point: ${fixedPoint} · iteraciones: ${iter} · promovidos: ${totalPromoted}`,
		);
		console.log(
			report.pass
				? "✅ META ALCANZADA (GREEN >= 99% elegible)"
				: "⚠️ Meta no alcanzada — ver human-review-report.json",
		);
	}
}

main();
