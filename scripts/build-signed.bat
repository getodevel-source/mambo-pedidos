@echo off
REM Build script with signing key
set "TAURI_SIGNING_PRIVATE_KEY_PATH=C:\Mambo\MamboApp\.keys\mambo.key"
set "TAURI_SIGNING_PRIVATE_KEY_PASSWORD=mambo2026"

REM Also set the key content directly (Tauri v2 may need this)
for /f "usebackq delims=" %%a in ("C:\Mambo\MamboApp\.keys\mambo.key") do (
    if not defined TAURI_SIGNING_PRIVATE_KEY (
        set "TAURI_SIGNING_PRIVATE_KEY=%%a"
    ) else (
        set "TAURI_SIGNING_PRIVATE_KEY=!TAURI_SIGNING_PRIVATE_KEY!\n%%a"
    )
)

echo Building with signing key...
call npx tauri build --target x86_64-pc-windows-msvc
