# Mambo Pedidos 📦 (v1.0.0)

[![Version](https://img.shields.io/badge/version-v1.0.0-orange.svg)](https://github.com/getodevel-source/mambo-pedidos/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blueviolet.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange.svg)](https://www.rust-lang.org/)

**Mambo Pedidos** es una aplicación de escritorio de alto rendimiento desarrollada por [@geto_dev](https://instagram.com/geto_dev) para la gestión inteligente de catálogos mayoristas de periféricos gamer, importación y armado de pedidos con cálculo automático de rentabilidad, logística y simulaciones comerciales.

🔗 **Repositorio:** [https://github.com/getodevel-source/mambo-pedidos](https://github.com/getodevel-source/mambo-pedidos)

---

## ✨ Características Principales

### 🖼️ Ecosistema Inteligente de Imágenes de Productos
- **Extracción Espacial X/Y desde PDF:** Extrae automáticamente las imágenes embebidas en listas de precios PDF y las vincula con el SKU/Modelo correcto por posición en la página.
- **Limpiador de Fondos por Canvas:** Algoritmo nativo en Canvas que elimina fondos grises o sucios de catálogos de proveedores chinos dejando transparencias limpias.
- **Editor Manual y Portapapeles (`Ctrl + V`):** Subí fotos locales o pegá imágenes directo del portapapeles en 1 segundo.
- **Modos de Vista del Catálogo:** Alterná en 1 click entre **`[ ☰ Tabla ]`** y **`[ 🪟 Galería de Tarjetas ]`** con fotos grandes.

### ⚡ Ergonomía y Rediseño Global (UX)
- **Barra Flotante de Compra ("Sticky Order Bar"):** Muestra totales y botón instantáneo `[ 📦 Armar Pedido Ahora → ]` mientras navegas el catálogo.
- **Chips de Filtro Rápido:** Filtrá al instante por Teclados, Mouses, Headsets, Mandos o solo productos **`🟢 Seleccionados`**.
- **Slider de Markup y Semáforo de Rentabilidad:** Control deslizante (`1.1x` a `4.0x`) con insignia de salud de margen:
  - 🟢 **Excelente Rentabilidad** (>40% margen / ROI >80%)
  - 🟡 **Margen Saludable** (20-40% margen)
  - 🔴 **Margen Ajustado** (<20% margen)

### 🚚 Logística Avanzada y Alertas de Regulaciones
- **Flete por Peso vs % FOB:** Cálculo de transporte internacional por peso ($/Kg) o porcentaje sobre valor FOB, diferenciando envíos Aéreos y Marítimos.
- **Alertas Courier:** Advertencia visual automática si el pedido supera los USD $3000 FOB, 50 Kg por bulto o límites de especie.
- **Métricas Financieras:** Cálculo automático de ROI %, IVA % estimado (21% o 10.5%) e importes en Pesos ARS.

### 📊 Comparador Multiproveedor de Precios
- Escanea catálogos cargados de diferentes marcas o proveedores, agrupa productos coincidentes (mismo modelo) y resalta el **Mejor Precio FOB (🟢)** calculando el porcentaje de ahorro.

### 📈 Simulador de Escenarios y Sensibilidad
- Tablero interactivo con sliders para proyectar variaciones de:
  - **Tipo de Cambio ($/USD):** De $800 a $2500 ARS.
  - **Variación de Flete y Gastos:** De -50% a +100%.
  - **Margen Objetivo Deseado:** Muestra el **PVP recomendado por producto** para asegurar la ganancia limpia configurada.

### 📦 Exportación Aduanera y Cotizaciones PDF
- **Packing List Aduanero (Excel):** Exporta planillas estructuradas con formato aduanero (SKU, NCM/Posición, Peso, FOB, CIF, Costos Puestos).
- **Cotización Cliente en PDF:** Genera presupuestos formales imprimibles con membrete corporativo y selector de vista `[ 🎨 Catálogo Visual ]` vs `[ 📄 Texto Compacto ]`.

### 🔄 Actualizador Nativo Silencioso In-App (Tauri 2.0)
- Descarga silenciosa en segundo plano de binarios firmados (`.msi` / `.exe`) con barra de progreso in-app y reinicio automático en 1-click **sin necesidad de desinstalar nada a mano ni abrir el navegador web**.

---

## 📥 Instalación

### Windows
1. Andá a [Releases](https://github.com/getodevel-source/mambo-pedidos/releases)
2. Descargá el `.msi` o `.exe` de la última versión
3. Ejecutá el instalador
4. Listo, la app buscará e instalará futuras actualizaciones silenciosamente en 1-click

### Linux
1. Descargá el `.AppImage` o `.deb`
2. **AppImage:** `chmod +x mambo-pedidos-linux.AppImage && ./mambo-pedidos-linux.AppImage`
3. **.deb:** `sudo dpkg -i mambo-pedidos-linux.deb`

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Rust + Tauri 2.0 |
| **Frontend** | HTML5 + CSS3 Vanilla + JavaScript ES6+ |
| **Persistencia** | LocalStorage + Tauri Store |
| **PDF Parser & Images** | PDF.js (Mozilla) + Canvas 2D API |
| **Spreadsheets & CSV** | SheetJS (XLSX) + PapaParse |
| **Actualizador** | Tauri 2.0 Native Silent Updater Plugin + GitHub Actions CI/CD |

---

## 📁 Estructura del Proyecto

```
mambo-pedidos/
├── src/                    # Frontend WebApp
│   ├── index.html         # Estructura e interfaz principal
│   ├── css/               # Estilos obsidian dark mode y tooltips
│   └── js/
│       ├── app.js         # Controlador principal y estado
│       ├── calculator.js  # Motor de cálculo financiero y logística
│       ├── pdfParser.js   # Extractor espacial X/Y e imágenes
│       ├── fileImporter.js# Importador CSV/Excel y Packing List
│       ├── quoteGenerator.js# Generador de cotizaciones en PDF
│       ├── updater.js     # Descargador nativo de actualizaciones
│       ├── storage.js     # Persistencia local
│       └── tests.js       # Suite de 28 pruebas unitarias
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs        # Entry point de ejecutable
│   │   └── lib.rs         # Comandos Tauri + plugin updater
│   ├── Cargo.toml         # Dependencias Rust
│   └── tauri.conf.json    # Configuración de Tauri 2.0
├── .github/
│   └── workflows/
│       └── release.yml    # Pipeline de compilación y firma digital
├── package.json
└── README.md
```

---

## 🛠️ Pruebas y Desarrollo Local

### Requisitos
- Node.js 20+
- Rust 1.70+

### Ejecución en Modo Desarrollo
```bash
git clone https://github.com/getodevel-source/mambo-pedidos.git
cd mambo-pedidos
npm install
npm run dev
```

### Ejecutar Suite de Pruebas Unitarias
```bash
# Pruebas JS (28 unit tests)
node -e "const fs = require('fs'); global.window=global; global.document={body:{},createElement:()=>({style:{},getContext:()=>({createImageData:()=>({data:[]}),putImageData:()=>{},getImageData:()=>({data:[]})})}),getElementById:()=>null}; global.XLSX={utils:{aoa_to_sheet:()=>({}),book_new:()=>({}),book_append_sheet:()=>{}},writeFile:()=>{}}; eval(fs.readFileSync('src/validator.js','utf8')); eval(fs.readFileSync('src/js/calculator.js','utf8')); eval(fs.readFileSync('src/js/storage.js','utf8')); eval(fs.readFileSync('src/js/pdfParser.js','utf8')); eval(fs.readFileSync('src/js/aiDisambiguator.js','utf8')); eval(fs.readFileSync('src/js/quoteGenerator.js','utf8')); eval(fs.readFileSync('src/js/fileImporter.js','utf8')); eval(fs.readFileSync('src/js/tests.js','utf8')); Tests.runAll();"

# Pruebas Rust Backend
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## 👤 Autor

Desarrollado con ❤️ por **[@geto_dev](https://instagram.com/geto_dev)**.

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**.



