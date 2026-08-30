# Mambo Pedidos (v2.2.0)

[![Version](https://img.shields.io/badge/version-v2.2.0-orange.svg)](https://github.com/getodevel-source/mambo-pedidos/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri 2.0](https://img.shields.io/badge/Tauri-2.0-blueviolet.svg)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange.svg)](https://www.rust-lang.org/)

**Mambo Pedidos** es una aplicación de escritorio desarrollada por [@geto_dev](https://instagram.com/geto_dev) para la gestión inteligente de catálogos mayoristas de periféricos gamer. Importa PDFs con parsing espacial determinístico, validación visual de imágenes y armado de pedidos con cálculo automático de rentabilidad y logística.

🔗 **Repositorio:** [https://github.com/getodevel-source/mambo-pedidos](https://github.com/getodevel-source/mambo-pedidos)

---

## ✨ Características Principales

### 📐 Motor de Importación Espacial (Table Row Engine)
- **Detección automática de layout**: identifica si el catálogo es tabla (una columna de precios) o grilla (múltiples columnas) y adapta el parsing.
- **Extracción por coordenadas X/Y**: cada producto se localiza por su posición espacial en el PDF, no por texto plano. Límites Y dinámicos calculados entre filas consecutivas.
- **14 marcas detectadas automáticamente**: 8BitDo, AJAZZ, AULA, Attack Shark, Irok, Mars, Haimu, KZ, Logitech, Madlions, Razer, Royal Kludge, MCHOSE, Keychron.
- **~13 categorías**: MOUSE, TECLADO, CONTROLLER, AURICULAR, HEADSET, SWITCH, MOUSEPAD, CAMARA, SPEAKER, SILLA_GAMING, ACCESORIO, NUMPAD, MONITOR.
- **Limpieza de modelos**: remoción de códigos de barras EAN, specs de sensores (PAW3950), ruido corporativo, colores separados a variante.

### 🖼️ Validación Visual de Imágenes
- **Color dominante**: extrae el color principal de la imagen y lo compara con la variante del producto (ej: producto "Black" con imagen blanca → degradan a YELLOW/WATCH).
- **Aspect ratio por categoría**: un teclado no puede tener una imagen estrecha, un mouse no puede tener una imagen panorámica.
- **Hard gates**: si la imagen falla la validación, el producto queda sin foto. Sin imagen > imagen incorrecta.
- **Deduplicación**: elimina imágenes duplicadas extraídas del PDF antes del matching.

### 🚚 Logística y Cotizaciones
- **Flete por peso vs % FOB**: cálculo por $/Kg o porcentaje sobre FOB para envíos aéreos y marítimos.
- **Cotización en PDF y Excel**: presupuestos formales e informes financieros con packing list aduanero.

### 🔄 Actualizador Nativo Firmado (Tauri 2.0)
- **Plugin oficial de Tauri** para el flujo completo: check → download → verify signature → install → restart.
- **Firma minisign**: cada update se verifica criptográficamente antes de instalar.
- **Progreso real**: eventos del plugin muestran el avance real de la descarga.

---

## 📥 Instalación

### Windows
1. Ir a [Releases](https://github.com/getodevel-source/mambo-pedidos/releases)
2. Descargar `Mambo.Pedidos_x.x.x_x64-setup.exe`
3. Ejecutar el instalador
4. La app busca e instala actualizaciones automáticamente

### Linux
- `.AppImage` (portable) o `.deb` (Debian/Ubuntu) disponibles en Releases

### macOS
- `.dmg` para Apple Silicon (aarch64) disponible en Releases

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Rust + Tauri 2.0 |
| **Frontend** | HTML5 + CSS3 + JavaScript ES6+ (Vanilla) |
| **PDF Parser** | PDF.js 3.11 (extracción espacial X/Y + Canvas 2D) |
| **Spreadsheets** | SheetJS (XLSX) + PapaParse (CSV) |
| **Persistencia** | LocalStorage + Tauri Store |
| **Updater** | Tauri Plugin Updater + minisign + GitHub Releases |
| **CI/CD** | GitHub Actions (build multi-platform + firma) |

---

## 📁 Estructura del Proyecto

```
mambo-pedidos/
├── src/
│   ├── index.html              # Interfaz principal
│   └── js/
│       ├── app.js              # Controlador principal
│       ├── pdfParser.js        # Motor espacial: Table Row Engine + Grid Cell Engine + validación de imágenes
│       ├── pdfParserClassifier.js # Clasificador puro: marcas + categorías + limpiez
│       ├── textSanitizer.js    # Sanitización determinística de texto
│       ├── catalogValidator.js # Auditor de calidad por producto (reglas R1-R10)
│       ├── calculator.js       # Motor de cálculo financiero y logística
│       ├── fileImporter.js     # Importador CSV/Excel + Packing List
│       ├── quoteGenerator.js   # Generador de cotizaciones en PDF
│       ├── updater.js          # Actualizador nativo con firma minisign
│       ├── storage.js          # Persistencia local
│       └── tests.js            # Suite de pruebas unitarias
├── src-tauri/
│   ├── src/lib.rs              # Comandos Tauri + plugins
│   ├── Cargo.toml
│   └── tauri.conf.json         # Config Tauri 2.0 + updater pubkey
├── scripts/
│   ├── bump-version.js         # Verificador de coherencia de versión
│   ├── build-signed.bat        # Build con clave de firma
│   ├── test-spatial-import.js  # Test de calidad contra 13 catálogos reales
│   └── test-geometry-dump.js   # Diagnóstico de geometría PDF
├── .github/workflows/
│   ├── ci.yml                  # CI: tests + lint + sintaxis
│   ├── e2e-windows.yml         # CI: app real compilada + e2e por CDP
│   └── release.yml             # CI/CD multi-platform (build + firma + release)
```

---

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build con firma (Windows)
scripts\build-signed.bat

# Test de importación contra catálogos reales
node scripts/test-spatial-import.js

# Verificar coherencia de versión
node scripts/bump-version.js

# E2E sobre la app real (Tauri + WebView2): exige el binario compilado.
# Verifica el puente de plugins y que la persistencia no caiga a localStorage.
npm run e2e
```

### Persistencia

En desktop los datos viven en `$APPDATA/com.mambo.pedidos`: el catálogo en el
store de Tauri (`.mambo-store.json`) y las imágenes como archivos en `images/`.
El acceso a los plugins de Tauri v2 pasa por `src/bridge/tauri-bridge.mjs`, que
`build-frontend.js` compila a `dist/vendor/tauri-bridge.js`; sin ese puente la
app cae a `localStorage` (cuota ~5 MB y degradado de imágenes), y el job
`e2e-windows` de CI lo detecta. `await AppStorage.diagnostics()` en la consola
de la app debe responder `{ mode: "tauri", storeReady: true, imagesDir: ... }`.

---

## 👤 Autor

Desarrollado por **[@geto_dev](https://instagram.com/geto_dev)**.

## 📄 Licencia

**MIT**
