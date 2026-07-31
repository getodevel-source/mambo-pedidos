@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM Build script with signing secrets supplied by the environment/secret manager.
if not defined TAURI_SIGNING_PRIVATE_KEY_PATH (
    echo ERROR: TAURI_SIGNING_PRIVATE_KEY_PATH is required.
    exit /b 1
)
if not defined TAURI_SIGNING_PRIVATE_KEY_PASSWORD (
    echo ERROR: TAURI_SIGNING_PRIVATE_KEY_PASSWORD is required.
    exit /b 1
)
if not exist "%TAURI_SIGNING_PRIVATE_KEY_PATH%" (
    echo ERROR: signing key file was not found at "%TAURI_SIGNING_PRIVATE_KEY_PATH%".
    exit /b 1
)

REM Also set the key content directly (Tauri v2 may need this)
for /f "usebackq delims=" %%a in ("%TAURI_SIGNING_PRIVATE_KEY_PATH%") do (
    if not defined TAURI_SIGNING_PRIVATE_KEY (
        set "TAURI_SIGNING_PRIVATE_KEY=%%a"
    ) else (
        set "TAURI_SIGNING_PRIVATE_KEY=!TAURI_SIGNING_PRIVATE_KEY!\n%%a"
    )
)

echo Building with signing key...
call npx tauri build --target x86_64-pc-windows-msvc
exit /b %ERRORLEVEL%
