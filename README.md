# Mambo Pedidos 📦 (v1.2.6 (Stable))

[![Version](https://img.shields.io/badge/version-v1.2.6 (Stable)-orange.svg)](https://github.com/getodevel-source/mambo-pedidos/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blueviolet.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange.svg)](https://www.rust-lang.org/)

**Mambo Pedidos** es una aplicación de escritorio de alto rendimiento desarrollada por [@geto_dev](https://instagram.com/geto_dev) para la gestión inteligente de catálogos mayoristas de periféricos gamer, importación de PDFs con Visión por IA, desambiguación de modelos y armado de pedidos con cálculo automático de rentabilidad, logística y simulaciones comerciales.

🔗 **Repositorio:** [https://github.com/getodevel-source/mambo-pedidos](https://github.com/getodevel-source/mambo-pedidos)

---

## ✨ Características Principales

### 👁️ Visión por IA Neuronal (ONNX WebGPU) & Recorte de Productos
- **Detección de Bounding Box por IA (`detectObjectBoundingBoxNeural`):** Detección semántica del objeto (producto) en el canvas del PDF que recorta márgenes muertos aplicando un colchón de seguridad del 4% para preservar siluetas de teclados, mouses y auriculares blancos o claros.
- **Ciclo de Vida Bajo Demanda:** Inicializa los tensores de Visión ONNX WebGPU únicamente al procesar catálogos y libera el 100% de la memoria VRAM/RAM (`0MB` de residuo) al finalizar.
- **Asociación Espacial 2D con Candados 1-a-1:** Asigna imágenes a productos por distancia euclidiana en 2D ($\sqrt{\Delta X^2 + 1.3\Delta Y^2}$) con candados (`claimedImages`) para evitar cruces en grillas multi-columna.

### 🏷️ Desglose Inteligente NLP de Atributos
- **Separación de Modelo y Variante/Color (`parseModelAndVariant`):** Desarticula cadenas largas (ej: *"AULA F75 Mechanical Keyboard (White / Reaper Switch)"*) en un **modelo corto y limpio** (`"F75"`) y una **variante de color/switch** renderizada como un badge verde pastel en las tarjetas del catálogo.

### 📊 Modal de Carga con Animación 0% a 100%
- **Pantalla de Carga de Cristal (`#loadingOverlay`):** Modal con fondo blur de alta gama que muestra en vivo el progreso numérico animado (`0% -> 100%`), barra de progreso con neón y el estado página a página del catálogo procesado.

### 🎨 Sidebar Simplificada y Ergonomía
- **Botón Unificado de Importación:** Reemplaza botones apilados por un único control `📁 Cargar Carpeta / PDFs` con indicación de zona de arrastre (*drag & drop*).
- **Herramientas Organizadas:** Acceso rápido en 1-click a Pantalla Completa y Búsqueda de Actualizaciones.

### 🚚 Logística Avanzada y Cotizaciones
- **Flete por Peso vs % FOB:** Cálculo por $/Kg o porcentaje sobre FOB para envíos Aéreos y Marítimos.
- **Cotización Cliente en PDF & Excel Aduanero:** Genera presupuestos formales e informes financieros en 3 pestañas.

### 🔄 Actualizador Nativo Silencioso In-Place (Tauri 2.0)
- Descarga e instalación in-place con parches firmados criptográficamente y flags nativos `/REINSTALL /NOUNINSTALL` en Windows para actualizar **sin asistentes ni ventanas de desinstalación**.

---

## 📥 Instalación

### Windows
1. Andá a [Releases](https://github.com/getodevel-source/mambo-pedidos/releases)
2. Descargá el `.msi` o `.exe` de la versión `v1.2.6`
3. Ejecutá el instalador
4. Listo, la app buscará e instalará futuras actualizaciones silenciosamente en 1-click

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Rust + Tauri 2.0 |
| **Frontend** | HTML5 + CSS3 Vanilla + JavaScript ES6+ |
| **Motor de IA & Visión** | ONNX Runtime WebGPU + Micro-LLM Semantic Rules |
| **Persistencia** | LocalStorage + Tauri Store |
| **PDF Parser & Images** | PDF.js (Mozilla) + Canvas 2D API |
| **Spreadsheets & CSV** | SheetJS (XLSX) + PapaParse |
| **Actualizador** | Tauri 2.0 Native Silent Updater Plugin + GitHub Actions CI/CD |

---

## 📁 Estructura del Proyecto

```
mambo-pedidos/
├── src/                    # Frontend WebApp
│   ├── index.html         # Estructura e interfaz principal con modal 0-100%
│   ├── css/               # Estilos obsidian dark mode y tooltips
│   └── js/
│       ├── app.js         # Controlador principal y barra de progreso 0-100%
│       ├── aiDisambiguator.js# Motor Neuronal ONNX WebGPU & Desglose NLP
│       ├── calculator.js  # Motor de cálculo financiero y logística
│       ├── pdfParser.js   # Extractor espacial X/Y e imágenes por IA
│       ├── fileImporter.js# Importador CSV/Excel y Packing List
│       ├── quoteGenerator.js# Generador de cotizaciones en PDF
│       ├── updater.js     # Descargador nativo de actualizaciones in-place
│       ├── storage.js     # Persistencia local
│       └── tests.js       # Suite de 39 pruebas unitarias
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs        # Entry point de ejecutable
│   │   └── lib.rs         # Comandos Tauri + updater con flags silenciosos
│   ├── Cargo.toml         # Dependencias Rust v1.2.6
│   └── tauri.conf.json    # Configuración de Tauri 2.0
├── .github/
│   └── workflows/
│       └── release.yml    # Pipeline de compilación y firma digital
├── package.json
└── README.md
```

---

## 🛠️ Pruebas y Desarrollo Local

### Ejecutar Suite de Pruebas Unitarias (39 PASS)
```bash
node -e "const fs = require('fs'); global.window=global; global.document={createElement:()=>({getContext:()=>null})}; global.XLSX={utils:{aoa_to_sheet:()=>({}),book_new:()=>({SheetNames:[]}),book_append_sheet:()=>{}},writeFile:()=>{}}; const vm = require('vm'); ['validations.js', 'pdfParser.js', 'calculator.js', 'aiDisambiguator.js', 'quoteGenerator.js', 'fileImporter.js', 'tests.js'].forEach(f => vm.runInThisContext(fs.readFileSync('src/js/' + f, 'utf8'))); Tests.runAll();"
```

---

## 👤 Autor

Desarrollado con ❤️ por **[@geto_dev](https://instagram.com/geto_dev)**.

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**.





