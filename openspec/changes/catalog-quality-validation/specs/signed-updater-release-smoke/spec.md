# signed-updater-release-smoke Specification

## Purpose

Exercise trust in a real signed updater release in a disposable environment, in parallel with PDF and spreadsheet characterization and before UI E2E. This validates an existing updater path; it does not publish a release or add an unsigned fallback.

## Requirements

### Requirement: Environment-gated signed-release evidence

The smoke test MUST run only when `TAURI_SIGNED_SMOKE=1` and a pinned release manifest supplies metadata URL, version, platform, artifact identity, and expected hash. It MUST verify the app’s configured public key and reject placeholder or mismatched metadata. The private signing key, credentials, generated installers, and user data MUST remain outside the repository and MUST NOT be required by the test. Without the gate, the result MUST be `SKIPPED_ENVIRONMENT_GATED`, not a pass.

#### Scenario: Configured signed release

- **GIVEN** an approved manifest, reachable signed metadata, and a disposable install/data directory
- **WHEN** the updater checks the release
- **THEN** metadata, platform artifact, configured public key, signature, version, and hash agree before download/install is allowed

### Requirement: Install, restart, and data preservation

The smoke test MUST exercise check, signed download, verification, install, and restart using a disposable installation. A sentinel catalog/history record MUST survive restart, and the test MUST record each transition and final version. A failed verification MUST prevent installation.

#### Scenario: Successful update

- **GIVEN** a valid signed artifact and sentinel app data
- **WHEN** the updater installs and restarts the disposable app
- **THEN** the expected version starts, the sentinel data is preserved, and the evidence identifies the manifest and artifact

### Requirement: Tamper rejection and safe recovery

The updater MUST reject a tampered signature, metadata, or artifact before installation, MUST NOT bypass verification or fall back to unsigned content, and MUST leave the prior app/data state usable. The test MUST clean up the disposable environment and MUST NOT mutate developer data.

#### Scenario: Tampered artifact

- **GIVEN** an artifact or signature changed after the approved manifest was pinned
- **WHEN** download verification runs
- **THEN** installation is rejected with a machine-readable failure, the old version remains active, and the sentinel data is unchanged
