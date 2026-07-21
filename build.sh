#!/bin/bash
# Build Mambo Pedidos localmente
# Genera instaladores en src-tauri/target/release/bundle/

set -e

echo "🏗️  Mambo Pedidos - Local Build"
echo "================================"

# Verificar Tauri CLI
if ! cargo tauri --version &> /dev/null; then
    echo "❌ Tauri CLI no instalado. Ejecutá setup.sh primero."
    exit 1
fi

# Detectar OS
case "$OSTYPE" in
    "linux-gnu"*)
        echo "🐧 Building para Linux..."
        npm run build:linux
        BUNDLE_DIR="src-tauri/target/release/bundle"
        ;;
    "darwin"*)
        echo "🍎 Building para macOS..."
        npm run build
        BUNDLE_DIR="src-tauri/target/release/bundle"
        ;;
    "msys" | "cygwin" | "win32"*)
        echo "🪟 Building para Windows..."
        npm run build:windows
        BUNDLE_DIR="src-tauri/target/release/bundle"
        ;;
    *)
        echo "❌ OS no soportado: $OSTYPE"
        exit 1
        ;;
esac

echo ""
echo "✅ Build completo!"
echo ""
echo "📦 Instaladores en: $BUNDLE_DIR"
ls -la $BUNDLE_DIR/*/ 2>/dev/null || true
