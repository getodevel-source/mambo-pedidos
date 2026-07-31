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
        // App module globals (browser-global pattern)
        AppStorage: 'writable',
        AppUpdater: 'writable',
        AiCatalogEngine: 'writable',
        Calculator: 'writable',
        CatalogValidator: 'writable',
        FileImporter: 'writable',
        LocalLlm: 'writable',
        PdfParser: 'writable',
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
        esc: 'readonly',
        switchView: 'readonly',
        toggleFullscreen: 'readonly',
        fetchLiveDolarRates: 'readonly',
        loadDemoCatalog: 'readonly',
        resetCatalog: 'readonly',
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
    ignores: ['node_modules/', 'src/vendor/', 'src-tauri/', 'dist/', 'build/', '.codegraph/', '.atl/']
  }
];
