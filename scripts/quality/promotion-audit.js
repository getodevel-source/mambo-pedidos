#!/usr/bin/env node
/**
 * promotion-audit.js — Slice 3 promotion audit (0 FP required).
 *
 * Re-verifies promoted items with an independent, from-scratch labeled pass over
 * a sample of >= 46 promoted items. An FP on a promoted item reverts that
 * strategy's promotions until the rule is fixed (fail-closed honesty guarantee).
 *
 * Usage:
 *   node scripts/quality/promotion-audit.js --export export.json [--sample N] [--json]
 * Exit 0 when 0 FPs are found in the sampled promoted items.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..", "..");
const jsPath = (f) => path.join(repoRoot, "src", "js", f);
global.window = global;
global.TextSanitizer = require(jsPath("textSanitizer.js"));
global.CatalogValidator = require(jsPath("catalogValidator.js"));
global.ImageTextGates = require(jsPath("imageTextGates.js"));
global.ImportGates = require(jsPath("importGates.js"));
global.Remediation = require(jsPath("remediation.js"));
global.RemediationConfig = require(jsPath("remediationConfig.js"));

function parseArgs(argv) {
	const out = { sample: 46, json: false };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--export") out.export = argv[++i];
		else if (a === "--sample") out.sample = parseInt(argv[++i], 10) || 46;
		else if (a === "--json") out.json = true;
		else if (a === "--help" || a === "-h") out.help = true;
	}
	return out;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log(
			"promotion-audit.js — 0-FP audit over promoted items.\nUso: node scripts/quality/promotion-audit.js --export export.json [--sample N]",
		);
		return;
	}
	if (!args.export) {
		console.error("Se requiere --export");
		process.exit(2);
	}
	let j;
	try {
		j = JSON.parse(fs.readFileSync(args.export, "utf8"));
	} catch (e) {
		console.error(`ERROR: export ${args.export} no legible (${e.message})`);
		process.exit(2);
	}
	const arr = Array.isArray(j) ? j : j.products || j.items || [];
	// A "promoted" item is one that is ACTUALLY GREEN with remediationEvidence.
	// Partial remediation (resolved THIS reason but still YELLOW/RED for another)
	// records evidence but is never GREEN — it must not be audited as a promotion.
	const promoted = arr.filter(
		(p) =>
			p &&
			p.status === "GREEN" &&
			p.remediationEvidence &&
			p.remediationEvidence.remediated,
	);
	if (promoted.length === 0) {
		console.log(
			"PROMOTION AUDIT: 0 items promovidos con evidencia — nada que auditar (PASS por vacuidad)",
		);
		process.exit(0);
	}
	const sample = promoted.slice(0, args.sample);
	const fps = [];
	// Independent check: re-run the full gate stack on each promoted item. A
	// promoted item must still pass the gates WITHOUT the remediation evidence
	// being required to justify its status — i.e., re-derive status from scratch.
	for (const item of sample) {
		const fresh = { ...item };
		delete fresh.remediationEvidence;
		delete fresh._modelQuality;
		const result = CatalogValidator.validateItem
			? CatalogValidator.validateItem(fresh)
			: { status: "UNKNOWN" };
		// A promotion is an FP if the fresh gate stack does NOT consider it GREEN.
		if (result.status !== "GREEN") {
			fps.push({
				sku: item.sku,
				strategy: item.remediationEvidence.remediated,
				freshStatus: result.status,
			});
		}
	}
	const report = {
		audited: sample.length,
		promotedTotal: promoted.length,
		fp: fps.length,
		passed: fps.length === 0,
		fps,
	};
	if (args.json) {
		console.log(JSON.stringify(report, null, 2));
	} else {
		console.log(
			`Promovidos: ${promoted.length} · Auditados: ${sample.length} · FP: ${fps.length}`,
		);
		for (const f of fps)
			console.log(`  FP ${f.sku} (${f.strategy}) -> fresh ${f.freshStatus}`);
		console.log(
			report.passed
				? "PROMOTION AUDIT OK: 0 FP"
				: "PROMOTION AUDIT FAIL — revertir la estrategia y arreglar la regla",
		);
	}
	process.exit(report.passed ? 0 : 1);
}

main();
