const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['src/js/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        // App vendor globals
        Papa: 'readonly',
        XLSX: 'readonly',
        pdfjsLib: 'readonly',
        // Lazy loaders (P17 opción 2)
        ensurePdfLib: 'readonly',
        ensureXlsxLib: 'readonly',
        ensureNcmDbLib: 'readonly',
        // App module globals (browser-global pattern)
        AppStorage: 'writable',
        AppUpdater: 'writable',
        Calculator: 'writable',
        CatalogAssignmentGates: 'writable',
        CatalogValidator: 'writable',
        FileImporter: 'writable',
        ImageQuality: 'writable',
        NcmDatabase: 'writable',
        PdfParser: 'writable',
        PdfParserClassifier: 'writable',
        QuoteGenerator: 'writable',
        SkuAllocator: 'writable',
        TextSanitizer: 'writable',
        Validations: 'writable',
        QualityGate: 'writable',
        SpreadsheetHarness: 'writable',
        UpdaterSmoke: 'writable',
        Tests: 'writable',
        // App UI globals
        toast: 'readonly',
        tip: 'readonly',
        esc: 'readonly',
        escJs: 'readonly',
        switchView: 'readonly',
        toggleFullscreen: 'readonly',
        fetchLiveDolarRates: 'readonly',
        loadDemoCatalog: 'readonly',
        resetCatalog: 'readonly',
        DEMO_CATALOG: 'readonly',
        AppStore: 'readonly',
        showConfirm: 'readonly',
        toastUndo: 'readonly',
        resolveConfirm: 'readonly',
        closeConfirmModal: 'readonly',
        // Shared state (app.js module-level)
        catalog: 'writable',
        selection: 'writable',
        currentPedido: 'writable',
        customBrandsList: 'writable',
        // App.js functions used across modules
        updateBadges: 'readonly',
        invalidateHistorialBadge: 'readonly',
        updateStatValue: 'readonly',
        renderPedido: 'readonly',
        renderPedidoTable: 'readonly',
        getCostInputs: 'readonly',
        recalc: 'readonly',
        showValidationPanel: 'readonly',
        hideValidationPanel: 'readonly',
        scheduleCatalogSave: 'readonly',
        hasCatalogImage: 'readonly',
        updateProductImage: 'readonly',
        renderBrandList: 'readonly',
        // UI module objects
        UINotifications: 'writable',
        UIModals: 'writable',
        CatalogView: 'writable',
        ImportFlow: 'writable',
        HistoryView: 'writable',
        Reliability: 'writable',
        // UI module bridge functions
        renderCatalog: 'readonly',
        showCatalogContent: 'readonly',
        populateCatalogFilters: 'readonly',
        debouncedRenderCatalog: 'readonly',
        processFiles: 'readonly',
        renderHistorial: 'readonly',
        showProgress: 'readonly',
        hideProgress: 'readonly',
        showDropOverlay: 'readonly',
        hideDropOverlay: 'readonly',
        zoomImageByUrl: 'readonly',
        closeImportPreviewModal: 'readonly',
        closeBrandManagerModal: 'readonly',
        closeImageZoomModal: 'readonly',
        closeSupplierCompareModal: 'readonly',
        closeSensitivitySimulatorModal: 'readonly',
        closeBreakEvenModal: 'readonly',
        closeDoorToDoorModal: 'readonly',
        // Tauri
        __TAURI__: 'readonly',
        __TAURI_INTERNALS__: 'readonly',
        __TAURI_PLUGIN_STORE__: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-cond-assign': ['error', 'except-parens'],
      'eqeqeq': ['warn', 'smart'],
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-redeclare': 'off',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'warn',
      'valid-typeof': 'error',
      'no-async-promise-executor': 'warn',
      'require-atomic-updates': 'off',
      'no-prototype-builtins': 'off',
      'no-useless-escape': 'warn',
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'off'
    }
  },
  {
    files: ['scripts/quality/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    ignores: ['node_modules/', 'src/vendor/', 'src-tauri/', 'dist/', 'build/', '.codegraph/', '.atl/', 'scripts/_dbg_*', 'scripts/_splice*', 'scripts/_t1.js']
  }
];
