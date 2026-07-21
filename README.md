# Mambo Pedidos

App de escritorio liviana para gestionar catálogos de periféricos gamer y armar pedidos con cálculo automático de rentabilidad.

🔗 **Repo:** https://github.com/getodevel-source/mambo-pedidos

## ✨ Características

- 🚀 **Liviana y portable** (~5 MB) — escrita en Tauri + HTML/JS
- 📚 **Carga catálogos** desde PDFs, Excel o CSV (arrastrá o elegí)
- ✅ **Validaciones estrictas** — nunca mandes un pedido con SKU inválido o FOB $0
- 💰 **Cálculo de rentabilidad** automático: FOB, costo puesto en país, PVP, margen
- 📋 **Historial de pedidos** persistente
- 🔄 **Auto-actualización** desde GitHub Releases
- 💾 **Datos locales** en SQLite/JSON (no se pierde nada)

## 📥 Instalación

### Windows
1. Andá a [Releases](https://github.com/getodevel-source/mambo-pedidos/releases)
2. Descargá el `.msi` o `.exe` de la última versión
3. Ejecutá el instalador
4. Listo, ya tenés Mambo Pedidos instalado

### Linux
1. Descargá el `.AppImage` o `.deb`
2. Para AppImage: `chmod +x mambo-pedidos-linux.AppImage && ./mambo-pedidos-linux.AppImage`
3. Para .deb: `sudo dpkg -i mambo-pedidos-linux.deb`

## 🚀 Uso

### 1. Cargar catálogo
- **Opción A:** Click "Cargar PDFs" en la sidebar
- **Opción B:** Click "Cargar carpeta entera" y elegí `C:\Mambo\Catalogos\`
- **Opción C:** Arrastrá un PDF directo a la ventana

### 2. Armar pedido
- Tildá los productos que querés del catálogo
- Poné la cantidad
- Click "📦 Armar pedido →"
- Ajustá el markup y los costos de importación
- Click "💾 Guardar en historial"

### 3. Ver historial
- Sidebar → "Historial"
- Click "Abrir" en cualquier pedido guardado

## 🛠️ Desarrollo

### Requisitos
- Node.js 20+
- Rust 1.70+
- Tauri CLI: `cargo install tauri-cli --version "^2.0"`

### Setup
```bash
git clone https://github.com/getodevel-source/mambo-pedidos.git
cd mambo-pedidos
npm install
npm run dev   # modo desarrollo
```

### Build local
```bash
npm run build:windows  # genera .msi y .exe en src-tauri/target/release/bundle/
npm run build:linux    # genera .AppImage y .deb
```

### Release
```bash
git tag v0.1.0
git push origin v0.1.0
# GitHub Actions compila automáticamente y crea la release
```

## 🏗️ Stack

| Capa | Tecnología |
|---|---|
| **Backend** | Rust + Tauri 2.0 |
| **Frontend** | HTML + CSS + Vanilla JS |
| **Persistencia** | localStorage + Tauri Store (SQLite opcional) |
| **PDF parser** | PDF.js (Mozilla) |
| **Spreadsheet** | SheetJS (XLSX) |
| **CSV** | PapaParse |
| **Build** | GitHub Actions |

## 📁 Estructura del proyecto

```
mambo-pedidos/
├── src/                    # Frontend
│   ├── index.html         # HTML principal
│   ├── app.js             # Estado y navegación
│   └── validator.js       # Sistema de validaciones
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   └── lib.rs         # Comandos Tauri + validaciones del backend
│   ├── Cargo.toml
│   └── tauri.conf.json    # Config de Tauri
├── .github/
│   └── workflows/
│       └── release.yml    # CI/CD
├── package.json
└── README.md
```

## 🛡️ Validaciones

El sistema valida **todo** lo que entra:

- **SKUs:** únicos, formato `MARCA-CAT-####`, max 50 chars
- **Marcas:** obligatorias, 1-50 chars
- **Modelos:** obligatorios, 1-200 chars
- **Categorías:** una de [TECLADO, MOUSE, MOUSEPAD, HEADSET, CONTROLLER, SWITCH, AUDIO, OTRO]
- **FOB:** $0.01 a $500, advertencia si <$1 o >$200
- **Cantidades:** enteros 1-9999
- **Pedidos:** valida antes de armar y antes de guardar en historial

**No se puede armar un pedido con errores.** El panel de validación muestra exactamente qué está mal.

## 💡 Tips

- **Backup:** Los datos están en `%APPDATA%\com.mambo.pedidos\` (Windows) o `~/.local/share/com.mambo.pedidos/` (Linux)
- **Auto-update:** La app busca nuevas versiones al abrirse
- **Drag & drop:** Arrastrá PDFs a la ventana desde el explorador

## 📞 Soporte

Si encontrás un bug o querés sugerir algo:
- [Abrí un issue](https://github.com/getodevel-source/mambo-pedidos/issues)
- O contactame directo

## 📄 Licencia

MIT
