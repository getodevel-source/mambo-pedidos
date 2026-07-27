/**
 * Runner de Integración y Auditoría de Catálogos Reales — Mambo Pedidos
 * Procesa todos los PDFs en C:\Mambo\Catalogos y audita la calidad de extracción.
 */

const fs = require('fs');
const path = require('path');

global.window = global;
global.window.TransformersAI = null;
global.document = {
  createElement: () => ({
    setAttribute: () => {},
    click: () => {},
    getContext: () => null
  }),
  body: { appendChild: () => {}, removeChild: () => {} }
};
global.navigator = {};
global.Image = class {};

// Mock XLSX & PapaParse
global.XLSX = {
  utils: {
    aoa_to_sheet: () => ({}),
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    book_append_sheet: (wb, sheet, name) => { wb.SheetNames.push(name); wb.Sheets[name] = sheet; }
  },
  writeFile: () => ({})
};

// Cargar pdfjs vendor directamente
eval(fs.readFileSync(path.join(__dirname, '../src/vendor/pdf.min.js'), 'utf8'));
const pdfjsLib = global.pdfjsLib || window.pdfjsLib;
if (pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(__dirname, '../src/vendor/pdf.worker.min.js');
}
global.pdfjsLib = pdfjsLib;

// Cargar módulos del proyecto
const projectJsFiles = [
  'validations.js',
  'calculator.js',
  'storage.js',
  'pdfParser.js',
  'transformersAi.js',
  'aiDisambiguator.js',
  'catalogValidator.js',
  'fileImporter.js',
  'tests.js'
];

projectJsFiles.forEach(file => {
  const filePath = path.join(__dirname, '../src/js', file);
  eval(fs.readFileSync(filePath, 'utf8'));
});

async function auditRealCatalogFolder() {
  const catalogDir = 'C:\\Mambo\\Catalogos';
  if (!fs.existsSync(catalogDir)) {
    console.error('❌ La carpeta C:\\Mambo\\Catalogos no existe');
    process.exit(1);
  }

  const files = fs.readdirSync(catalogDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  console.log(`🔍 Iniciando auditoría batch de ${files.length} catálogos en ${catalogDir}...\n`);

  let totalProducts = 0;
  let totalErrors = 0;
  const catalogResults = [];

  for (const fileName of files) {
    const filePath = path.join(catalogDir, fileName);
    const dataBuffer = fs.readFileSync(filePath);
    const uint8Array = new Uint8Array(dataBuffer);

    try {
      const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
      const allProducts = [];
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        if (pageNum <= 3) {
          fullText += content.items.map(i => i.str).join(' ') + ' ';
        }

        const pageProducts = PdfParser.extractPageProductsByCellGrid(content.items, viewport.height, pageNum, [], '', [], allProducts);
        allProducts.push(...pageProducts);
      }

      const detectedBrand = PdfParser.detectBrandFromContent(fullText, []) || PdfParser.detectBrandFromFilename(fileName, []);
      const finalized = PdfParser.finalizeCatalogProducts(allProducts, detectedBrand, 0, []);

      const processed = finalized.map(p => {
        const d = AiDisambiguator.disambiguateItem(p, []);
        return AiDisambiguator.repairCatalogItem(d);
      });

      // Auditar con CatalogValidator producto por producto contra las 6 reglas
      const audit = CatalogValidator.validateCatalog(processed);
      const fileErrors = [];
      audit.results.forEach(res => {
        if (!res.isValid) {
          fileErrors.push(`[SKU #${res.index + 1} - ${res.modelo}] Violaciones: ${res.violations.join(' | ')}`);
        }
      });

      totalProducts += processed.length;
      totalErrors += fileErrors.length;

      catalogResults.push({
        file: fileName,
        pages: pdf.numPages,
        brand: detectedBrand,
        productsCount: processed.length,
        errorsCount: fileErrors.length,
        errors: fileErrors
      });

      console.log(`📄 [${fileName}] → Marca: ${detectedBrand} | ${processed.length} SKUs extraídos | ${fileErrors.length} advertencias/errores`);
      if (fileErrors.length > 0) {
        fileErrors.slice(0, 3).forEach(e => console.log(`   ⚠️ ${e}`));
        if (fileErrors.length > 3) console.log(`   ... y ${fileErrors.length - 3} errores más`);
      }

      await pdf.destroy();
    } catch (err) {
      console.error(`❌ Error procesando ${fileName}:`, err.message);
      totalErrors++;
    }
  }

  console.log('\n==================================================');
  console.log(`📊 RESUMEN FINAL AUDITORÍA DE CATÁLOGOS REALES`);
  console.log(` Archivos procesados: ${files.length}`);
  console.log(` Total de SKUs extraídos: ${totalProducts}`);
  console.log(` Total de observaciones de calidad: ${totalErrors}`);
  console.log('==================================================\n');

  if (totalErrors > 0) {
    console.log('⚠️ Se requieren ajustes de patrones NLP/desambiguador.');
    process.exit(1);
  } else {
    console.log('🎉 AUDITORÍA PERFECTA: 100% de los catálogos se procesaron y exportaron sin errores de ruido.');
    process.exit(0);
  }
}

auditRealCatalogFolder();
