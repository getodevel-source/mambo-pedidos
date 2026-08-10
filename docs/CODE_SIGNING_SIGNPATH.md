# Firma de código con SignPath (gratis para open source)

El workflow `release.yml` ya tiene integrado el paso de firma Authenticode de
Windows con SignPath. **Corre automáticamente cuando los secrets están
configurados; si no, la release sale sin firma (comportamiento actual).**

Lo que YO no puedo hacer (requiere tu cuenta/identidad) — seguí estos pasos:

## 1. Crear cuenta en SignPath
- https://signpath.io → registrar con tu email.
- Confirmar el email.

## 2. Solicitar firma GRATIS para open source
- https://signpath.io/oss → "Request free OSS signing".
- Datos: repo `https://github.com/getodevel-source/mambo-pedidos`, licencia
  del proyecto, tu nombre/email.
- **La aprobación es manual de SignPath** (suele tardar 1-3 días hábiles).
- Requisito: el repo debe ser público (lo es).

## 3. Configurar el proyecto en SignPath (tras la aprobación)
- Crear una **signing policy** con slug `release-signing` (el workflow la usa).
  Si preferís otro slug, cambiá `signing-policy-slug` en release.yml.
- Crear/designar un **certificado de firma** (SignPath provee uno, o importás
  el tuyo). Anotar el `certificate-id` (UUID).

## 4. Setear 3 secrets en GitHub
Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|---|---|
| `SIGNPATH_API_TOKEN` | API token de SignPath (Project → API token) |
| `SIGNPATH_ORG_ID` | Organization ID de SignPath (UUID) |
| `SIGNPATH_CERT_ID` | Certificate ID del paso 3 (UUID) |

## 5. Próximo release = instalador firmado
- Bump de versión → tag `v*` → push. El job de Windows:
  1. Compila con tauri-action (release provisional sin firma).
  2. **Firma el .exe con SignPath** (paso condicionado a los secrets).
  3. **Regenera el .sig del updater** sobre el exe firmado (`tauri signer sign`).
  4. Re-subee exe + .sig con `--clobber`.

## Realidad de SmartScreen (honesta)
- Con la firma, el publisher pasa a ser "Mambo Pedidos" (ya no "Editor
  desconocido").
- SmartScreen puede seguir mostrando una advertencia hasta que la app acumula
  suficientes descargas/instalaciones (reputación). Es gradual, no inmediato.
- Un EV cert daría reputación inmediata, pero SignPath OSS es gratis.

## Verificación rápida tras el primer release firmado
```powershell
# En PowerShell (Windows), confirmá el publisher:
Get-AuthenticodeSignature .\Mambo.Pedidos_*.exe
# Status debe ser "Valid" y SignerCertificate → SignPath/CA
```
