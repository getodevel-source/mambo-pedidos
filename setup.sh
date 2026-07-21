#!/bin/bash
# Setup Mambo Pedidos para desarrollo
# Ejecutar UNA VEZ después de clonar el repo

set -e

echo "🚀 Mambo Pedidos - Setup"
echo "========================"

# Verificar Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no instalado. Descargá de https://nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Verificar Rust
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust no instalado. Instalá desde https://rustup.rs"
    exit 1
fi
echo "✅ Rust $(cargo --version)"

# Instalar Tauri CLI si no está
if ! command -v cargo-tauri &> /dev/null && ! cargo tauri --version &> /dev/null; then
    echo "📦 Instalando Tauri CLI..."
    cargo install tauri-cli --version "^2.0" --locked
fi
echo "✅ Tauri CLI"

# Linux: dependencias de sistema
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "📦 Instalando dependencias de Linux..."
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
fi

# npm install
echo "📦 Instalando dependencias de Node..."
npm install

echo ""
echo "✅ Setup completo!"
echo ""
echo "Próximos pasos:"
echo "  npm run dev       # modo desarrollo"
echo "  npm run build     # build de producción"
echo ""
