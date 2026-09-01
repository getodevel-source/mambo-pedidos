/**
 * Workflow "cargar todos los catálogos": corre export-catalog-batch.js sobre
 * la carpeta de catálogos reales y muestra el reporte completo por catálogo
 * (productos, imágenes, gates GREEN/YELLOW/RED y totales).
 *
 * Uso:
 *   npm run catalogs:load
 *   MAMBO_CATALOG_DIR="/otra/carpeta" npm run catalogs:load
 *
 * Sin MAMBO_CATALOG_DIR se usa el default por plataforma:
 *   - Windows: C:\Mambo catalogos
 *   - Linux/macOS: ~/Downloads
 * El export va a catalog-export.json (+ catalog-export-diag.json), ambos
 * gitignored. Este wrapper NO toca los scripts de FASE 2: solo los invoca.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CATALOG_DIR =
	process.env.MAMBO_CATALOG_DIR ||
	(process.platform === "win32"
		? "C:\\Mambo catalogos"
		: path.join(os.homedir(), "Downloads"));

if (!fs.existsSync(CATALOG_DIR)) {
	console.error(
		`❌ La carpeta de catálogos ${CATALOG_DIR} no existe.\n` +
			"   → setéá MAMBO_CATALOG_DIR apuntando a tus catálogos (ej: MAMBO_CATALOG_DIR=/ruta node scripts/catalog-load.js)",
	);
	process.exit(1);
}

console.log(`📂 Catálogos: ${CATALOG_DIR}\n`);
const res = spawnSync(
	process.execPath,
	[path.join(__dirname, "export-catalog-batch.js"), "catalog-export.json"],
	{ stdio: "inherit", env: { ...process.env, MAMBO_CATALOG_DIR: CATALOG_DIR } },
);
process.exit(res.status ?? 1);