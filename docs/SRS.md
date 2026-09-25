# Mambo Pedidos Target Release — Software Requirements Specification

## Target outcome

The target release shall let Mambo operate a reviewable, local-first Tauri desktop workflow from supplier catalog ingestion through order assembly, quotation, import planning, and import tracking. It is an internal Mambo tool with no cloud service, synchronization, accounts, or multiuser behavior. It shall improve extraction and fiscal-data integrity without sending catalog, image, order, quotation, tracking, or model-input data to an AI or cloud provider.

The target includes two hardware profiles: **Core**, without AI capability, and **Full**, with the locally distributed model set, optional GPU acceleration, and an allowed CPU fallback. The approved Full-profile architecture is `Qwen3-Embedding-0.6B` for NCM candidate retrieval, `Qwen3-Reranker-0.6B` for reranking/scoring/abstention, and an application-managed on-demand `Qwen3.5-4B` GGUF sidecar for comparison and explanation. That architecture is `APPROVED ARCHITECTURE — BENCHMARK GATED`; it makes no claim that any accuracy, calibration, latency, or working-set threshold has already been met. Approved local models remain deterministic/manual fallbacks when absent or unusable. Every critical AI-assisted, fiscal, exchange-rate, or document decision remains evidence-bearing, provenance-bearing, confidence/uncertainty-labelled, explicitly approved, overridable, and fail-closed.

---

## 1. Document control and baseline

| Item | Value |
|---|---|
| Document ID | `SRS-MAMBO-TARGET` |
| Document version | `1.2.0` |
| Status | Target baseline for review and approval |
| Date | 2026-09-25 |
| Product | Mambo Pedidos |
| Baseline commit | `c6500a7284ad1d85ef3503d093194b1788062595` |
| Baseline application version | `2.2.31` in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` |
| Target release version | `OD-001` — not yet approved |
| Product authority | Approved product decisions in this document take precedence over current implementation and historical documentation |
| Requirement authority | A stable requirement ID in this document is normative when the target release is approved; current-baseline statements are descriptive only |
| Local NCM/advisor architecture | `APPROVED ARCHITECTURE — BENCHMARK GATED`; approval covers the architecture and model roles, not achieved accuracy. Activation requires `TBD-015` and `OD-017`. |

### 1.1 Normative language and priority

The terms **shall** and **must** indicate mandatory target behavior. **Should** indicates a recommended behavior that requires documented disposition if not implemented. **May** indicates an optional behavior. A **Critical decision** is a decision that changes accepted business data, fiscal treatment, financial output, issued documents, tracked state, or durable data. **PROPOSED** and **PENDING OWNER APPROVAL** identify research targets only; they are non-normative until approved in this SRS.

| Priority | Meaning |
|---|---|
| Must | Required for target release acceptance |
| Should | Required unless a reviewed exception identifies an alternative and residual risk |
| Could | Optional enhancement; absence does not block release if the core workflow remains complete and fail-closed |

### 1.2 Requirement identifier and acceptance-test convention

- Requirement IDs are permanent within this SRS. Renaming an ID is prohibited; a retired requirement is marked superseded by a new ID.
- Unless a row states otherwise, its acceptance-test ID is the requirement ID prefixed with `AT-`, for example requirement `FR-021` maps to `AT-FR-021`.
- Every requirement is traced to one or more automated tests, a documented manual inspection, or both.
- A release claim is valid only when the cited acceptance test is revalidated against the release candidate.

### 1.3 Evidence and historical-document rule

Current implementation evidence is cited by repository path and, where useful, symbol. Historical documents, screenshots, release notes, and metrics are **not normative** unless they are revalidated against the release candidate and recorded in the release evidence package. In particular, historical parser recall, precision, false-positive, and performance claims shall not be used as current acceptance evidence.

### 1.4 Requirement source hierarchy

1. Approved product decisions 1–14, numbered in Section 25.2 and restated in Sections 2–6 and 14.
2. Normative requirements in this SRS.
3. Approved thresholds in Section 26.4.
4. Current implementation evidence in Section 5.
5. Historical documents, which have no normative authority.

---

## 2. Executive summary and product definition

Mambo Pedidos is an internal desktop application for Mambo. The target release is a Tauri-based, local-first application whose controlled business flow is:

`catalog ingestion → reviewed catalog → order → cost/profitability scenario → quotation → import plan → import tracking`

The release does not become an ERP or a multiuser service. Inventory, payments, purchasing, sales, accounting, direct carrier integrations, accounts, tenants, cloud synchronization, AI/cloud inference providers, and a remote application database are outside scope.

The release closes material baseline weaknesses through seven control objectives. The central target problem is PDF-to-catalog quality: wrong or imprecise product data and images attached to the wrong product. Every accepted row must remain traceable to the page region and image evidence that produced it, and improvements must be demonstrated on a per-catalog holdout rather than asserted.

1. **Evidence before acceptance:** deterministic parsing remains the primary path; local OCR, vision, NCM retrieval/reranking, and on-demand assistance may help; every accepted critical value remains traceable to source evidence or an explicit human override.
2. **Fail-closed critical decisions:** no AI result, stale fiscal input, missing model, failed integrity check, corrupt store, unavailable native key store, or invalid import state may silently become accepted business data.
3. **Fiscal update integrity:** official fiscal and tariff datasets are checked daily, staged, validated under an owner-approved source-specific integrity strategy, activated atomically, cached, and exposed with source/date/version/validity. The last known good package remains available offline; a warning appears after seven days without a successful update and critical fiscal results are blocked after 30 days.
4. **Local data protection:** business data does not persist in browser LocalStorage; primary storage, automatic local/external backups, and migrated quote/configuration data use authenticated encryption and verified native key management; CSP and outbound network controls are deny-by-default.
5. **Reproducible commercial records:** quotations use 15-day validity and consecutive, non-reused numbering; corrections create new versions, and cancellation/substitution events remain append-only. Financial/fiscal records remain available for ten years before archival, while technical logs follow the one-year policy except for protected incident evidence.
6. **Transparent reference data:** DolarAPI may provide a secondary exchange-rate reference only with explicit `casa`, `compra`/`venta`, source timestamp, local retrieval timestamp, stale/unavailable state, and no silent side or field fallback.

The target remains usable without AI models. The **Core** profile then provides deterministic extraction, explicit unavailable states, manual review, and no fabricated assistance. The **Full** profile adds the approved local model set; GPU acceleration is optional and CPU execution is allowed when it meets the approved capability gates. Exact hardware values remain pending model dimensioning and owner approval.

---

## 3. Product vision, problem, goals, and success outcomes

### 3.1 Product vision

Mambo shall have one auditable desktop workflow for turning heterogeneous supplier information into reviewed products, financially explainable orders and quotations, and trackable import plans. The user shall be able to explain where each accepted value came from and why a critical value was accepted.

### 3.2 Current problems

- The central current problem is PDF-to-catalog pipeline quality: extracted fields are incorrect or imprecise, prices are not consistently grounded, and product photos are attached to the wrong row.
- There is no end-to-end per-row trace from page region to extracted value, image reference, and checksum, so wrong associations are difficult to detect and correct.
- Catalog extraction is deterministic but depends on selectable PDF text; scanned PDFs lack an OCR runtime.
- Image checks are heuristic and do not establish that an image depicts the named product.
- The R1–R10 quality contract has implementation-specific ambiguity and upstream-status exceptions.
- Ground truth is stale and not aligned sufficiently to support historical quality claims.
- The bundled NCM snapshot contains 10,504 records and lacks a reliable automatic refresh policy.
- Fiscal rates and validity are embedded in application code; no single consolidated machine-readable national source was verified for IVA, perceptions, regimes, and IIBB.
- DolarAPI handling has no governed `bolsa`/internal `mep` contract, no `compra`/`venta` side selection for critical calculations, and no complete stale/unavailable policy.
- Backups do not use the primary store's encryption path, and some configuration/history uses direct LocalStorage.
- `keyring = "3"` without explicit native-store features does not prove Windows Credential Manager or Linux Secret Service behavior; the mock store must not be treated as production security.
- CSP permits broad HTTPS connectivity and inline scripts.
- Worker/OffscreenCanvas work is documented only as a spike.
- Linux packaging has AppImage/DEB but no RPM; the current smoke matrix includes Fedora 41, which is outside the proposed target set.
- README version `2.2.0` is stale relative to manifest version `2.2.31`.

### 3.3 Product goals

- Preserve and improve the catalog-to-order-to-quotation-to-import workflow.
- Make every imported row correctorable: retain page, bounding box/coordinates, source text, price evidence, image reference, and checksum; associate images from spatial/column/region evidence rather than visual similarity alone.
- Measure extraction fields, prices, SKU, product identity, image association, and duplicates as separate benchmark dimensions; an iteration that does not improve the per-catalog holdout is not an improvement.
- Make source evidence, quality status, model provenance, fiscal provenance, overrides, and approvals inspectable.
- Support scanned catalogs through optional local OCR with explicit no-model and partial-import behavior.
- Make official fiscal data updates safe, atomic, auditable, current enough for critical use, and usable offline.
- Govern Argentina national tax calculations and province-configurable IIBB through reviewed adapters rather than implying a national consolidated source.
- Protect local business data with verified native credential stores, encrypted local/external backups, recovery objectives, and prevented unintended egress.
- Make Windows x64 and the owner-approved Linux x86_64 package/distribution matrix release-grade; do not claim ARM64 in the first normative release.
- Replace historical metric assertions with release-candidate evidence.

### 3.4 Success outcomes

The target is successful when an authorized internal user can complete the critical workflows on every supported platform, recover from the defined failure modes, and produce a traceable record for every accepted critical decision. Quantitative extraction, OCR, vision, performance, capacity, hardware, and accessibility thresholds are not invented here; they are approval obligations in Sections 26.2 and 26.4.

---

## 4. Stakeholders and operational roles

These are workflow personas, not authentication roles. The target has no accounts, permissions, or multiuser administration.

| Stakeholder / operational role | Needs and authority |
|---|---|
| Catalog operator | Import supplier files, inspect evidence, resolve quality warnings, edit products, and approve selected catalog items |
| Order and quotation operator | Build an order, verify costs and profitability, issue a quotation, and export documents |
| Import planner | Configure the import scenario, verify NCM/tax inputs, save the plan, and create a tracked import record |
| Fiscal reviewer | Approve NCM classification, tariff overrides, exchange-rate use, and fiscal assumptions used in a critical output |
| Quality reviewer | Inspect extraction and AI/OCR/vision evidence, approve or reject suggestions, and maintain the revalidated test corpus |
| Release operator | Build signed artifacts, execute platform gates, publish release evidence, and perform rollback |
| Product owner | Approves scope, unresolved thresholds, and release disposition; as the owner of Mambo, acts as fiscal release approver without providing legal certification |
| Support operator | Collect a redacted local diagnostic bundle only after user action; does not receive automatic business-data uploads |

---

## 5. Current baseline versus target state

### 5.1 Current baseline evidence

| Area | Current baseline | Evidence |
|---|---|---|
| Version | Manifests report `2.2.31`; README reports stale `2.2.0` | `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `README.md` |
| Architecture | Tauri 2 + Rust + vanilla HTML/CSS/JavaScript; no remote backend or remote database | `src-tauri/Cargo.toml`, `src/bridge/tauri-bridge.mjs`, `package.json` |
| File ingestion | PDF, CSV, XLSX, XLS from files, folders, and drag-and-drop | `src/index.html`, `src/js/app.js`, `src/js/ui/importFlow.js::ImportFlow.processFiles` |
| PDF extraction | Deterministic spatial extraction; selectable text required; scanned pages produce warnings/errors but no OCR runtime | `src/js/pdfParser.js::PdfParser.processPdfFile` |
| Per-row trace/correction | No complete per-row chain of page, bounding box/coordinates, source text, price evidence, image reference, and checksum; wrong row/image associations are hard to diagnose | Repository baseline; `GAP-027` |
| Local model runtime | No approved local NCM embedding retrieval, reranking/abstention, or application-managed on-demand advisor sidecar | Repository baseline; `ARC-001` |
| Extracted data | Products, source-file association, prices, warnings, image evidence, and quality state | `src/js/pdfParser.js`, `src/js/ui/importFlow.js`, `src/js/catalogValidator.js` |
| Quality gate | R1–R10, spatial grounding, image heuristics, GREEN/YELLOW/RED; RED is not importable; missing image may be YELLOW | `src/js/catalogValidator.js::CatalogValidator.evaluateItem` and `validateItem` |
| Catalog | Search, filters, pagination, table/gallery, inline edit, image replacement, quantities, delete and undo | `src/js/ui/catalogView.js::CatalogView`, `src/js/app.js::updateProductImage`, `toastUndo` |
| Order assembly | Validates products, blocks RED, handles warnings, snapshots item and cost inputs | `src/js/app.js::validarYOarmarPedido`, `armarPedido`; `src/js/ui/historyView.js::HistoryView.save` |
| Calculator | FOB, freight, insurance, CIF, duties, taxes, courier/despachante, cash cost, net cost, tax credits, margin, ROI, alerts; PAIS is 0% | `src/js/calculator.js::calculateOrder`, `calculateDoorToDoorExactCost`, `getPaisLine` |
| Documents | CSV, XLSX, packing list, executive report, diagnostic JSON, printable quotation | `src/js/fileImporter.js`, `src/js/quoteGenerator.js`, `src/js/reliability.js` |
| Import wizard | Six steps: catalog, order, freight/insurance, taxes/customs/NCM, destination expenses, summary; project persistence, NCM overrides, tax-expiry warning | `src/js/ui/importWizard.js::ImportWizard.steps`, `state`, `saveProject`, `_ratesBanner` |
| Import tracker | Persistent non-reused `IMP-xxxx`; states `ordered`, `in_transit`, `in_customs`, `cleared`, `delivered`, `cancelled`; invalid transitions rejected | `src/js/importsTracker.js::ImportsTracker.STATUS_MACHINE`, `createRecord`, `advanceStatus` |
| Persistence | Tauri Store primary; LocalStorage fallback; images on disk; conditional AES-GCM when WebCrypto/bridge/keychain are available | `src/js/storage.js::AppStorage`, `src/bridge/tauri-bridge.mjs` |
| Native key management | Cargo declares `keyring = "3"` without explicit `windows-native` or Secret Service features; native Windows/Linux behavior is therefore unproven and the keyring mock must not be accepted as production evidence | `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs::keychain_get`, `keychain_set` |
| Backups | Catalog backup exists in LocalStorage and a disk JSON file, but does not use the primary encryption envelope | `src/js/reliability.js::createBackup`, `_writeDiskBackup` |
| Other LocalStorage use | Quote configuration/history and diagnostic/error state use direct LocalStorage | `src/js/quoteGenerator.js::QuoteGenerator`, `src/js/diagnostics.js`, `src/js/reliability.js` |
| NCM | Bundled JSON has 10,504 records; no reliable automatic official refresh policy | `src/data/ncmDatabase.json`, `src/js/ncmDatabase.js::NcmDatabase` |
| Static fiscal matrix | NCM/rates/certifications and validity metadata are embedded in code | `src/js/calculator.js::NCM_MATRIX`, `RATES_META` |
| Image validation | Heuristics for crop/content/aspect/color/text; no semantic recognition of the depicted product | `src/js/imageQuality.js::ImageQuality`, `src/js/imageTextGates.js` |
| Parser worker | Worker/OffscreenCanvas is a design/spike document, not runtime | `docs/SPIKE-WORKER-PARSE.md` |
| QA corpus | Ground truth is stale/incompletely aligned; historical recall claims are not current truth | `ground-truth/manifest.json`, `ground-truth/verdicts.json`, `scripts/ground-truth-diff.js` |
| Network | DolarAPI and signed GitHub release updater are current external paths; DolarAPI response records are indexed by `casa`, while the UI/calculation path uses an inconsistent `bolsa`/`mep` alias and side fallback | `src/js/app.js::fetchLiveDolarRates`, `renderDolarBadges`, `applyDolarRate`; `src/js/updater.js`; `src-tauri/tauri.conf.json` |
| Linux packaging/QA | AppImage/DEB targets exist, RPM is absent, and the smoke matrix includes unsupported Fedora 41 | `src-tauri/tauri.conf.json`, current CI smoke configuration |
| Absent capabilities | No accounts, roles, multiuser, payments, stock, carrier integrations, remote backend, OCR runtime, or semantic vision runtime | Repository baseline and product decisions |

### 5.2 Target-state summary

| Concern | Current baseline | Target requirement | Gap |
|---|---|---|---|
| Version control | README and manifests disagree | One generated/verified release version across manifests and user-facing release docs | `GAP-001` |
| Scanned PDFs | Detection and warning, no OCR | Explicit OCR-required state; optional local OCR; partial/no-model fallback | `GAP-002` |
| PDF-to-catalog traceability and correction | Incorrect/imprecise fields and wrong row/image associations are not consistently traceable to page region evidence | Per-row page/bbox/source text/price evidence/image reference/checksum; spatial image association; immutable original evidence; explicit staged pipeline and atomic commit | `GAP-027` |
| Local NCM/advisor architecture | No approved local retrieval/reranking/advisor stack or per-catalog benchmark gate | `Qwen3-Embedding-0.6B` top-8 retrieval, `Qwen3-Reranker-0.6B` scoring/abstention, on-demand `Qwen3.5-4B` Q4_K_M sidecar, 16 GB working-set budget; `APPROVED ARCHITECTURE — BENCHMARK GATED` | `GAP-028`, `ARC-001` |
| Parser execution | Main-thread path; worker is spike | Validated worker path or approved main-thread alternative meeting performance/equivalence gates | `GAP-003` |
| Quality contract | R1–R10 semantics and exceptions are ambiguous in code | Versioned, normative per-rule contract with fixtures and human resolution | `GAP-004` |
| Image meaning | Heuristics only | Heuristics remain non-semantic; optional local semantic suggestion is labeled as assistance and requires approval | `GAP-005` |
| Quality evidence | Stale/incomplete ground truth | Revalidated, versioned corpus aligned to current parser and release candidate | `GAP-006` |
| NCM completeness | 10,504-record snapshot | Integrity-managed official universe using HTTPS/schema/source-date provenance and an owner-approved integrity strategy; no hard-coded completeness count or claimed publisher signature | `GAP-007`, `GAP-020` |
| Fiscal scope/update | Static matrix and local snapshot; fragmented legal/IIBB sources | Argentina national rules plus province-configurable IIBB through jurisdiction adapters; daily check, warning at 7 days, critical block at 30 days, atomic activation, and LKG offline use | `GAP-008`, `GAP-020`, `GAP-021` |
| Exchange-rate reference | DolarAPI is an ungoverned secondary path with `bolsa`/`mep` inconsistency and side fallback | Explicit secondary-reference adapter, `compra`/`venta` selection, source/retrieval timestamps, stale/unavailable state, and no silent side/field fallback | `GAP-017` |
| Backups | Plaintext disk/LocalStorage path | Automatic encrypted local and external backups, verified restore, RPO 24 hours, and RTO 4 hours; retention/key recovery remain open | `GAP-009`, `GAP-022` |
| Retention | Periods and incident holds are not consistently governed | Financial/fiscal records retained 10 years before archive; technical logs retained 1 year; explicit deletion and protected incident evidence | `GAP-023` |
| Quotations | Numbering, correction, cancellation, and validity are not governed to the approved policy | 15-day validity, consecutive non-reused numbering, correction versions, and append-only cancellation/substitution | `GAP-024` |
| Model distribution/profiles | Models are not governed as a release component; hardware values are unresolved | Main distribution includes approved local models with license/size/integrity disclosure; Core has no AI and Full permits optional GPU plus CPU fallback | `GAP-025` |
| Native key management | Native store selection is unverified | Windows Credential Manager and Linux Secret Service are explicit, release-gated targets; mock storage is test-only and never satisfies readiness | `GAP-019` |
| LocalStorage leakage | Business quote/config/diagnostic data can persist there | No durable business data in LocalStorage; migration and explicit non-persistent fallback | `GAP-010` |
| CSP/network | Inline scripts and broad HTTPS connectivity | No unsafe inline/eval; exact outbound allowlist; default-deny business egress | `GAP-011` |
| Parser corpus claims | Historical metrics not aligned | Release evidence from current, revalidated corpus only | `GAP-012` |
| Linux packaging | AppImage/DEB present in config; RPM absent; macOS DMG still configured | x86_64 AppImage, DEB, and RPM target; macOS removed from target release | `GAP-013`, `GAP-026` |
| Platform QA | Runtime verification is strongest on Windows; Fedora 41 is in the current smoke matrix | Owner-approved Ubuntu, Debian, Fedora, Arch, and Omarchy gates; exact versions and WebKitGTK 4.1 baseline remain `PROPOSED — PENDING OWNER APPROVAL` | `GAP-014`, `GAP-026` |

---

## 6. Scope, non-goals, assumptions, and constraints

### 6.1 In scope

- PDF, CSV, XLSX, and XLS catalog/order ingestion from files, folders, and drag-and-drop.
- A traceable PDF-to-catalog pipeline with per-row page/bounding-box/source-text/price-evidence/image-reference/checksum records, spatial image association, and correctorable immutable original evidence.
- Deterministic extraction plus locally distributed optional OCR, vision, NCM retrieval/reranking, and on-demand field-comparison assistance under Core/Full profiles.
- Evidence, confidence or uncertainty, provenance, quality review, human overrides, and fail-closed import.
- Catalog search, editing, image management, quantities, and order assembly.
- Costing, profitability, quotations, and document exports under the approved 15-day quotation lifecycle.
- Six-stage import planning covering Argentina national fiscal rules and province-configurable IIBB.
- Import tracking with durable, non-reused IDs and controlled state transitions.
- Automatic official fiscal/dataset checks, daily refresh attempts, local LKG cache, atomic activation, 7-day warning, 30-day critical block, and offline operation.
- Protected local persistence, native key management, automatic encrypted local/external backup, restore, migration, diagnostics, retention, and auditability.
- Windows x64 and Linux x86_64 AppImage/DEB/RPM distribution and QA; ARM64 remains outside the first normative release.

### 6.2 Explicit non-goals

The target release shall not provide:

- cloud hosting, remote backend, remote application database, or business-data synchronization;
- user accounts, authentication, roles, permissions, tenants, or multiuser collaboration;
- payment collection, payment reconciliation, or payment-provider integrations;
- stock control, warehouse management, purchasing, sales management, or accounting ledgers;
- direct carrier APIs, shipment booking, label purchase, or carrier tracking integrations;
- macOS support;
- autonomous acceptance of AI, OCR, vision, or NCM recommendations;
- direct publication of a fiscal classification as a legal determination without human approval;
- a required user-managed external Ollama or llama-server installation, remote inference service, or model endpoint outside the application-managed local runtime;
- automatic acceptance of a price, SKU, NCM code, product identity, image association, or any other critical value from model output.

### 6.3 Assumptions

| ID | Assumption | Validation / effect |
|---|---|---|
| ASM-001 | One interactive local user operates one application instance at a time | Must not be represented as collaborative multiuser behavior |
| ASM-002 | The workstation has a supported WebView/runtime and sufficient disk for local datasets, images, and the Full-profile model set | Core/Full profiles are approved; exact hardware values remain `TBD-006` pending model dimensioning |
| ASM-003 | Official fiscal sources can be reached through source-specific adapters and validated technical artifacts | No single consolidated national JSON is assumed; source schemas and integrity strategies remain `OD-003` |
| ASM-004 | The user retains responsibility for commercial and legal decisions, and the owner of Mambo is the fiscal release approver | The application provides evidence and warnings, not legal or tax certification |
| ASM-005 | Approved local model artifacts can be included in the main distribution after license, integrity, size, and support review | Capability components may be packaged separately only where packaging constraints are documented; remaining policy details stay in `OD-009` |
| ASM-006 | Signed application update traffic is release control-plane traffic and carries no catalog, order, quote, tracking, or image payload | Governed separately by `PLAT-011` through `PLAT-014`; all business-data egress remains prohibited |
| ASM-007 | The approved Full-profile model roles can be satisfied by Apache-2.0 artifacts `Qwen3-Embedding-0.6B`, `Qwen3-Reranker-0.6B`, and `Qwen3.5-4B` GGUF Q4_K_M running locally under the 16 GB shared-RAM working-set budget | Architecture is `APPROVED ARCHITECTURE — BENCHMARK GATED`; activation and metric thresholds remain `OD-017`/`TBD-015` |
| ASM-008 | The 13 real supplier catalogs can be partitioned by catalog for benchmark train/dev/holdout evaluation without cross-catalog leakage | Benchmark split, labeling, and holdout approval are release evidence under `NFR-028` |

### 6.4 Constraints

- The product remains local-first and Tauri-based.
- The current vanilla frontend and Rust/Tauri baseline may be evolved, but behavior is governed by this SRS rather than by current module structure.
- Existing parser, quality, fiscal, storage, and release changes require revalidated regression evidence.
- Offline operation is required; only approved official fiscal traffic, the approved secondary DolarAPI reference path, and signed application update control-plane traffic may be initiated.
- Critical fiscal results are blocked after 30 days without a successful official-source update; no reference API is treated as an official fiscal source.
- The Full-profile model stack shall run locally under a 16 GB shared-RAM working-set envelope; the application manages the advisor sidecar lifecycle and shall not require an external Ollama or llama-server installation.
- NCM retrieval, reranking, and the advisor may rank, compare, score, and explain; they shall never be the source of truth for a critical field and shall never rewrite original extraction evidence.
- Benchmark adoption is decided on the 13 real catalogs with a per-catalog split. Provider or MTEB results alone are not acceptance evidence for Mambo.
- No requirement may be satisfied by silently removing evidence, weakening integrity, or defaulting an unapproved critical value.

---

## 7. Target workflows and use cases

### 7.1 Major use cases

| ID | Use case | Primary actor | Outcome |
|---|---|---|---|
| UC-001 | Import a selectable-text supplier catalog | Catalog operator | Evidence-backed product preview and explicit commit decision |
| UC-002 | Import a scanned supplier catalog | Catalog operator | Local OCR when available; otherwise explicit unavailable/partial decision |
| UC-003 | Resolve quality and semantic-image suggestions | Quality reviewer | Approved, rejected, or overridden fields with audit trail |
| UC-004 | Build and save an order | Order operator | Immutable item/cost snapshot used for later quotation |
| UC-005 | Calculate and issue a quotation | Order operator | Reproducible financial document bound to a cost/fiscal scenario |
| UC-006 | Plan and save an import scenario | Import planner | Versioned plan with NCM, assumptions, and validity warnings |
| UC-007 | Update official fiscal data | System / fiscal reviewer | Verified package activated atomically or LKG retained |
| UC-008 | Track an import | Import planner | Valid state transitions, timestamps, costs, and profitability |
| UC-009 | Back up, restore, or recover local data | Support operator / user | Verified restore with no silent overwrite and no partial commit |
| UC-010 | Work offline or without local models | Any operator | Deterministic core remains available; unavailable assistance is explicit |
| UC-011 | Obtain a local NCM candidate shortlist and reranked suggestion | Fiscal reviewer | Evidence-bearing ranked candidates with score, margin, and explicit abstention; no accepted classification |
| UC-012 | Diagnose and correct a wrong imported row or image association | Catalog operator | Page region, source text, price evidence, image reference, and checksum expose the defect before an audited correction |

### 7.2 Acceptance scenarios

#### SCN-001 — Selectable-text PDF import

- **Given** a supported PDF with selectable text and a valid spatial product table
- **When** the user selects the file and approves the import preview
- **Then** the application extracts candidate products, records source and grounding evidence, presents quality dispositions, excludes RED items, and commits only explicitly selected approved items.

#### SCN-002 — Scanned PDF with local OCR

- **Given** a PDF with pages lacking sufficient selectable text and an available, integrity-verified local OCR model
- **When** the user starts the import
- **Then** the application marks the job `ocr_required`, runs OCR locally, records page/model provenance, and returns the job to evidence review without external transmission.

#### SCN-003 — Scanned PDF without OCR model

- **Given** a scanned or partially scanned PDF and no usable local OCR model
- **When** extraction cannot cover all pages
- **Then** the application remains in `ocr_unavailable`, identifies excluded pages/reasons, and offers only explicit partial import or cancellation; it shall not fabricate text or silently mark pages complete.

#### SCN-004 — Partial import and idempotent retry

- **Given** an approved multi-file import in which one file fails during parsing or commit
- **When** the user retries
- **Then** completed approved items are not duplicated, the failed scope is identified, and the result is either `committed` or explicitly `partially_committed` with a recovery path.

#### SCN-005 — AI suggestion approval

- **Given** a local OCR, vision, or NCM suggestion with confidence and evidence
- **When** the suggestion is displayed
- **Then** it remains unaccepted until a human explicitly accepts, rejects, or edits it; the decision and prior value are auditable.

#### SCN-006 — Order and quotation reproducibility

- **Given** a saved order with selected catalog products and an explicit costing/fiscal scenario
- **When** the quotation is issued and later reopened
- **Then** the issued document reproduces the stored item, price, tax, exchange-rate, fiscal-package, calculation-version, and approval snapshot even if current catalog or fiscal data changes.

#### SCN-007 — Fiscal update failure and rollback

- **Given** an available last-known-good fiscal package and a candidate official update
- **When** the approved source-specific integrity strategy, schema, validity, or completeness verification fails
- **Then** the candidate is rejected, the current package remains active, the failure is visible, and no partial dataset is exposed to calculations. A local digest shall never be presented as a publisher signature.

#### SCN-008 — Import tracker transition

- **Given** a tracked import in `in_transit`
- **When** a user requests `cleared`
- **Then** the invalid transition is rejected without mutation; `in_customs` is required first unless a separately defined correction event is approved.

#### SCN-009 — Corrupt primary store

- **Given** a corrupt or unauthenticated primary store and a valid backup
- **When** the application starts
- **Then** it preserves the corrupt primary for diagnosis, previews the backup, requires explicit restore approval, verifies the backup before commit, and never overwrites the primary in place.

#### SCN-010 — Offline operation

- **Given** no network connectivity
- **When** the user imports, orders, quotes, plans, tracks, or calculates
- **Then** local deterministic features continue using cached or last-known-good data, stale/expiry status is visible, and failed refresh does not block safe local work. A fiscal source beyond the 30-day threshold still blocks critical fiscal results under `FISCAL-016`.

---

## 8. Product modules

| Module | Target responsibility |
|---|---|
| Source Intake | File/folder/drag intake, preflight, source identity, cancellation, and import-session state |
| Extraction | Deterministic PDF/spreadsheet parsing, per-row page/bbox/source-text/price-evidence/checksum capture, spatial image association, optional local OCR, page/file isolation, and diagnostics |
| Quality and Evidence | Versioned R1–R10 contract, image checks, confidence, provenance, human review, disposition, and immutable original-evidence retention |
| Catalog | Search, browse, edit, image management, quantity selection, deduplication, and durable storage |
| Local Assistance | `APPROVED ARCHITECTURE — BENCHMARK GATED`: local NCM embedding retrieval, reranking/abstention, and application-managed on-demand field-comparison advice; model license/integrity metadata, Core/Full profiles, 16 GB working-set budget, and deterministic no-model fallback |
| Orders | Validation, snapshots, editing, history, clone, delete/undo, and order-to-quotation lineage |
| Costing and Profitability | Explicit scenario inputs, formulas, provenance, warnings, cash/net cost, tax credits, margin, and ROI |
| Quotation and Documents | Consecutive numbering, 15-day validity, frozen versions, printable/exportable outputs, append-only cancellation/substitution, history, and reproducibility |
| Fiscal and Reference Data | Official-source adapters, source-specific integrity, daily checks, 7/30-day thresholds, activation, cache, LKG, IIBB jurisdictions, secondary exchange references, and offline state |
| Import Planning and Tracking | Six-stage plan, persistence, tracker records, valid state transitions, and rollups |
| Persistence and Recovery | Schema versions, protected store, images, backups, restore, migration, and data export |
| Security and Network | Encryption/key handling, CSP, endpoint allowlist, signed updates, path validation, and redaction |
| Diagnostics and Audit | Structured events, evidence links, health status, redacted support bundle, and release diagnostics |
| Packaging and Updates | Windows/Linux artifacts, signed release/update metadata, compatibility, upgrade, and rollback |

---

## 9. Functional requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-001 | Must | The application shall start as a local desktop application without requiring a remote backend or user account. | Approved local-first decision; `GAP-010` | Starting in an isolated network yields a usable local shell; network probes show no remote-backend login or database dependency. |
| FR-002 | Must | The user shall select supported files, folders, or drag-and-drop batches for import. | Baseline `ImportFlow.processFiles`; target parity | File, folder, and drag paths open the same preflight flow and preserve source identity. |
| FR-003 | Must | The application shall accept PDF, CSV, XLSX, and XLS inputs according to the supported import profile. | Baseline and scope | Each supported extension is routed to the correct adapter; unsupported content is rejected with a reason. |
| FR-004 | Must | The application shall validate file presence, non-zero size, declared type, detected type, and configured size limit before full processing. | Baseline `Reliability.validateFileSize` / `validateFileContent` | Valid fixtures pass; empty, mislabeled, corrupt, and over-limit fixtures fail before commit. |
| FR-005 | Must | Every import batch shall create a durable import session with stable identity, source list, timestamps, state, and attempt history. | Failure/retry traceability | Restart preserves the session and state; a second commit attempt references the same session. |
| FR-006 | Must | The application shall show file/page progress, current phase, warnings, and completion state. | Baseline `showProgress`; UX requirement | Progress updates identify the current file/page and terminal success/failure state. |
| FR-007 | Must | The user shall be able to cancel before catalog commit; cancellation shall retain diagnostic context but shall not commit unapproved items. | Approved fail-closed behavior | Cancel during extraction/OCR/preview leaves the catalog unchanged and records `cancelled` with the last completed scope. |
| FR-008 | Must | The application shall present a preview before importing products into the durable catalog. | Baseline preview; target evidence model | No product becomes durable before explicit confirmation; preview shows source, evidence, status, warnings, and selection. |
| FR-009 | Must | The preview shall support search, status filtering, field editing, item removal, batch category/brand actions, and explicit selection. | Baseline `ImportFlow` | Each control updates the candidate set and revalidates affected items before commit. |
| FR-010 | Must | Import confirmation shall commit only selected, approved, non-RED items and shall report added, updated, skipped, rejected, and failed counts. | Baseline `confirmImportPreview`; fail-closed rule | Fixture reconciliation proves the durable catalog exactly matches the approved selection and reported summary. |
| FR-011 | Must | Re-importing the same logical product shall update, skip, or conflict explicitly without creating an unintended duplicate. | Baseline identity deduplication | Repeating the same source file is idempotent; changed price/category is an explicit update; identity conflict requires review. |
| FR-012 | Must | The catalog shall support text search and brand, category, price, status, and selected-item filters. | Baseline `CatalogView.getFilteredCatalog` | Combined filters return the expected record set without mutating source data. |
| FR-013 | Must | The catalog shall support pagination and a table view; it should support a gallery view. | Baseline `CatalogView` | Table and optional gallery expose the same records, quantities, quality state, and actions. |
| FR-014 | Must | The user shall edit product identity, category, brand, model, variant, FOB, and image without bypassing quality revalidation. | Baseline inline editing | An edit triggers the applicable validation contract and displays the resulting status/reason. |
| FR-015 | Must | The user shall replace a product image and retain the prior image decision in the audit trail. | Baseline `updateProductImage`; target auditability | Replacement stores the new image reference and an audit event containing prior/new hashes and actor action. |
| FR-016 | Must | The user shall set positive integer order quantities and remove quantities/items with confirmation. | Baseline `adjustQty`, `setQty`, `removePedItem` | Zero, negative, nonnumeric, and out-of-range values are rejected; valid quantities are reflected in FOB totals. |
| FR-017 | Must | The user shall delete a catalog item or clear the catalog with confirmation and a time-bounded undo where the operation remains safely reversible. | Baseline `toastUndo` | Delete/clear does not occur without confirmation; undo restores identity, quantity selection, and image reference. |
| FR-018 | Must | The user shall assemble an order only from existing selected products after validation and warning disposition. | Baseline `validarYOarmarPedido` | Missing/RED products block assembly; accepted warnings are recorded before snapshot creation. |
| FR-019 | Must | The application shall support saving, loading, cloning, and deleting order history with immutable source snapshots. | Baseline `HistoryView` | Cloning creates a new order ID; loading does not alias mutable history; delete supports audited undo where feasible. |
| FR-020 | Must | The application shall export supported order, packing-list, quotation, and diagnostic documents locally. | Baseline `FileImporter` and `QuoteGenerator` | Exports complete without network access and identify scenario/version/provenance required by their type. |

---

## 10. Business rules and calculation rules

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| BR-001 | Must | RED products shall not be importable into the durable catalog or a confirmed order. | Baseline quality gate | Any RED candidate is excluded and a selection containing only RED items cannot commit. |
| BR-002 | Must | Missing or invalid required image evidence shall produce YELLOW or RED according to the versioned quality contract and shall never be GREEN. | Baseline R9 | Missing-image fixture has the documented status and explicit user disposition. |
| BR-003 | Must | A YELLOW item shall not become GREEN or be durably accepted without explicit review or a recorded override permitted by the quality contract. | Approved human approval; fail-closed | Unreviewed YELLOW is not selected by default when data quality is uncertain; approval event is recorded. |
| BR-004 | Must | Deterministic validation shall not promote an upstream RED or YELLOW state to GREEN. | Baseline `evaluateItem` upstream handling | Fixtures with degraded upstream status remain degraded and display the governing reason. |
| BR-005 | Must | Every accepted critical field shall have either source evidence or an explicit human override with actor, timestamp, prior value, new value, and reason. | Approved decision 3 | Audit inspection links each critical field to evidence or override. |
| BR-006 | Must | SKU values shall be non-empty, syntactically valid, and unique within the durable catalog. | Baseline validation | Duplicate, empty, invalid, and case-normalized collision fixtures are detected before commit. |
| BR-007 | Must | Deduplication shall use an explicit versioned identity policy and shall preserve source provenance from every contributing source. | Baseline `SkuAllocator.identityKey` | Same identity updates/merges deterministically; different products with similar text do not merge silently. |
| BR-008 | Must | FOB shall be a finite, explicitly entered or evidence-grounded value greater than zero for an importable priced product. | Baseline R1 | Missing, zero, negative, and ungrounded values cannot be accepted without a documented override path. |
| BR-009 | Must | Order quantity shall be a positive integer within the approved range and shall multiply unit FOB consistently. | Baseline order UI | Boundary and invalid quantity tests produce the documented result and do not corrupt totals. |
| BR-010 | Must | A saved order shall store immutable snapshots of selected product identity, FOB, quantity, evidence reference, and calculation input state at save time. | Approved order snapshot behavior | Later catalog edits do not change a saved order's historical snapshot. |
| BR-011 | Must | CIF shall equal FOB plus freight plus insurance for the active scenario, with each component's basis, rate, and amount shown. | Baseline calculator | Golden tests reconcile displayed components and `CIF` exactly within approved rounding. |
| BR-012 | Must | Freight allocation shall use the explicit selected basis and shall warn when required weight or monetary inputs are missing. | Baseline `calculateDoorToDoorExactCost` | Weight and FOB fallback fixtures identify the selected allocation and warning. |
| BR-013 | Must | Cash outlay and net economic cost shall remain separate; recoverable tax shall not be silently removed from cash requirements. | Baseline cost model | Documents display both values and their included/excluded components. |
| BR-014 | Must | Tax-credit treatment shall be explicit by component and shall not classify a tax as recoverable without a rule or explicit scenario setting. | Baseline `totalRecuperableUsd` | Each tax line shows amount, recoverability, and basis; changing the setting changes net cost and credit consistently. |
| BR-015 | Must | PAIS shall be represented as 0% with status `eliminated` unless a separately approved fiscal dataset and human-approved scenario explicitly change the product rule. | Baseline `Calculator.getPaisLine`; target no silent legal change | Default output is 0%; any future nonzero behavior requires a new approved rule/version and test. |
| BR-016 | Must | Exchange-rate use shall record value, currency pair, source, `casa`, selected `compra` or `venta` side, source observation/update timestamp, local retrieval timestamp, stale/unavailable state, cache timestamp, and manual override state. | Approved decision 11; `GAP-017` | Online, cached, stale, unavailable, and manual-rate scenarios expose the exact source basis used by every calculation. |
| BR-017 | Must | Monetary calculations shall use one documented rounding policy per currency and reconcile displayed line totals to document totals. | Baseline reconciliation comments | Golden tests prove no unexplained cent or minor-unit residual. |
| BR-018 | Must | NCM/tariff override precedence shall be explicit, documented, and stable: item override, then approved scenario rule, then active fiscal dataset/category default. | Baseline `ncmBySku` / `ncmOverrides` | Fixture with all three sources proves the selected source and resulting rates. |
| BR-019 | Must | Expired or unverified fiscal data shall block silent issuance of a final quotation/import plan and shall require explicit reviewer disposition or replacement with verified data. | Approved fiscal integrity | Stale-data scenario blocks final approval until an auditable disposition exists. |
| BR-020 | Must | An issued quotation shall be bound to a frozen order, cost, fiscal, exchange-rate, template, and calculation snapshot. | Reproducible quotation target | Reopening or exporting an issued quote reproduces the issued values and metadata. |
| BR-021 | Must | Tracker numbers matching `IMP-xxxx` shall be monotonic and never reused, including after deletion or restore. | Baseline and approved behavior | Create/delete/restore sequence produces no duplicate tracker number. |
| BR-022 | Must | Only transitions defined by the target tracker state machine shall be accepted; invalid transitions shall not mutate the record. | Baseline `STATUS_MACHINE` | Transition matrix test rejects every unlisted edge and records no timestamp on rejection. |
| BR-023 | Must | Undo shall restore the complete affected state, not only the visible row, and shall not reuse identifiers removed by the original action. | Baseline delete/undo behavior | Item, selection, image reference, and audit state reconcile after undo. |
| BR-024 | Must | Historical parser, OCR, image, and fiscal quality metrics shall not be displayed or cited as current unless revalidated for the exact release candidate and dataset version. | User quality instruction | Release evidence contains no unrevalidated historical metric; UI distinguishes current run from historical reference. |
| BR-025 | Must | Release version shall be derived from and verified across all authoritative manifests and user-facing release metadata. | `GAP-001` | `npm run check:version` and release-doc check pass for the candidate. |
| BR-026 | Must | Outbound business-data requests shall contain no catalog, page image, order, quote, tracking, manual override, or diagnostic payload. | Approved decision 3; `GAP-011` | Network capture during all workflows contains only allowlisted fiscal/reference requests or signed updater control traffic. |
| BR-027 | Must | DolarAPI shall be used only as a configurable secondary exchange-rate reference and never as an official fiscal source or proof of a fiscal rate. | Approved decision 11; Section 28 `SRC-04` | UI, documents, and audit records label DolarAPI `secondary reference`; an official fiscal package remains the only official rate basis. |
| BR-028 | Must | The DolarAPI adapter shall implement an explicit versioned mapping from response `casa` values, including `casa: "bolsa"`, to the internal `mep` key and shall reject an absent, duplicate, or unrecognized mapping instead of guessing. | `GAP-017`; current `bolsa`/`mep` inconsistency | Payload fixture maps `bolsa` to `mep`; missing/duplicate/unknown `casa` values produce a visible adapter error and no selected rate. |
| BR-029 | Must | A critical calculation shall explicitly select `compra` or `venta` and shall not silently substitute one side for the other when the selected value is missing. | Approved decision 11; current side fallback | Fixtures prove the selected side is preserved; missing selected side blocks or requires an explicit manual override and never uses the other side silently. |
| BR-030 | Must | When DolarAPI is stale or unavailable, the application shall show the source and local age/state and shall either require an explicit manual rate or use a clearly labelled cached reference only when the approved stale policy permits it; unavailable critical results shall fail closed. | Approved decision 11; `OD-011` | Network failure and old-timestamp fixtures produce the documented stale/unavailable state, retain provenance, and cannot silently select a different `casa` or side. |

---

## 11. Data model and data dictionary

### 11.1 Entity dictionary

The following target entities are logical. Physical field names may change only if the versioned schema and migrations preserve semantics, provenance, and auditability.

| Entity | Required logical fields | Source of truth / notes |
|---|---|---|
| `ImportSession` | `id`, `state`, `createdAt`, `updatedAt`, `attempt`, `sourceIds`, `scope`, `counts`, `error`, `decision` | Durable import workflow; state per Section 12.1 |
| `SourceArtifact` | `id`, `kind`, `name`, `sha256`, `byteSize`, `detectedType`, `pageCount`, `sourcePathPolicy`, `createdAt` | Immutable identity for each imported file |
| `ExtractionPage` | `sourceId`, `page`, `method`, `textDensity`, `status`, `modelRef`, `warnings` | Page-level extraction provenance |
| `Product` | `id/SKU`, brand, category, model, variant, FOB, quantity-independent identity, source refs, quality state | Current catalog business record |
| `Evidence` | `id`, `subjectType`, `subjectId`, `field`, `sourceId`, `page/row/cell`, coordinates, text span, image region, confidence, method | Supports field-level inspection |
| `QualityEvaluation` | `contractVersion`, `ruleId`, `severity`, `status`, `importability`, reason, evidence refs, evaluatedAt | Versioned R1–R10 result |
| `ImageAsset` | `id`, hash, MIME, dimensions, relative path/ref, source, validation results, semantic suggestion | Binary stored on disk; metadata in protected store |
| `Order` | `id`, name, status, created/saved timestamps, item snapshot refs, costing snapshot ref, lineage | Durable order header |
| `OrderItemSnapshot` | SKU, product identity, FOB, quantity, evidence/quality snapshot, image ref | Immutable after save |
| `CostingScenario` | `id`, order/version, freight, insurance, tax, exchange rate, fiscal package, overrides, calculation version, warnings | Reproducible financial basis |
| `Quotation` | `id`, consecutive non-reused number, status, supersedes/version lineage, order/scenario snapshot, issue/expiry timestamps, template, totals, approval, cancellation/substitution events | 15-day validity; issued versions are immutable |
| `ExchangeRateReference` | source, `casa`, selected side (`compra` or `venta`), value, `fechaActualizacion`, local retrieval timestamp, cache timestamp, stale/unavailable state, override | Secondary DolarAPI reference; never an official fiscal rate |
| `FiscalPackage` | `id`, source identity, source/observed date, version, validity, integrity evidence/strategy, schema, counts, activation, previous package | Integrity-managed local dataset; no invented publisher signature |
| `NcmRecord` | normalized code, description, duty, effective dates, source record ref | Active verified package data |
| `FiscalOverride` | subject, selected value/rate, reason, evidence, approver, timestamp, expiry | Human decision; never inferred silently |
| `ImportPlan` | `id`, order, wizard state/version, items, scenario refs, assumptions, validity, approval, documents | Six-stage planning record |
| `ImportTrackerRecord` | `id`, `IMP-xxxx`, order/plan link, supplier, status, dates, costs, notes, corrections | Durable shipment/import lifecycle record |
| `AuditEvent` | `id`, timestamp, actor mode, action, subject, before/after refs, reason, evidence, correlation ID | Append-only application audit record |
| `BackupManifest` | schema, app version, createdAt, content hashes, encryption metadata, source package refs | Required for verified restore |
| `AppSettings` | schema, key, value, source, updatedAt, sensitive flag | Protected durable settings; no tenant scope |

### 11.2 Data requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| DATA-001 | Must | Every durable aggregate shall declare a schema version and shall be migrated explicitly to the version required by the release. | Upgrade/migration safety | Version inspection, migration fixture, and rollback fixture pass. |
| DATA-002 | Must | Stable identifiers shall be unique within their entity type and shall not be reused after deletion. | Provenance and `BR-021` | Identifier collision tests pass across create/delete/restore sequences. |
| DATA-003 | Must | Product records shall separate business fields, source evidence, quality evaluation, and presentation data. | Evidence/quality target | Schema inspection shows each category is independently addressable. |
| DATA-004 | Must | Each evidence record shall identify source artifact, source location, extraction method, timestamp, and confidence or deterministic status. | Approved provenance | Every accepted critical field resolves to a valid evidence record. |
| DATA-005 | Must | Quality evaluation shall use a versioned rule contract and shall preserve all rule results, not only aggregate status. | `GAP-004` | Fixture emits the complete rule set defined by the selected contract version. |
| DATA-006 | Must | Image metadata shall use content-addressed identifiers and safe relative references; binary data shall not be duplicated in the main store. | Baseline `buildImageRef`; target storage | Path traversal, duplicate hash, missing file, and garbage-collection tests pass. |
| DATA-007 | Must | Import sessions shall persist state, selected scope, attempt history, counts, failures, and human decisions. | Retry/partial import | Restart and retry resume the same session without state loss. |
| DATA-008 | Must | Catalog selection quantities shall reference existing product IDs and shall be cleaned or reported when references are missing. | Baseline orphan cleanup | Orphan-selection fixture is repaired and reported. |
| DATA-009 | Must | Saved orders shall be immutable historical records; later edits shall create a new version or replacement with lineage. | Snapshot requirement | Editing a loaded historical order does not mutate its prior version. |
| DATA-010 | Must | Order items shall snapshot the fields needed to reproduce an order without a live catalog join. | `BR-010` | Restored order remains byte/logically equivalent after catalog deletion. |
| DATA-011 | Must | Costing scenarios shall snapshot all active inputs, selected formulas, fiscal package, exchange rate, overrides, and calculation-engine version. | `BR-020` | Historical quote recalculation/reproduction uses the stored scenario only. |
| DATA-012 | Must | Quotation records shall distinguish draft, issued, superseded, cancelled, and expired states. | Critical document lifecycle | Invalid state transitions are rejected; issued snapshot is immutable. |
| DATA-013 | Must | Fiscal packages shall retain source, observed date, version, validity, integrity evidence and the approved source-specific strategy identifier, schema version, activation time, and previous-package reference. | `GAP-007`, `GAP-008`, `GAP-020` | Package inspection exposes all metadata, activation lineage, and whether a publisher proof actually exists. |
| DATA-014 | Must | NCM records shall retain normalized code, official description, duty/rate data, effective dates, and source record identity. | Fiscal provenance | Code and source lookup resolve deterministically. |
| DATA-015 | Must | Fiscal overrides shall be separate from official records and shall include reason, evidence, approver, timestamp, and optional expiry. | Human approval | Official package update never overwrites or impersonates a human override. |
| DATA-016 | Must | Import plans shall persist wizard schema version, current step, inputs, selected items, fiscal references, and approval state. | Baseline `ImportWizard.saveProject` | Plan resumes after restart and displays incompatibility rather than silently dropping fields. |
| DATA-017 | Must | Tracker records shall retain both internal ID and non-reused `IMP-xxxx` number and shall record every valid transition timestamp. | Baseline tracker | Lifecycle inspection matches the transition matrix and chronology. |
| DATA-018 | Must | Audit events shall be append-only, time-ordered, tamper-evident within the local trust boundary, and linked to a subject/correlation ID. | Auditability requirement | Editing/deleting an audit event is detected and rejected. |
| DATA-019 | Must | Backup manifests shall cover every durable domain and binary asset class required for full restore. | `GAP-009` | Restore test reaches an equivalent application state and reports any excluded class. |
| DATA-020 | Must | Settings shall include source and sensitivity classification; secrets and encryption keys shall never be stored as ordinary settings. | Security closure | Settings inspection finds no key material or unmanaged secret. |
| DATA-021 | Must | Timestamps shall be stored as unambiguous instants and displayed with an explicit local timezone/offset. | Audit reproducibility | UTC persistence and local display tests account for timezone/DST. |
| DATA-022 | Must | Provenance shall distinguish deterministic extraction, OCR, vision, fiscal package, manual entry, and manual override. | Approved decision 3 | Field inspector reports the correct method for each fixture. |
| DATA-023 | Must | Retention and deletion periods shall be configurable only through approved product policy, shall enforce the ten-year financial/fiscal and one-year technical-log rules, and shall not silently delete protected audit, incident, or financial records. | `OD-013`, `TBD-009`; `DATA-040`–`DATA-042` | Expiry job respects approved retention, honors incident holds, and records tombstones/events. |
| DATA-024 | Must | The local data model shall not introduce account, tenant, organization, or remote-synchronization ownership fields. | Approved non-goals | Schema scan finds no such ownership model or synchronization key. |
| DATA-025 | Must | Migrations shall be idempotent, resumable, transactional where supported, and verified before the source data is removed. | Upgrade safety | Interrupted migration resumes without duplicate or partial business data. |
| DATA-026 | Must | User-facing exports and backups shall include a documented schema/version manifest sufficient for later import or recovery. | Portability and recovery | Export re-import and restore validation pass for the target version. |

---

## 12. Import, parser, and OCR requirements

### 12.1 Target import-session state machine

| From state | Allowed next state(s) | Guard |
|---|---|---|
| `created` | `preflighting`, `cancelled` | Source list is durable |
| `preflighting` | `extracting`, `failed`, `cancelled` | All files have preliminary dispositions |
| `extracting` | `review_required`, `ocr_required`, `ocr_unavailable`, `failed`, `cancelled` | Deterministic page results are recorded |
| `ocr_required` | `ocr_processing`, `cancelled` | A verified local model is available for `ocr_processing` |
| `ocr_processing` | `review_required`, `failed`, `cancelled` | OCR provenance is complete for processed pages |
| `ocr_unavailable` | `review_required`, `cancelled` | Partial scope requires explicit user approval and excluded pages are listed |
| `review_required` | `awaiting_approval`, `failed`, `cancelled` | Every selected item has a disposition |
| `awaiting_approval` | `committing`, `review_required`, `cancelled` | User explicitly confirms the final selection |
| `committing` | `committed`, `partially_committed`, `failed` | Transaction/recovery outcome is recorded |
| `partially_committed` | `committing`, `abandoned` | Retry is idempotent; abandonment is explicit and audited |
| `failed` | `preflighting`, `cancelled` | Cause is recorded; retry creates a new attempt under the same session |
| `committed`, `abandoned`, `cancelled` | None | Terminal |

### 12.2 Requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-021 | Must | Every source file shall have an immutable identity derived from name/type/size/content hash and shall not be silently replaced within an attempt. | Evidence integrity | Same-content duplicate is detected; changed content creates a distinct source/attempt record. |
| FR-022 | Must | Files shall be processed independently so one corrupt or unsupported file does not discard valid results from other files. | Baseline per-file catch; partial import | Mixed batch fixture commits approved valid files and reports the failed file. |
| FR-023 | Must | The deterministic PDF path shall use selectable text and spatial evidence; pages below the approved text-density threshold shall be marked for OCR review. | Baseline `PdfParser`; `GAP-002` | Selectable and low-text page fixtures produce documented method/status. |
| FR-024 | Must | The application shall detect scanned or partially scanned PDFs and shall state that OCR is required rather than returning a false complete extraction. | Approved OCR capability | Detection is recorded per page and in summary. |
| FR-025 | Should | When an integrity-verified local OCR model is available, the application shall OCR required pages locally and record model/version/language/provenance. | Approved local AI; no-model fallback | OCR test completes offline; request capture shows no model/data upload. |
| FR-026 | Must | When OCR is unavailable or fails, the application shall expose the exact unavailable/failed scope and allow only explicit partial import or cancellation. | Fail-closed fallback | No-model and model-failure fixtures cannot reach `committed` without explicit partial approval. |
| FR-027 | Must | Extracted product fields shall carry page/row/cell/region provenance and method; prices shall be grounded against literal source evidence. | Baseline evidence; `R1`/`R10` | Evidence inspector locates the exact source region for every accepted critical field. |
| FR-028 | Must | A page failure shall be isolated, recorded, and excluded or retried without discarding successful page results. | Partial import/retry | Injected page failure yields an auditable partial result and no fabricated page completion. |
| FR-029 | Must | Catalog commit shall be idempotent by import session, item identity, and approved revision. | Retry and duplicate safety | Replaying the same commit produces no duplicate product or audit-approved decision. |
| FR-030 | Should | Heavy deterministic PDF render/decode work should run in a worker when equivalence and approved performance thresholds are met. | `GAP-003`; `docs/SPIKE-WORKER-PARSE.md` | Worker/main product hashes and evidence are equivalent on the release corpus; performance gate passes. |
| FR-031 | Must | If worker or OffscreenCanvas support is unavailable, the application shall use a validated fallback and remain cancellable without corrupting state. | Platform variability | Unsupported-runtime fixture completes or fails cleanly with diagnostic. |
| FR-032 | Must | Parser diagnostics shall distinguish file, page, row, cell, model, and commit failure and shall redact business payload in user-facing support output. | `BR-026`, `SEC-014` | Fault injection produces scoped diagnostics and a redacted bundle. |
| FR-033 | Must | Import-session state shall follow Section 12.1; every transition shall be validated and audited before the new state is durable. | Explicit target state machine | Complete transition matrix test rejects invalid edges and persists only valid edges. |

---

## 13. Catalog quality and evidence requirements

### 13.1 R1–R10 target contract

| Rule | Target meaning | Failure disposition |
|---|---|---|
| R1 | FOB is finite, positive, and linked to source or explicit override | RED unless approved override contract permits review |
| R2 | Model is meaningful and not generic/corporate/numeric noise | RED |
| R3 | FOB is plausible for the classified category and any threshold is versioned | RED for hard range; YELLOW for advisory range |
| R4 | Brand/category relationship is not contradicted by the active vocabulary | RED when hard contradiction; otherwise YELLOW with evidence |
| R5 | Category is known or explicitly approved as `OTHER` by a human | RED when unapproved |
| R6 | Brand is identified or explicitly approved | RED when unapproved |
| R7 | Variant is descriptive and not a price | YELLOW |
| R8 | Model and variant are not identical when both are present | YELLOW |
| R9 | Image presence, decode, source association, and deterministic image checks are recorded | YELLOW for missing/uncertain; RED only when a hard image-integrity rule fails |
| R10 | Critical extracted values have sufficient literal/spatial evidence or an approved override | RED when evidence is absent; override requires explicit approval |

Any exception to this table requires a new versioned quality-contract document and migration of stored evaluations. Implementation comments alone do not change the contract.

### 13.2 Requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-034 | Must | The application shall expose the quality-contract version and the exact R1–R10 result for each evaluated product. | `GAP-004` | Product inspector and persisted evaluation expose all ten rules. |
| FR-035 | Must | The application shall distinguish quality status, severity, importability, reason, and evidence; a color or aggregate label shall not be the only representation. | Accessibility/auditability | Status has text, reason, and machine-readable fields. |
| FR-036 | Must | The user shall be able to open source evidence for a product field, image association, and grounding result. | Evidence-first target | Selecting evidence opens the correct page/row/region reference. |
| FR-037 | Must | The user shall accept, reject, or edit a flagged value with a reason; the system shall re-run dependent rules after the edit. | Human approval | Change event stores before/after/reason and updated rule set. |
| FR-038 | Could | If local semantic vision is included, it may suggest whether an image appears to depict the product and shall never state that fact without human approval. | Optional local AI; `GAP-005` | Suggestion UI labels method/confidence/provenance and cannot self-accept. |
| FR-039 | Must | The import preview shall show GREEN, YELLOW, RED, missing-image, data-review, excluded-page, and failed-file counts without conflating them. | Baseline preview; target clarity | Summary counts reconcile exactly with item and source states. |

---

## 14. Local AI assistance requirements

### 14.1 Approved local NCM/advisor architecture

**Status: `APPROVED ARCHITECTURE — BENCHMARK GATED`.** Approval fixes the components, roles, licensing, quantization, and runtime boundary below. It does **not** claim that the stack has achieved any recall, hit-rate, ranking, calibration, latency, false-acceptance, or working-set target. Activation is blocked until the 13-catalog, per-catalog holdout benchmark in Section 29.2 passes the thresholds approved in `TBD-015` and the owner closes `OD-017`.

| Role | Approved component | Runtime | Permitted output | Prohibited behavior |
|---|---|---|---|---|
| Retrieval / shortlist | `Qwen3-Embedding-0.6B`, Apache-2.0 | Local ONNX, INT8 or FP16 | Ranked top-8 initial candidate shortlist from the active NCM package | Accepting or writing any product, price, SKU, or NCM field |
| Verification / reranking / abstention | `Qwen3-Reranker-0.6B`, Apache-2.0 | Local ONNX INT8, normally resident | Reranked candidates, score, top-1 vs top-2 margin, and `needs_review` | Auto-accepting price, NCM, product identity, or image association |
| On-demand advisor | `Qwen3.5-4B`, GGUF Q4_K_M, Apache-2.0 | Application-managed local sidecar, loaded on demand and unloaded after completion/cancellation/failure | Field comparison, proposed correction, and plain-language explanation | Automatically modifying critical data, remote execution, or requiring an external Ollama/llama-server installation |

The two verification roles may be resident. The advisor is loaded on demand. The design shares a **16 GB RAM budget** and shall report and measure the **working set** of resident and on-demand processes, not only weight-file size.

### 14.2 Requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| AI-001 | Must | AI/OCR/vision/NCM assistance shall be optional; the deterministic product workflow shall remain available without a model. | Approved decision 3 | Clean install with models absent completes deterministic scenarios. |
| AI-002 | Must | All inference and model execution shall occur locally on the workstation. | Approved decision 3 | Process/network inspection finds no remote inference endpoint. |
| AI-003 | Must | Catalog pages/images, OCR text, product/order/quote/tracking data, prompts, and outputs shall never be sent to an AI or cloud provider. | Approved decision 3 | Packet capture and egress tests across all AI features find zero prohibited payloads/destinations. |
| AI-004 | Must | If no verified model is available, the application shall show the capability as unavailable and provide deterministic/manual alternatives. | No-model fallback | Missing/corrupt model fixture produces explicit unavailable state and no fabricated result. |
| AI-005 | Must | Local OCR shall record model identity/version, language, page, timing, and confidence or deterministic failure. | Provenance requirement | OCR evidence record contains all fields and can be reproduced or diagnosed. |
| AI-006 | Could | Local vision may provide semantic image suggestions, duplicate/variant hints, and depicted-product warnings. | Optional local assistance | Any included feature passes local-only, evidence, confidence, and human-approval tests. |
| AI-007 | Should | Local NCM assistance may rank candidate official NCM records using local text/image features and the active official package. | Approved NCM assistance | Suggestions identify source record/version/confidence and remain suggestions. |
| AI-008 | Must | Every model output shall include method, model reference, timestamp, confidence or uncertainty, and evidence references. | Approved decision 3 | Output schema and UI inspection contain all required provenance. |
| AI-009 | Must | Confidence shall never be represented as a probability of correctness unless the calibration method and validation set are documented. | Avoid misleading AI claims | Uncalibrated confidence is labeled heuristic/uncertain; calibrated output names method/version. |
| AI-010 | Must | Every critical AI-assisted value shall require explicit human acceptance, rejection, or edit before becoming business data. | Approved decision 3 | Automation attempt cannot commit unapproved critical output. |
| AI-011 | Must | Missing evidence, invalid model output, low/uncertain confidence under policy, or model failure shall fail closed into review/unavailable state. | Approved fail-closed behavior | Fault fixtures never auto-promote to accepted data. |
| AI-012 | Must | A human override shall record prior suggestion, replacement value, reason, actor mode, timestamp, and model/evidence context. | Auditability | Audit inspection reconstructs suggestion-to-decision lineage. |
| AI-013 | Must | Model artifacts shall have approved origin, license record, version, integrity hash/signature where available, and compatibility metadata. | `OD-009`; security/supply chain | Unapproved, modified, incompatible, or license-missing model is rejected. |
| AI-014 | Must | Model installation, update, enablement, and removal shall be explicit local operations and shall never modify the application silently. | Model lifecycle | Lifecycle audit and rollback tests pass. |
| AI-015 | Must | Model processing shall be cancellable and shall release page/image buffers after completion or cancellation. | Resource integrity | Long-job cancellation test leaves no retained large buffers or running worker. |
| AI-016 | Must | Local model processes shall have no product-data network capability and shall receive only the minimum local input required for the task. | Threat containment | Process policy and packet capture verify isolation/minimization. |
| AI-017 | Should | Where practical, model output shall be reproducible for the same model version, input hash, and approved runtime configuration. | Diagnostics | Replay test records differences when runtime nondeterminism exists. |
| AI-018 | Must | The application shall not upload data for provider training, telemetry, quality improvement, or support without a separate future product decision. | Approved no-egress decision | No telemetry/training endpoint exists or is called. |
| AI-019 | Must | The main Full-profile distribution shall include the approved local OCR, vision, and NCM model artifacts; an optional capability component may be packaged separately only where packaging constraints are documented. Distribution metadata shall state model identity/version, license, installed or packaged size, integrity value and verification method, compatibility, and the deterministic/manual fallback. | Approved decisions 4 and 5; `OD-009`; `GAP-025` | Clean-install inventory finds every Full-profile model or an explicitly documented capability package; license/size/integrity/compatibility disclosure and Core/no-model fallback are inspectable. |
| AI-020 | Must | The Full profile shall use `Qwen3-Embedding-0.6B` (Apache-2.0, local ONNX INT8 or FP16) to retrieve an initial top-8 shortlist from the active official NCM package, and the shortlist shall be treated as candidates only. | `ARC-001`; benchmark-gated architecture | Retrieval fixture returns at most eight candidates with source NCM identity; the adapter cannot write a catalog field or mark a classification accepted. |
| AI-021 | Must | The Full profile shall use `Qwen3-Reranker-0.6B` (Apache-2.0, local ONNX INT8) to rerank the shortlist and emit an order, score, and top-1 versus top-2 margin; it shall never auto-accept a price, NCM code, SKU, product identity, or image association. | `ARC-001`; `TBD-015`; `AI-010` | Rerank fixture records ordered candidates, score, and margin; a forced high/low score changes only suggestion and `needs_review` state, never accepted business data. |
| AI-022 | Must | The reranking adapter shall produce `needs_review` when its approved score/margin policy, model availability, integrity check, or output validation fails; absence, failure, or a low score shall never be interpreted as acceptance. | `ARC-001`; fail-closed decision 3; `TBD-015` | Missing model, malformed output, low score, and low margin fixtures all resolve to `needs_review` with a reason and no accepted value. |
| AI-023 | Must | The on-demand advisor shall run `Qwen3.5-4B` GGUF Q4_K_M (Apache-2.0) through an application-managed local sidecar that the application starts, stops, and unloads on completion, cancellation, or failure; it shall not require a user-installed Ollama or llama-server service. | `ARC-001`; local-first decision 3; `AI-002` | Clean-install and offline E2E start/stop the sidecar without external tooling; process/network inspection finds no remote or externally managed inference service. |
| AI-024 | Must | Retrieval and reranking may remain resident; the advisor shall be loaded on demand and unloaded when its task ends. Combined resident and on-demand working set shall remain within the approved 16 GB shared-RAM envelope, and the application shall report and measure working set rather than weight-file size alone. | `ARC-001`; `NFR-027` | Idle, resident, and concurrent-advisor telemetry reports process working set, p50/p95, and peak; the 16 GB envelope is not exceeded and the advisor is absent after task completion. |
| AI-025 | Must | Every embedding, rerank, margin, abstention, and advisor output shall be a versioned, evidence-bearing record containing model identity/version/quantization, input evidence reference, score or confidence, timestamp, and disposition; assistance shall never be the source of truth for a critical field. | `ARC-001`; decision 3; `AI-008`, `AI-012` | Inspection reconstructs suggestion-to-human-decision lineage for each output and finds no accepted value without source evidence or an explicit override. |
| AI-026 | Must | The Full profile shall emit a valid, versioned JSON result for every model-assisted operation, and malformed or schema-invalid output shall be recorded and routed to `needs_review`; benchmark adoption shall count emitted-valid-JSON rate explicitly. | `ARC-001`; benchmark gate 29.2 | JSON schema, malformed-output, and rate-report tests pass; no malformed result is silently coerced into an accepted value. |

---

## 15. Orders, costing, profitability, and quotation requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-040 | Must | Order assembly shall revalidate product existence, status, FOB, evidence, and quantity at confirmation time. | Current baseline strengthened | Catalog changes between selection and confirmation are detected before snapshot. |
| FR-041 | Must | A confirmed order shall retain a complete product/item/cost snapshot and shall not depend on mutable catalog records. | `BR-010` | Catalog deletion/editing after save does not alter the order. |
| FR-042 | Must | Cost and profitability shall recalculate deterministically from the active scenario and shall display inputs, formulas/components, warnings, and totals. | Baseline calculator | Golden scenario reconciles every displayed line and total. |
| FR-043 | Must | The application shall distinguish gross/cash cost, recoverable tax, net cost, margin, markup, and ROI with unambiguous labels. | `BR-013`, `BR-014` | Scenario output includes definitions and component reconciliation. |
| FR-044 | Must | A quotation draft shall be created from an approved order/scenario snapshot and shall not silently refresh after issuance. | Quotation integrity | Draft-to-issue comparison identifies all changed fields. |
| FR-045 | Must | Quotation numbers shall be allocated atomically from one consecutive sequence and shall be unique and non-reused, including after correction, cancellation, deletion, backup restore, or retry. | Approved decision 10; resolved `OD-014`/`TBD-010` | Concurrent/retry/delete/restore fixtures produce the next consecutive number and never duplicate or reuse one. |
| FR-046 | Must | The user shall review and explicitly issue a quotation; issuance shall freeze its snapshot and mark the record issued. | Critical decision | No issued status occurs without approval event; issued content is immutable. |
| FR-047 | Must | Quote history and configuration shall use protected application persistence rather than direct LocalStorage. | `GAP-010` | Desktop diagnostics and store inspection find quote data only in protected domains. |
| FR-048 | Must | The six-stage import wizard shall persist resumable project state and reject incompatible future/older schemas explicitly. | Baseline wizard | Restart resume and incompatible-schema fixtures pass. |
| FR-049 | Must | NCM and fiscal overrides shall be item-specific where supported, require a reason, and be included in the saved plan and downstream documents. | `BR-018` | Override lineage appears in plan, calculation, and document evidence. |
| FR-050 | Must | Costing and quotation output shall display fiscal-data validity, assumptions, warnings, and a non-authoritative estimation statement. | Fiscal transparency | Expired/stale data scenario cannot appear as an unqualified final result. |
| FR-051 | Must | Unsupported, contradictory, or missing critical costing inputs shall produce an actionable warning/error and shall not be replaced by an unexplained default. | Fail-closed inputs | Missing-weight, missing-rate, stale-rate, and invalid-currency fixtures are tested. |
| FR-052 | Must | Exported order/quote/import documents shall be generated from the same scenario/snapshot shown to the user. | `BR-020` | UI and export reconciliation fixture is exact under approved formatting rules. |
| FR-053 | Must | Packing-list and executive-report exports shall identify source order/plan, item count, weights, totals, fiscal basis, and generation time. | Current baseline documents | Output schema inspection includes all identifiers and provenance. |
| FR-054 | Must | Quotation reopen/reprint shall reproduce the issued snapshot and shall not use a newer template or fiscal dataset silently. | Reproducibility | Reprint after catalog/fiscal/template changes matches the issued values and identifies the frozen template. |
| FR-055 | Must | A final quotation or import plan shall be blocked while fiscal data is expired/unverified unless a documented reviewer override is applied. | `BR-019` | Stale-data finalization test is blocked; approved override test records warning and approver. |
| FR-071 | Must | An issued quotation shall expire 15 calendar days after its issue timestamp unless a new version is issued; the application shall show and enforce the expiry state. | Approved decision 10; resolved `OD-014`/`TBD-010` | Boundary fixtures at issue time, 14 days, 15 days, and later reproduce the exact expired state and prevent unsupported reuse. |
| FR-072 | Must | A correction to an issued quotation shall create a new immutable version with supersedes/version lineage and shall never overwrite the previously issued snapshot. | Approved decision 10; `DATA-012` | Corrected quote reopens both versions, the prior content remains byte/logically identical, and the new version receives a new version identifier plus the applicable consecutive number. |
| FR-073 | Must | Quotation cancellation and substitution shall be recorded as append-only events with timestamp, reason, actor action, prior state, replacement linkage, and affected version. | Approved decision 10 | Cancellation/substitution tests preserve all prior versions/events and prohibit silent deletion or in-place state replacement. |

---

## 16. Fiscal/NCM and automatic update requirements

**Verified source condition (observed 2026-09-25).** ARCA's Arancel Integrado page and mutable `arancel.zip` are primary technical sources; the observed artifact date was 2026-09-25 and the technical files use an `@`-delimited structure. Research did not verify a uniform publisher checksum or signature. BORA, Argentina Normativa, and ARCA's legal library are primary legal sources, but no single consolidated machine-readable national JSON for IVA, perceptions, regimes, and IIBB was found. IIBB therefore requires reviewed jurisdiction-specific adapters. Section 28 records URLs and limitations.

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FISCAL-001 | Must | Fiscal, NCM, tariff, and related reference datasets shall be retrieved only from configured approved official sources. | Approved decision 7; `GAP-008` | Unapproved source configuration is rejected; source inventory is visible. |
| FISCAL-002 | Must | Each dataset/package shall record source identity, publisher, endpoint/artifact identity, retrieval time, and source version or publication identity. | Approved decision 7 | Package metadata inspection is complete. |
| FISCAL-003 | Must | Each package shall record validity start/end or an explicit unknown state, with unknown validity failing closed for critical issuance. | Approved decision 7 | Missing validity blocks final approval. |
| FISCAL-004 | Must | Candidate packages shall pass an owner-approved, source-specific integrity strategy before activation. The strategy shall use verified publisher signatures/checksums when actually published; otherwise it shall combine HTTPS, source/date provenance, local digest capture, schema/completeness checks, and owner-approved semantic review without claiming that a local digest is a publisher signature or checksum. | `GAP-020`; Section 28 `SRC-01` | Source-specific strategy review and tamper/format/provenance fixtures reject bad candidates; documentation truthfully reports whether a publisher proof exists. |
| FISCAL-005 | Must | Candidate packages shall pass versioned schema, type, range, code-format, and referential-integrity validation. | Corruption prevention | Invalid schema/range/duplicate fixtures are rejected with reason. |
| FISCAL-006 | Must | Completeness shall be measured against the configured official source's declared universe/version, not a hard-coded historical count. | `GAP-007` | Reconciliation reports expected/received/missing/extra records using source metadata. |
| FISCAL-007 | Must | Fiscal update requests shall contain only source/version/conditional-fetch metadata and shall contain no product or user business payload. | `BR-026` | Packet capture verifies metadata-only requests. |
| FISCAL-008 | Must | Candidate data shall be downloaded and validated in an isolated staging area before activation. | Atomic update design | Active package is unchanged throughout validation. |
| FISCAL-009 | Must | Activation shall atomically switch the complete validated package and shall never expose mixed old/new records. | Approved atomic update | Fault injection at each activation point leaves either old or new complete package. |
| FISCAL-010 | Must | The active package and last-known-good package shall be cached locally for offline calculation. | Approved offline use | Offline start loads and identifies the active cached package. |
| FISCAL-011 | Must | The system shall retain at least the active and last-known-good packages until a new package passes activation. | `GAP-008` | Repeated successful and failed updates preserve a valid fallback. |
| FISCAL-012 | Must | Activation shall support rollback to the prior verified package with an audited reason and user-visible status. | Approved rollback | Rollback fixture restores prior package and all calculations identify it. |
| FISCAL-013 | Must | When offline or refresh fails, the application shall continue with the active/LKG package for safe non-critical work and show source, version, age, and validity; the 7-day/30-day thresholds in `FISCAL-016` remain authoritative for warning and critical blocking. | Approved offline behavior | Network-disabled scenarios remain calculable for safe work with stale status visible, while the 30-day critical block is enforced. |
| FISCAL-014 | Must | The application shall check every configured official fiscal source at least once every calendar day without user interaction, using safe retry and concurrency behavior. | Approved decision 7; resolved cadence in `OD-004` | Scheduler test performs the daily check, records source/result metadata, and survives overlap, offline, and restart scenarios. |
| FISCAL-015 | Must | Refresh failure shall not destroy the active package and shall create a retryable diagnostic without exposing candidate data. | Reliability | HTTP, TLS, approved integrity-strategy, schema, and disk failures follow the same safe behavior. |
| FISCAL-016 | Must | The application shall show a visible warning when an official source has had no successful update for 7 calendar days and shall block critical fiscal results after 30 calendar days without a successful update; declared dataset validity expiry remains independently fail-closed. | Approved decision 7; resolved `TBD-013` | Boundary tests at 6/7 and 29/30 days, plus declared validity expiry, prove the exact warning and block behavior while safe non-critical work remains available. |
| FISCAL-017 | Must | Official package updates and any NCM retrieval, reranking, score, margin, abstention, or advisor suggestion shall not automatically approve an NCM classification, fiscal override, price, product identity, or other product-specific critical decision. | Approved human approval; `AI-020`–`AI-026` | Updating rates or reranking candidates does not change an unapproved product mapping to accepted state. |
| FISCAL-018 | Must | Every fiscal calculation/document shall expose the active package ID/version, effective dates, source, and any override. | Provenance requirement | Calculation receipt and document fixture contain the full fiscal basis. |
| FISCAL-019 | Must | The active package status shall be visible as current, due, expired, unknown, failed-refresh, or rolled-back. | UX and operations | State matrix test covers all statuses and accessible text. |
| FISCAL-020 | Must | Exchange-rate/reference data shall be treated as a configured secondary reference dataset with source/side/timestamp/cache provenance and the same no-business-payload rule; DolarAPI is approved only as that secondary reference and never as an official fiscal source. | Approved decision 11; `GAP-017`; Section 28 `SRC-04` | Approved-source request, secondary classification, offline cache, timestamp, and packet-capture tests pass. |
| FISCAL-021 | Must | The target fiscal scope shall cover Argentina national rules including NCM, IVA, IVA additional, Ganancias, the statistical rate, applicable perceptions/withholdings, and applicable regimes, plus IIBB configured by selected province/jurisdiction. | Approved decision 6 | Each configured scope element is present with an owner-approved adapter, provenance, and an explicit unavailable/blocked state when its source is unavailable. |
| FISCAL-022 | Must | IIBB and other sub-national data shall be implemented through jurisdiction-specific adapters; the application shall not assume a single national IIBB endpoint or a complete national rate table. | Approved decision 6; Section 28 `SRC-03` | Enabling two different jurisdictions proves isolated source/version/rate state; a missing jurisdiction adapter produces a visible unsupported state and never reuses another province's rate. |
| FISCAL-023 | Must | Legal changes shall be detected from primary legal sources and translated through reviewed adapters; any semantic change to a rate, regime, perception, or classification mapping shall require explicit owner approval before activation. | Approved decision 6; `OD-003`; `GAP-020` | A simulated legal change produces a proposed diff, blocks automatic semantic activation, and activates only after a recorded owner approval. |
| FISCAL-024 | Must | The owner of Mambo shall be the fiscal release approver, and every fiscal release record shall state that the application is an operational estimation/evidence tool and not legal, tax, or customs certification. | Approved decision 6; `OD-002` | Release record names the approving owner and carries the non-certification statement; no document claims legal certification. |

---

## 17. Import planning and tracker requirements

### 17.1 Target tracker state machine

`ordered` is the initial state. Allowed transitions are:

- `ordered → in_transit | cancelled`
- `in_transit → in_customs | cancelled`
- `in_customs → cleared | cancelled`
- `cleared → delivered | cancelled`
- `delivered` and `cancelled` are terminal

No reverse transition is allowed. A correction shall be represented as a separately audited amendment/correction record; it shall not silently rewrite history.

### 17.2 Requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-056 | Must | The user shall create a tracker record with stable internal ID, non-reused `IMP-xxxx`, supplier, description, initial status, and optional exact order link. | Baseline `createRecord` | Create fixture persists all fields and counter atomically. |
| FR-057 | Must | An order link shall be created only from an exact approved relationship; fuzzy SKU overlap shall not establish lineage. | Baseline `extractPedidoLink` | Exact and partial overlap fixtures produce the defined link/no-link result. |
| FR-058 | Must | The tracker shall support filtering/grouping by state and displaying active, delivered, cancelled, investment, and profitability rollups. | Baseline `computeRollups` | Rollup fixture reconciles to records and available-price semantics. |
| FR-059 | Must | Every valid status change shall require explicit user action, record the timestamp, and reject invalid transitions without mutation. | `BR-022` | Transition matrix and UI test cover all valid/invalid edges. |
| FR-060 | Must | The user shall edit freight, insurance, final landed cost, local reference price, exchange rate, notes, and linked plan/order subject to validation. | Baseline tracker fields | Invalid numeric/date/link values are rejected and audited. |
| FR-061 | Must | Missing local price or landed cost shall make profitability unavailable rather than treating it as zero profit. | Baseline `computeProfitability` | Missing-value fixture displays unavailable, not zero. |
| FR-062 | Must | Tracker export shall include number, state history, linked order/plan, costs, assumptions, and audit references. | Traceability | Export fixture reconciles with persisted record. |
| FR-063 | Must | Cancelled/delivered records shall not transition without an audited correction process that preserves original events. | State-machine integrity | Attempted transition is rejected; correction creates a linked amendment. |

---

## 18. Persistence, backup, restore, and migration

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| DATA-027 | Must | Tauri Store or its target successor shall be the only durable business-data store in supported desktop releases. | `GAP-010` | Desktop store diagnostics identify the protected backend; browser/test fallback is non-persistent for business data. |
| DATA-028 | Must | Direct LocalStorage shall not contain catalog, images, orders, quotes, quote config/history, import plans, tracker records, backups, diagnostics, or settings. | `GAP-010` | Storage inventory test finds prohibited keys absent after every workflow. |
| DATA-029 | Must | When the protected desktop store is unavailable, the application shall not silently persist degraded business data; it shall offer explicit non-persistent mode or block durable operations. | Fail-closed persistence | Store-unavailable fixture cannot commit a durable catalog/order. |
| DATA-030 | Must | Catalog, order, quote, wizard, tracker, settings, and diagnostic domain writes shall use atomic commit semantics or an equivalent recoverable journal. | Corruption prevention | Fault injection at write boundaries leaves the prior committed state. |
| DATA-031 | Must | Backups shall use authenticated encryption and the same key-management policy as the primary protected store. | `GAP-009`; approved local-first decision | Backup ciphertext/key metadata and restore verification match the primary policy. |
| DATA-032 | Must | A backup shall include a manifest with schema/app version, timestamps, content hashes, encryption metadata, and completeness status. | Restore confidence | Missing/corrupt manifest blocks restore. |
| DATA-033 | Must | Restore shall validate before commit, present a preview, preserve the current primary until success, and support rollback to the pre-restore state. | Corruption/recovery | Corrupt backup, partial restore, and successful rollback tests pass. |
| DATA-034 | Must | Direct LocalStorage quote config/history and legacy backup/error data shall be migrated into protected domains with verification before removal. | `GAP-010`; `GAP-012` | Migration fixture preserves values and removes source only after verified commit. |
| DATA-035 | Must | Images shall use safe content-addressed paths, restrictive file permissions, orphan cleanup, and recoverable trash semantics. | Baseline image storage | Path traversal, orphan, missing file, and trash-restore tests pass. |
| DATA-036 | Must | Schema migrations shall preserve unknown future fields safely or block with an explicit incompatibility message; they shall not discard them silently. | Forward compatibility | Newer/older schema fixtures produce the documented safe result. |
| DATA-037 | Should | Automatic local backups should create a recoverable pre-migration snapshot. Retention count/age and key recovery remain governed by `OD-010` and `TBD-008`. | `OD-010`, `TBD-008` | Pre-migration snapshot is created and verified before migration; retention and key-recovery behavior pass only after approval. |
| DATA-038 | Must | The application shall create automatic authenticated-encrypted backups to an approved local destination and to an approved user-configured external destination, without automatic cloud-provider integration. | Approved decision 8; `GAP-022` | Unattended local/external backup fixtures complete, remain encrypted, and a missing/unavailable external destination fails visibly without deleting the local backup. |
| DATA-039 | Must | The backup/restore capability shall meet a recovery point objective of 24 hours and a recovery time objective of 4 hours from loss or unavailability of the primary store. | Approved decision 8; resolved objectives in `OD-010`/`TBD-008` | Release rehearsal proves the newest recoverable backup is at most 24 hours old and verified restore completes within 4 hours on the release baseline. |
| DATA-040 | Must | Financial and fiscal records, including issued quotations, costing/import-plan scenarios, fiscal packages, and their approval lineage, shall be retained in retrievable form for 10 years before archival and shall not be silently deleted at that boundary. | Approved decision 9; `OD-013`, `TBD-009` | Boundary fixture keeps 10-year-old records retrievable, performs an auditable archive transition, and preserves provenance. |
| DATA-041 | Must | Technical logs shall be retained for 1 year; records placed under an active incident hold shall not be deleted until the hold is released, and no retention job may erase evidence required for a diagnosed incident. | Approved decision 9; `FR-070`; `OD-012`/`OD-013` | Age-based technical-log expiry passes, while incident-held records survive the same job and are released only through an audited action. |
| DATA-042 | Must | Any explicit deletion shall state and record its scope, affected domain, backups/images/audit effect, retention exception, actor action, and timestamp, and shall not claim secure erasure where the filesystem cannot guarantee it. | Approved decision 9; `SEC-018`; `GAP-023` | Deletion confirmation and audit record match the real effect; the UI makes no unsupported secure-erasure claim. |

---

## 19. Security, privacy, and threat requirements

### 19.1 Threat baseline

The target threat model covers untrusted files, path traversal, malicious document content, content spoofing, tampered local data, tampered fiscal packages, tampered updates, unauthorized egress, local data leakage, unsafe rendering, model supply-chain compromise, and accidental loss/corruption. `SEC-017` makes the reviewed threat model a release requirement.

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| SEC-001 | Must | The application shall not require or implement a remote backend, remote application database, cloud synchronization, or tenant service. | Approved local-first decision | Architecture review and network trace show no such dependency. |
| SEC-002 | Must | The application shall not introduce authentication, accounts, roles, or multiuser authorization semantics. | Approved non-goal | UI/schema/API scan contains no account/tenant/role workflow. |
| SEC-003 | Must | Durable business data shall not be written to LocalStorage, browser cache, URL parameters, or unprotected temporary files. | `GAP-010` | Storage/cache/temp-file inspection finds no prohibited business payload. |
| SEC-004 | Must | Protected business records shall use authenticated encryption with a unique nonce/IV per write and integrity verification before use. | Baseline AES-GCM; target hardening | Ciphertext, nonce uniqueness, tamper rejection, and key rotation tests pass. |
| SEC-005 | Must | Encryption keys shall be generated and stored through the supported native OS credential store — Windows Credential Manager on Windows and a verified Secret Service implementation on Linux — and shall never be embedded in the repository, store payload, logs, or backups. | Local-first key-management requirement; `GAP-019`; Section 28 `SRC-06` | Feature/build inspection and runtime retrieval prove the intended native backend on each platform; secret scan finds no key leakage. |
| SEC-006 | Must | If required cryptography or key storage is unavailable on a supported platform, durable business writes shall fail closed with actionable recovery guidance. | `DATA-029` | Crypto/keychain failure fixture cannot persist plaintext business data. |
| SEC-007 | Must | Backups and exported protected data shall use authenticated encryption and explicit export authorization. | `GAP-009` | Export without authorization fails; ciphertext integrity is verified. |
| SEC-008 | Must | Temporary files shall have restrictive permissions, be removed on success/cancel/failure, and shall not contain more business data than required. | Local privacy | Temp-directory inspection during import/model/update tests finds no residual payload. |
| SEC-009 | Must | File/image references shall be canonicalized and constrained to approved roots; traversal and symlink escape shall be rejected. | Untrusted files | Traversal, absolute path, and symlink fixtures fail closed. |
| SEC-010 | Must | The application shall validate declared type, magic bytes, parseability, size, and configured resource limits before expensive processing. | Untrusted files | Malformed/zip-bomb/oversized fixtures are rejected without crash. |
| SEC-011 | Must | Untrusted catalog text, filenames, source values, and model output shall be contextually encoded before rendering or document export. | Injection defense | XSS/control-character fixtures render as text and exports remain safe. |
| SEC-012 | Must | The webview CSP shall exclude `unsafe-inline`, `unsafe-eval`, remote script/source hosts, plugin content, and unapproved network destinations. | `GAP-011` | Policy test rejects a remote script and inline event-handler path. |
| SEC-013 | Must | Outbound network access shall be default-deny and limited to exact approved fiscal/reference endpoints and signed updater endpoints. | `BR-026`; `GAP-011` | Denied-host test fails; allowlist test permits only approved requests. |
| SEC-014 | Must | Application updates and update metadata shall be cryptographically verified against a pinned trusted key before installation. | Baseline updater; target integrity | Wrong signature/key/artifact test aborts installation. |
| SEC-015 | Must | Logs, diagnostics, crash details, and support bundles shall redact secrets and minimize business payloads. | Privacy target | Seeded-secret and catalog-data scan finds no prohibited value in bundle. |
| SEC-016 | Must | Local model processes shall have no network access and shall be constrained to approved files, memory, CPU/time, and cancellation limits. | `AI-016` | Process/network/resource policy tests pass. |
| SEC-017 | Must | The release shall include a reviewed threat model covering local file import, model artifacts, fiscal update, updater, storage, backup/restore, and egress. | `OD-015` | Threat model maps each threat to requirement/test/owner/residual risk. |
| SEC-018 | Must | Delete/reset/restore operations shall state whether they affect backups, audit records, images, and recoverable trash, and shall not claim secure erasure where the filesystem cannot guarantee it. | Deletion transparency | UI and documentation match actual deletion behavior. |
| SEC-019 | Must | The release shall verify that the production Windows build resolves keys through Windows Credential Manager and every required Linux gate resolves them through the Secret Service API, including set, get, restart persistence, tampered-entry rejection, and unavailable-service behavior. | `GAP-019`; `PLAT-001`, `PLAT-006`–`PLAT-010` | Platform evidence names the active native backend per environment; unavailable native storage follows `SEC-006` and never degrades silently. |
| SEC-020 | Must | A mock credential store or test-only key source shall be confined to automated tests and shall never satisfy production readiness, health status, restore verification, or a release gate. | `GAP-019`; Section 28 `SRC-06` | Release-build feature inspection excludes mock selection; a mocked keychain cannot pass production E2E or readiness checks. |

---

## 20. UX, accessibility, and error handling

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| NFR-001 | Must | The application shall provide a visible offline/dataset/update state without blocking safe local workflows. | Approved offline operation | Network-off fixture shows status and all core local scenarios remain usable. |
| NFR-002 | Must | Every long-running operation shall provide progress where determinable, cancellation, terminal success/failure, and retry guidance. | UX/failure handling | Import/OCR/update/restore tests verify all states. |
| NFR-003 | Must | Errors shall identify the failed operation, affected scope, whether data was changed, and the next safe action. | Actionable errors | Fault-injection messages satisfy the required fields. |
| NFR-004 | Must | GREEN/YELLOW/RED, stale/current, valid/invalid, and tracker states shall not be communicated by color alone. | Accessibility | Text/icon/state machine inspection confirms non-color cues. |
| NFR-005 | Must | All interactive controls shall be keyboard reachable and operable, with visible focus and logical dialog focus order. | Accessibility target | Keyboard acceptance suite passes on both platform runtimes. |
| NFR-006 | Must | Forms, dialogs, tables, status messages, and image alternatives shall expose accessible names, roles, values, and validation messages. | Accessibility target | Accessibility-tree inspection contains required semantics. |
| NFR-007 | Must | Destructive or critical actions shall require explicit confirmation, show the affected scope, and preserve undo/recovery where technically safe. | Human approval | Action matrix confirms prompt, scope, decision, and recovery. |
| NFR-008 | Must | The application shall meet the approved accessibility conformance level in `TBD-007`. | `OD-007` | Release evidence includes the approved audit and remediation disposition. |

---

## 21. Non-functional requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| NFR-009 | Must | Deterministic parsing, validation, costing, fiscal lookup, and state transitions shall produce the same output for the same input, version, and configuration. | Correctness | Replay tests across runs/platforms produce equivalent normalized output. |
| NFR-010 | Must | Release-candidate extraction precision, recall, and field-level grounding shall meet `TBD-001` on the revalidated corpus. | `GAP-006`, `GAP-012` | Approved metric report links dataset, labels, parser version, and raw results. |
| NFR-011 | Must | Release-candidate OCR text/field quality shall meet `TBD-002` on the approved scanned-page corpus. | `GAP-002` | OCR report identifies pages, model, method, and threshold result. |
| NFR-012 | Must | If semantic vision is enabled, its precision/recall and false-acceptance rate shall meet `TBD-003`; if disabled, the UI shall not claim semantic recognition. | `GAP-005` | Enabled gate passes or feature remains unavailable/absent with accurate labeling. |
| NFR-013 | Must | Golden calculation tests shall cover all approved formulas, rounding, allocation, tax-credit, exchange-rate, and stale-data cases. | Financial correctness | Every golden case reconciles line items, totals, warnings, and version. |
| NFR-014 | Must | Release performance shall meet the approved file/page/catalog scenarios in `TBD-004`. | `GAP-003` | Benchmark report includes hardware, dataset, cold/warm run, p50/p95, memory, and pass/fail. |
| NFR-015 | Must | The UI shall remain responsive during supported long-running operations according to `TBD-004`. | Baseline parser jank | Responsiveness trace meets the approved threshold. |
| NFR-016 | Must | Startup shall meet the approved time-to-usable threshold in `TBD-004`. | Desktop usability | Cold/warm startup benchmark passes on each required platform. |
| NFR-017 | Must | The application shall support the approved maximum file size, page count, catalog size, image count, and import batch in `TBD-005` without data corruption. | Capacity approval | Boundary and over-limit fixtures pass/fail as specified. |
| NFR-018 | Must | Peak memory and temporary storage shall remain within the approved limits in `TBD-005` for supported workloads. | Resource safety | Resource telemetry meets the approved gate. |
| NFR-019 | Must | No unhandled error, unhandled rejection, or unexpected console error shall occur in normal supported workflows. | Release cleanliness | E2E console gate is clean for all acceptance scenarios. |
| NFR-020 | Must | Every Must business rule and every security/fiscal integrity requirement shall have at least one automated acceptance test or documented manual release inspection. | Traceability | Traceability report has no untested Must requirement. |
| NFR-021 | Should | The codebase should expose stable module boundaries and schema/contract versions sufficient to replace parser, model, or fiscal adapters without rewriting unrelated workflows. | Maintainability | Dependency-boundary review and adapter contract tests pass. |
| NFR-022 | Must | User data export shall be complete enough to restore the documented local domains on the same or a supported later version. | Portability/recovery | Export-to-empty-installation test reaches the documented equivalent state. |
| NFR-023 | Must | Known dependency vulnerabilities shall be evaluated under the approved severity/release policy in `TBD-014`. | `OD-015` | Dependency report and signed disposition exist for the release candidate. |
| NFR-024 | Must | The application shall not silently degrade data protection, AI availability, fiscal validity, or persistence mode. | Fail-closed quality | Each degradation has explicit visible state and defined permitted operations. |
| NFR-025 | Must | The release shall define a **Core** profile with no AI requirement: deterministic extraction, manual review, and explicit unavailable states for AI/OCR/vision/NCM assistance shall remain complete and release-gated. | Approved decision 5; `GAP-025` | Core-profile E2E completes all deterministic workflows offline with the model set removed and no fabricated assistance. |
| NFR-026 | Must | The release shall define a **Full** profile with the approved local model set, optional GPU acceleration, and an allowed CPU fallback; no Full-profile capability shall require a remote service, and capability activation shall follow the approved quality gates. | Approved decision 5; `AI-019`, `ARC-001`; `GAP-025` | Full-profile E2E proves local GPU/CPU paths, cancellation, provenance, no remote inference, and 16 GB working-set compliance; activation remains benchmark-gated by `NFR-028`. |
| NFR-027 | Must | The approved local model stack shall report and measure process working set for resident and on-demand components, including p50, p95, and peak under a 16 GB shared-RAM budget; weight-file size alone shall not be reported as memory use. | `ARC-001`; `AI-024` | Benchmark report shows per-role and combined working-set telemetry, p50/p95/peak, concurrency, and the 16 GB envelope check. |
| NFR-028 | Must | Activation of `Qwen3-Embedding-0.6B`, `Qwen3-Reranker-0.6B`, and the on-demand `Qwen3.5-4B` advisor shall be gated by a benchmark on the 13 real supplier catalogs with a split by catalog and separate holdout; the report shall include recall@8, hit@1, hit@3, MRR, precision/recall by field, false-accept rate, ECE/Brier, p50/p95 latency, peak working set, and valid-JSON-emitted rate, each against the approved thresholds in `TBD-015`. | `ARC-001`; `OD-017`; Section 29.2 | Owner-approved benchmark report includes dataset/split/label provenance, all listed metrics, raw results, and per-catalog holdout results; provider or MTEB results alone cannot pass the gate. |

---

## 22. Platform, packaging, update, and compatibility requirements

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| PLAT-001 | Must | The target release shall support Windows x64. | Approved platform decision | Clean install, upgrade, core workflow, E2E, update, backup/restore, and uninstall/remove tests pass. |
| PLAT-002 | Must | The first normative Linux release shall be x86_64 and shall run on the Linux runtime/library baseline approved under `OD-008`; the research baseline of WebKitGTK 4.1 is `PROPOSED — PENDING OWNER APPROVAL` and is not normative until approved. | Approved platform decision; Section 28 `SRC-05`, `SRC-07` | Documented x86_64 runtime matrix matches owner approval and every approved platform gate passes. |
| PLAT-003 | Must | The target release shall produce a Linux AppImage artifact. | Approved package decision | AppImage launches and passes core/E2E on approved AppImage QA hosts. |
| PLAT-004 | Must | The target release shall produce a DEB artifact. | Approved package decision | DEB installs/upgrades/removes and passes core/E2E on Debian/Ubuntu gates. |
| PLAT-005 | Must | The target release shall produce an RPM artifact. | Approved package decision | RPM installs/upgrades/removes and passes core/E2E on Fedora gate. |
| PLAT-006 | Must | QA shall include an owner-approved Ubuntu image; the exact version is not normative until approved under `TBD-011`. | Approved QA matrix | Version/image is pinned in CI, matches approval, and the gate passes. |
| PLAT-007 | Must | QA shall include an owner-approved Debian image; the exact version is not normative until approved under `TBD-011`. | Approved QA matrix | Version/image is pinned in CI, matches approval, and the gate passes. |
| PLAT-008 | Must | QA shall include an owner-approved Fedora image; unsupported Fedora 41 shall be removed from the smoke matrix and the exact version is not normative until approved under `TBD-011`. | Approved QA matrix; `GAP-026` | Version/image is pinned in CI, matches approval, excludes Fedora 41, and the gate passes. |
| PLAT-009 | Must | QA shall include an owner-approved Arch-based image or runner; the exact version is not normative until approved under `TBD-011`. | Approved QA matrix | Pinned environment matches approval and the gate passes. |
| PLAT-010 | Must | QA shall include an owner-approved Omarchy environment; the exact version is not normative until approved under `TBD-011`. | Approved QA matrix | Evidence identifies the approved Omarchy environment/hardware and all core/E2E scenarios pass. |
| PLAT-011 | Must | macOS shall not be a target platform, release artifact, or release-gate dependency for this target. | Approved non-goal | Release workflow contains no required DMG/macOS job; macOS-specific behavior is not claimed. |
| PLAT-012 | Must | The desktop shell shall remain Tauri 2 unless a separately approved architecture change updates this SRS. | Approved technology baseline | Manifest/runtime inspection and E2E prove the approved shell. |
| PLAT-013 | Must | Clean installation shall create the documented application-data location with restrictive permissions and shall not overwrite an existing installation's data. | Persistence safety | Clean and repeat-install tests pass. |
| PLAT-014 | Must | In-place upgrade shall preserve supported data, run verified migrations, and support rollback when the application binary can safely revert. | Upgrade/rollback | Prior-version fixture upgrades and post-upgrade recovery pass. |
| PLAT-015 | Must | Release artifacts and updater metadata shall be signed using the approved release-signing policy. | `OD-015` | Verification succeeds with trusted key and fails with altered/untrusted artifacts. |
| PLAT-016 | Must | Automatic application update shall be default-deny for untrusted metadata/artifacts and shall allow the user to defer installation. | Existing updater; target safety | Signed update installs; invalid update is blocked; defer leaves current app usable. |
| PLAT-017 | Must | Application update requests shall contain release/version/platform metadata only and shall not contain business data. | `ASM-006`, `BR-026` | Network capture verifies metadata-only updater traffic. |
| PLAT-018 | Must | Platform/package documentation shall state the exact supported versions, architectures, install paths, permissions, and known limitations for the release. | Supportability | Published release matrix matches CI evidence. |
| PLAT-019 | Must | ARM64 shall not be claimed, published, or gated as supported in the first normative release; adding it requires updated SRS approval and evidence for packaging, runtime, key storage, and QA. | Approved platform decision; `GAP-026` | Artifact and documentation inventory contains no ARM64 support claim; any ARM64 change is rejected until approved. |

**Research-proposed Linux targets — `PROPOSED — PENDING OWNER APPROVAL` (not normative).**

| Target | Proposed value | Limitation |
|---|---|---|
| Architecture | x86_64 | Approved as first normative architecture; ARM64 deferred under `PLAT-019` |
| Runtime library baseline | WebKitGTK 4.1 | Tauri v2 technical baseline; owner approval and real gates still required under `OD-008` |
| Debian | 12 and 13 | Proposed; CI images and real E2E not yet evidenced |
| Ubuntu | 24.04 and 26.04 | Proposed; CI images and real E2E not yet evidenced |
| Fedora | 43 and 44 | Proposed; Fedora 41 is unsupported and must leave the smoke matrix |
| Arch | Rolling release snapshot | Proposed; requires a pinned image or runner and repeatable gate |
| Omarchy | 4.0.4 | Proposed; requires an identified environment and hardware evidence |

---

## 23. Logging, diagnostics, auditability, and observability

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-064 | Must | The application shall record structured audit events for critical data import, edit, override, order save, quotation issue, fiscal activation/rollback, tracker transition, backup/restore, and destructive action. | Approved decision 3 | Event matrix test finds all listed actions with subject and correlation ID. |
| FR-065 | Must | Logs shall use stable event codes and shall not rely on free text as the only machine-readable cause. | Diagnosability | Fault fixtures map to documented event codes. |
| FR-066 | Must | The user shall be able to generate a local redacted diagnostic bundle only through an explicit action. | Privacy | No automatic upload; bundle scan finds no prohibited data. |
| FR-067 | Must | The diagnostic bundle shall include app/runtime/platform version, persistence mode, dataset/package status, updater status, recent error codes, configuration capability flags, and user-selected scope. | Supportability | Bundle schema inspection includes all fields and excludes unselected payloads. |
| FR-068 | Must | The application shall expose a health view for storage, images, fiscal package, models, parser, updater, and last successful backup without exposing secrets. | Operability | Health-state matrix displays current, warning, error, and unavailable states. |
| FR-069 | Must | The health view shall distinguish an intentionally unavailable optional model from a failed required subsystem. | `AI-004` | No-model and corrupt-model states have different messages/severity. |
| FR-070 | Must | Technical logs shall be retained for 1 year and shall never be removed for an active incident before evidence export and hold release; other data classes shall follow the still-open portions of `TBD-009` and `OD-012`/`OD-013`. | Approved decision 9; `DATA-041` | One-year expiry, incident hold, and hold-release tests pass without deleting protected evidence. |

---

## 24. QA, acceptance, release, and rollback criteria

### 24.1 Test layers

| Layer | Required evidence |
|---|---|
| Static | Lint, syntax, schema/contract checks, version consistency, forbidden dependency/scope scan, `keyring` native-feature selection, model distribution manifest |
| Unit/domain | Parser helpers, R1–R10, per-row trace records, spatial image association, OCR/vision/NCM retrieval-rerank adapters, calculations, state machines, fiscal integrity and jurisdiction adapters, DolarAPI mapping, quote lifecycle, retention, migrations, encryption |
| Integration | File adapter to preview to commit, store/image/backup round trip, fiscal update/rollback, local/external backup RPO, NCM shortlist/rerank/abstention, advisor sidecar start/stop, model unavailable/failure, native key store set/get |
| UI/jsdom | Critical workflows, focus/error states, confirmation, preview, quote validity/versioning, tracker, stale/30-day fiscal block, health |
| Real runtime E2E | Tauri runtime on Windows and every approved Linux package/distribution gate, including native Windows Credential Manager and Linux Secret Service verification |
| Fault injection | Cancel, retry, partial import, corrupt file/store/backup/dataset/update, stale data, disk full/permission denied, model failure |
| Security/privacy | CSP, endpoint allowlist, no prohibited egress, path traversal, unsafe rendering, native credential-store verification, key/temp/log redaction, signature failure |
| Corpus QA | Revalidated labeled fixtures and raw result export; no reliance on stale historical metrics |
| Release evidence | Signed artifacts, hashes, provenance/SBOM as approved, test report, traceability, known limitations, rollback rehearsal |

### 24.2 Release acceptance gates

A target release is acceptable only when all of the following are true:

1. Every Must requirement is implemented and its acceptance evidence is attached.
2. Every Should requirement is implemented or has an approved, time-bounded exception with residual-risk disposition.
3. All still-open thresholds in Section 26.4 are approved and passed; resolved `TBD-010` and `TBD-013` are implemented exactly as recorded in Section 26.3.
4. The revalidated ground truth is aligned to the release parser and its sampling/label provenance is recorded.
5. The revalidated corpus shows no unacceptable regression against the approved baseline. Historical claims are not substituted.
6. No catalog, image, order, quote, tracking, override, OCR, vision, model-input, or diagnostic payload leaves the device through AI or business-data endpoints; packet capture proves the only permitted destinations are approved official fiscal endpoints, the approved secondary DolarAPI reference, and signed updater control traffic.
7. Fiscal candidate packages with any integrity-strategy, schema, or completeness failure cannot replace the active package; LKG/offline, daily-check, 7-day warning, and 30-day critical-block tests pass.
8. RED, stale fiscal data, corrupt data, and missing critical evidence fail closed in all required workflows.
9. Backup/restore, migration, cancellation, retry, duplicate, partial-import, stale-data, corruption, and rollback scenarios pass, including encrypted local and external destinations and the RPO 24-hour/RTO 4-hour rehearsal.
10. `npm run test`, `npm run lint`, `npm run check:version`, and `npm run build:frontend` pass.
11. Real Tauri E2E passes on Windows x64 and the owner-approved Linux x86_64 AppImage/DEB/RPM/QA matrix; no unapproved exact Linux version or ARM64 claim is published.
12. Release artifacts and updater metadata verify with the approved trusted key.
13. The normal supported workflows produce a clean console and no unhandled error/rejection.
14. README/version/manifests and the published support matrix agree.
15. Product owner, quality reviewer, fiscal reviewer, and release operator sign the release record; the Mambo owner records fiscal approval and the non-certification statement.
16. Core-profile E2E passes with the model set absent; Full-profile E2E proves the locally distributed model set, license/size/integrity disclosure, optional GPU path, CPU fallback, and zero remote inference.
17. Production builds prove Windows Credential Manager and Linux Secret Service use; a mock credential store cannot pass any release gate.
18. DolarAPI `casa`/internal `mep` mapping, explicit `compra`/`venta` selection, source and local timestamps, and stale/unavailable behavior pass; no silent side, field, or source fallback exists.
19. Quotation consecutive numbering, 15-day validity, correction versioning, and append-only cancellation/substitution tests pass.
20. Ten-year financial/fiscal retention, one-year technical-log retention, incident hold/release, and explicit-deletion evidence pass.
21. The source register is revalidated or re-observed before release, and each active source-specific integrity strategy records whether a publisher proof actually exists.
22. Every `PROPOSED — PENDING OWNER APPROVAL` value used by a release claim is either approved in this SRS or removed from the claim.
23. Gap-closure evidence exists for every `GAP-001`–`GAP-028` row; no gap is closed by documentation alone.
24. The `Qwen3-Embedding-0.6B` / `Qwen3-Reranker-0.6B` / on-demand `Qwen3.5-4B` stack passes the 13-catalog, per-catalog holdout benchmark against the approved `TBD-015` thresholds, with recall@8, hit@1/@3, MRR, per-field precision/recall, false-accept rate, ECE/Brier, p50/p95, peak working set, and valid-JSON-emitted rate reported.
25. The PDF-to-catalog pipeline demonstrates per-row page/bbox/source-text/price-evidence/image-reference/checksum traceability, spatial image association, immutable original evidence, and an iteration that improves the per-catalog holdout on every reported dimension.

### 24.3 Rollback criteria

A release shall be rolled back or the affected capability disabled when any of these conditions occurs:

- prohibited business-data or model-data egress;
- wrong or unverified fiscal data is used for a critical output;
- critical fiscal data remains unupdated past the 30-day block without an approved disposition;
- a critical exchange-rate result silently substitutes `compra`/`venta`, `casa`, or an official fiscal source for a secondary reference;
- corruption, unrecoverable data loss, silent partial commit, or destruction of protected financial or incident evidence;
- quotation numbering reuse, silent in-place correction, or destructive cancellation history;
- invalid import/tracker state mutation;
- signed update/install failure that cannot recover to the previous version;
- critical formula or document reproducibility failure;
- platform blocker prevents a supported required workflow;
- security signature, CSP, encryption, or native key-management failure exposes, permits modification of, or silently downgrades protection of protected data.

Rollback must preserve the user's current data. If data schema compatibility prevents binary rollback, the release must provide a verified data rollback or forward-migration recovery path before distribution.

---

## 25. Gap-closure traceability matrix

### 25.1 Traceability method

For each gap:

1. Record baseline evidence at the release-candidate commit.
2. Link the gap to one or more normative requirement IDs.
3. Execute the acceptance test whose ID is `AT-` plus each linked requirement ID.
4. Store raw results, environment, dataset/model/fiscal versions, and reviewer disposition.
5. Close the gap only when the test and release gate pass. A code change without evidence leaves the gap open.

| Gap | Baseline problem | Target requirements | Acceptance tests / release evidence | Disposition |
|---|---|---|---|---|
| GAP-001 | README `2.2.0` conflicts with manifest `2.2.31` | `BR-025`, `NFR-020` | `AT-BR-025`, release version-check report | Close by automated version consistency and release-doc verification |
| GAP-002 | Scanned PDFs have no OCR runtime | `FR-023`–`FR-026`, `AI-001`–`AI-005`, `NFR-011` | OCR, no-model, partial-page, and offline egress tests | OCR run is optional; unavailable/partial behavior is mandatory and fail-closed |
| GAP-003 | Worker/OffscreenCanvas is a spike only | `FR-030`, `FR-031`, `NFR-014`, `NFR-015` | Worker/main equivalence and performance benchmarks | Integrate only if gates pass; otherwise approved main-thread alternative must pass same gates |
| GAP-004 | R1–R10 contract and exceptions are ambiguous | `FR-034`–`FR-037`, `DATA-005`, `BR-004` | Contract fixtures, reason/evidence inspection, migration tests | Replace ambiguity with versioned contract and explicit review |
| GAP-005 | Image checks are heuristic, not semantic | `FR-038`, `AI-006`, `AI-008`–`AI-012`, `NFR-012` | Labeling test and optional semantic benchmark | Heuristics remain non-semantic; semantic feature is optional and approval-gated |
| GAP-006 | Ground truth is stale/incompletely aligned | `NFR-010`–`NFR-012`, `BR-024` | Revalidated corpus manifest, labels, raw metrics | Rebaseline before release; historical claims are non-normative |
| GAP-007 | NCM snapshot has 10,504 records and no complete refresh policy | `FISCAL-001`–`FISCAL-013`, `FISCAL-020`, `DATA-013`, `DATA-014` | Official-source reconciliation, `@`-delimited schema validation, source/date provenance, atomic activation, LKG tests | Replace hard-coded count with source-declared universe reconciliation; do not claim a publisher checksum/signature that was not observed |
| GAP-008 | Fiscal matrix is static and tax metadata embedded | `FISCAL-001`–`FISCAL-024`, `BR-019`, `FR-050`, `FR-055` | Fiscal update/fault/rollback/stale/provenance, daily-check, 7/30-day threshold, and jurisdiction-adapter tests | Move governed data to versioned packages and reviewed adapters; code may retain adapter defaults only with explicit version/provenance |
| GAP-009 | Backups bypass primary encryption path | `DATA-031`–`DATA-033`, `DATA-038`, `DATA-039`, `SEC-004`–`SEC-007` | Backup ciphertext, tamper, manifest, restore/rollback, local/external destination, RPO/RTO tests | Close with shared authenticated-encryption/key policy and approved recovery objectives; retention/key recovery stay open in `OD-010` |
| GAP-010 | Business configuration/history/diagnostics can persist in LocalStorage | `DATA-027`–`DATA-029`, `DATA-034`, `SEC-003`, `SEC-006` | Storage inventory, store-failure, migration tests | Close by protected persistence and non-persistent/explicit fallback |
| GAP-011 | CSP permits inline scripts and broad HTTPS; current network paths are not target-governed | `BR-026`, `SEC-012`–`SEC-017`, `FISCAL-007`, `PLAT-017` | CSP policy, denied-host, packet-capture, updater-signature tests | Close by strict CSP and exact outbound allowlist |
| GAP-012 | Historical quality claims are not current truth | `BR-024`, `NFR-010`–`NFR-012` | Release-candidate corpus report | Close by revalidation and evidence labeling |
| GAP-013 | RPM absent and macOS DMG remains in target config | `PLAT-003`–`PLAT-005`, `PLAT-011`, `PLAT-018`, `PLAT-019` | Artifact inventory and package gates | Produce RPM; remove macOS and any ARM64 claim from target artifacts/documentation |
| GAP-014 | Real runtime QA is strongest on Windows | `PLAT-002`, `PLAT-006`–`PLAT-010`, `SEC-019` | Ubuntu, Debian, Fedora, Arch, Omarchy E2E reports plus native key-store evidence | Close only when every owner-approved environment passes; exact versions remain non-normative until `OD-008`/`TBD-011` approval |
| GAP-015 | Parser worker performance evidence is spike-specific | `NFR-014`, `NFR-015`, `NFR-020` | Release benchmark in `TBD-004` environment | Re-baseline on target hardware; spike metrics are not acceptance metrics |
| GAP-016 | Quote config/history bypass protected store | `FR-047`, `DATA-034` | Storage inventory and quote migration/round-trip test | Close through protected domain migration |
| GAP-017 | Exchange-rate API is an ungoverned external path with `bolsa`/`mep` inconsistency and side fallback | `BR-016`, `BR-027`–`BR-030`, `FISCAL-020` | `casa`→`mep` mapping, `compra`/`venta` selection, timestamp/provenance, stale/unavailable, offline, packet-capture tests | DolarAPI is approved only as a secondary reference; silent side/field/source fallback is prohibited |
| GAP-018 | Backups/recovery scope is catalog-only or inconsistent | `DATA-019`, `DATA-031`–`DATA-034`, `DATA-038`, `DATA-039` | Full-domain backup/restore/corruption test | Close with complete manifest and verified recovery |
| GAP-019 | `keyring = "3"` has no explicit native features, so Windows Credential Manager/Secret Service use is unproven and mock storage could be mistaken for production security | `SEC-005`, `SEC-006`, `SEC-019`, `SEC-020`, `PLAT-001`, `PLAT-006`–`PLAT-010` | Release-build feature inspection, per-platform native set/get/restart/tamper tests, mock exclusion test | Close only with native backend evidence on every approved platform |
| GAP-020 | Official fiscal/legal/IIBB sources are fragmented and publisher integrity proof was not uniformly observed | `FISCAL-004`, `FISCAL-021`–`FISCAL-023`, `DATA-013`, Section 28 `SRC-01`–`SRC-03` | Source register revalidation, source-specific integrity-strategy review, jurisdiction adapters, semantic-approval tests | Close with approved adapters and truthful integrity metadata; no invented signature/checksum claims |
| GAP-021 | No governed daily fiscal check cadence or 7-day/30-day source-age behavior | `FISCAL-014`, `FISCAL-016`, `FR-055`, `BR-019` | Scheduler, 6/7-day warning, 29/30-day critical block, declared-validity expiry, offline LKG tests | Close with exact approved thresholds and no 30-day critical issuance |
| GAP-022 | Backup coverage, destinations, and recovery objectives are not release-gated | `DATA-031`–`DATA-033`, `DATA-038`, `DATA-039`, `SEC-007` | Local/external encrypted backup, verified restore, RPO 24h, RTO 4h rehearsal | Close recovery objectives; retention count/age and key recovery remain open in `OD-010` |
| GAP-023 | Retention, deletion, and incident-hold behavior are not consistently governed | `DATA-023`, `DATA-040`–`DATA-042`, `FR-070`, `SEC-018` | Ten-year financial/fiscal, one-year technical-log, incident hold/release, explicit deletion tests | Close approved periods and evidence protection; other business-record periods remain open in `OD-012`/`OD-013` |
| GAP-024 | Quotation validity, numbering, corrections, and cancellation history are not governed to the approved policy | `DATA-012`, `FR-045`, `FR-071`–`FR-073` | Consecutive-number concurrency/retry/restore, 15-day boundary, immutable correction version, append-only cancellation/substitution tests | Close with the approved quotation lifecycle; no silent in-place correction |
| GAP-025 | Models and hardware profiles are not governed as release components | `AI-001`–`AI-004`, `AI-013`, `AI-019`, `NFR-025`, `NFR-026` | Clean-install distribution inventory, license/size/integrity disclosure, Core no-model E2E, Full local GPU/CPU E2E | Include models in the main Full distribution; exact hardware values stay `PROPOSED — PENDING OWNER APPROVAL` under `OD-008`/`TBD-006` |
| GAP-026 | Linux version targets are unapproved, ARM64 evidence is absent, and the current smoke matrix includes unsupported Fedora 41 | `PLAT-002`, `PLAT-006`–`PLAT-010`, `PLAT-019`, Section 28 `SRC-05`, `SRC-07` | Owner-approved matrix, removed Fedora 41, package/runtime E2E, ARM64 claim inventory | Approve exact versions and runtime baseline under `OD-008`/`TBD-011`; keep all research values non-normative until then |
| GAP-027 | PDF-to-catalog rows are not consistently traceable and correctorable: fields are imprecise and images can attach to the wrong product | `FR-074`–`FR-079`, `DATA-003`, `DATA-004`, `BR-005`, `FR-036` | Per-row trace, spatial image association, immutable-evidence, staged pipeline, and correction audit tests | Close with end-to-end page-region-to-image/checksum evidence and atomic commit; no visual-similarity-only association |
| GAP-028 | No approved local NCM retrieval/reranking/advisor architecture or Mambo-specific benchmark gate exists | `AI-020`–`AI-026`, `NFR-027`, `NFR-028`, `ARC-001` | 13-catalog per-catalog holdout benchmark, working-set/latency telemetry, abstention and valid-JSON tests | Architecture approved; activation remains open until `TBD-015` thresholds pass and `OD-017` closes |

### 25.2 Approved-decision traceability

This numbering is the numbering used by the `Approved decision N` rationale references in the requirement tables.

| Approved decision | Normative coverage | Gap / remaining approval |
|---|---|---|
| 1 — Local-first internal Tauri desktop; no cloud, accounts, or multiuser | `FR-001`, `DATA-024`, `SEC-001`, `SEC-002`, `PLAT-012` | None; scope exclusions remain normative |
| 2 — Functional scope limited to catalog → order → quotation → import planning/tracking | Section 6.1; Section 6.2; module table in Section 8 | None; new domains require a separate approved SRS change |
| 3 — AI/OCR/vision/NCM always local, supervised, evidence-bearing, fail-closed | `AI-001`–`AI-018`, `BR-005`, `DATA-004`, `DATA-022`, `SEC-016` | Vision threshold `TBD-003` remains open |
| 4 — Local models included in the main Full-profile distribution with license/size/integrity disclosure | `AI-013`, `AI-014`, `AI-019`, `NFR-025`, `NFR-026` | License/integrity policy detail `OD-009`; hardware `TBD-006` |
| 5 — Core profile without AI; Full profile with optional GPU and allowed CPU fallback | `NFR-025`, `NFR-026`, `AI-004`, `FR-025`, `FR-026` | Exact CPU/RAM/GPU values `PROPOSED — PENDING OWNER APPROVAL` |
| 6 — Argentina national fiscal rules plus configurable IIBB; Mambo owner is fiscal release approver; no legal certification | `FISCAL-021`–`FISCAL-024`, `FR-050`, `BR-005`, `BR-015` | Source schemas/integrity approval `OD-003`; validation artifacts/cadence `TBD-012` |
| 7 — Daily fiscal check, 7-day warning, 30-day critical block, LKG cache, atomic activation | `FISCAL-008`–`FISCAL-019`, `BR-019`, `FR-055` | Retry/conditional-fetch detail remains in `OD-004` |
| 8 — Encrypted automatic local and external backups, RPO 24 hours, RTO 4 hours | `DATA-031`–`DATA-033`, `DATA-038`, `DATA-039`, `SEC-007` | Retention count/age and key recovery `OD-010`, `TBD-008` |
| 9 — Financial/fiscal records 10 years; technical logs 1 year; protected incident evidence | `DATA-023`, `DATA-040`–`DATA-042`, `FR-070`, `SEC-018` | Other business-record periods `OD-012`, `OD-013` |
| 10 — Quotation validity 15 days, consecutive numbering, correction versions, append-only cancellation/substitution | `DATA-012`, `FR-045`, `FR-071`–`FR-073` | Resolved records `OD-014`, `TBD-010` in Section 26.3 |
| 11 — DolarAPI secondary reference with explicit `casa`/side/timestamps and `bolsa`→`mep` mapping | `BR-016`, `BR-027`–`BR-030`, `FISCAL-020` | Stale threshold and refresh policy `OD-011` |
| 12 — Windows x64 plus Linux AppImage/DEB/RPM with Ubuntu/Debian/Fedora/Arch/Omarchy QA | `PLAT-001`–`PLAT-010`, `PLAT-018` | Exact Linux versions/runtime/ARM64 `OD-008`, `TBD-011` |
| 13 — PDF-to-catalog traceability, staged pipeline, and per-catalog holdout improvement are the central quality objective | `FR-074`–`FR-081`, `DATA-003`, `DATA-004`, `NFR-010`–`NFR-012` | Benchmark dimensions and holdout approval in `NFR-028`, `TBD-015` |
| 14 — Local NCM/advisor architecture `Qwen3-Embedding-0.6B`, `Qwen3-Reranker-0.6B`, on-demand `Qwen3.5-4B` is `APPROVED ARCHITECTURE — BENCHMARK GATED` | `AI-020`–`AI-026`, `NFR-027`, `NFR-028`, `ARC-001` | Activation thresholds `TBD-015`; activation decision `OD-017` |

---

## 26. Risks, dependencies, and open decisions

### 26.1 Risks and dependencies

| ID | Risk / dependency | Impact | Mitigation / release evidence |
|---|---|---|---|
| RSK-001 | OCR model availability, licensing, language coverage, or hardware cost | Scanned catalogs remain partially manual | `OD-008`, `OD-009`; no-model fallback; local-only tests |
| RSK-002 | Official fiscal sources lack stable machine-readable endpoints or change schema | Update interruption or incorrect interpretation | Multiple approved adapters if needed; schema contract; LKG; no hard-coded count |
| RSK-003 | Legal/fiscal rules change faster than release cadence | Stale or incorrect calculations | Validity metadata, daily automatic checks, 7/30-day thresholds, fiscal reviewer, owner approval, `OD-003`/`OD-016` |
| RSK-004 | Worker refactor changes spatial/image evidence | Product and quality regression | Equivalence hashes, revalidated corpus, fallback, no spike-only claims |
| RSK-005 | Semantic vision false confidence misleads users | Wrong images accepted | Optional feature, no self-approval, confidence labeling, `TBD-003` |
| RSK-006 | Native key storage is unavailable, mock-selected, or unrecoverable on a supported OS | Data unavailable or plaintext degradation risk | `SEC-005`, `SEC-006`, `SEC-019`, `SEC-020` platform gate, fail closed, backup key metadata, recovery decision `OD-010` |
| RSK-007 | Linux WebView/runtime/package differences | Platform-specific failures or data loss | Required distro matrix, package tests, clean install/upgrade/restore |
| RSK-008 | Broad CSP migration breaks legacy inline handlers | Runtime/UI regression | Incremental handler migration, runtime smoke/E2E, strict final policy gate |
| RSK-009 | Ground-truth relabeling introduces bias or misalignment | False quality confidence | Versioned sampling plan, independent review, raw fixtures/results, no historical substitution |
| RSK-010 | NCM/tariff update is syntactically valid but semantically wrong | Incorrect fiscal output | Source reconciliation, reviewer approval for mappings, provenance, scenario-level human gate |
| RSK-011 | Backup encryption makes recovery impossible after credential loss | Business-data loss | Approved key recovery/escrow/export policy before release; verified restore rehearsal |
| RSK-012 | External source outage or TLS failure | Fiscal refresh unavailable | LKG/offline behavior, retry diagnostics, no destructive fallback |
| RSK-013 | Performance targets drive unsafe shortcuts or overengineering | Quality/security regression | Approve workload thresholds; profile; preserve fail-closed and evidence behavior |
| RSK-014 | Historical README/docs become stale again | Review/release confusion | Automated version/doc checks and release evidence ownership |
| RSK-015 | DolarAPI `casa` names or side semantics change, or the service degrades without a published SLA | Wrong exchange-rate basis in a critical document | `BR-028`–`BR-030`; explicit mapping/side selection, visible stale state, manual override, fail-closed critical use, `OD-011` |
| RSK-016 | Local model sizing exceeds Core/Full hardware or packaging budget | Full profile unavailable or install failure | `AI-019`, `NFR-025`, `NFR-026`; model license/size/integrity disclosure, optional capability packaging, deterministic fallback |
| RSK-017 | Publisher data is changed in place or the technical format changes without notice | Wrong or unparseable fiscal data | Source/date provenance, local digest capture, schema/completeness validation, semantic approval, LKG, truthful proof metadata |
| RSK-018 | Combined resident and on-demand model working set exceeds the 16 GB budget or is misreported as weight size | Thrashing, OOM, or false performance claims | `AI-024`, `NFR-027`; per-role working-set telemetry, p50/p95/peak, on-demand unload |
| RSK-019 | Benchmark overfits the 13 catalogs, leaks across the per-catalog split, or relies on provider/MTEB claims | False confidence in NCM ranking and calibration | `NFR-028`, `OD-017`, `TBD-015`; per-catalog holdout, raw results, ECE/Brier, owner approval |
| RSK-020 | Image association drifts toward visual similarity without spatial evidence | Product photo attached to the wrong row | `FR-075`, `FR-076`, `FR-081`; bbox/column/region evidence, checksum, per-catalog image-association metric, human review |

### 26.2 Open decisions

These decisions are not silently assumed by this SRS. The indicated threshold or choice blocks the affected release gate until approved. Decisions already resolved by the product owner are recorded in Section 26.3 and remain traceable by ID.

| Open decision | Remaining decision / exact threshold to approve | Status and blocks |
|---|---|---|
| OD-001 | Target release semantic version and release date | Open — blocks release identity |
| OD-003 | Owner approval of source-specific artifact parsing/integrity strategies: endpoint/artifact identity, schema contracts, `@`-delimited parsing, digest/signature expectations, and semantic-review rules | Open — research identified candidates but no uniform publisher proof; blocks fiscal updater |
| OD-004 | Conditional-fetch behavior and retry/backoff schedule for daily fiscal checks | Partially resolved: daily cadence approved; retry detail open — blocks fiscal updater |
| OD-005 | Corpus methodology and approved parser/OCR thresholds in `TBD-001` and `TBD-002` | Open — blocks quality gate |
| OD-006 | Semantic-vision benchmark and threshold in `TBD-003` | Open — blocks optional vision feature |
| OD-007 | Approved accessibility conformance target in `TBD-007` | Open — blocks accessibility gate |
| OD-008 | Exact Core/Full hardware values and the Linux x86_64 runtime/distro baseline in `TBD-006` and `TBD-011`; ARM64 remains out of the first normative release | Open — research values are `PROPOSED — PENDING OWNER APPROVAL`; blocks platform matrix |
| OD-009 | Remaining model license record, integrity verification, support, and separate-capability packaging policy | Partially resolved: models ship in the main Full distribution; policy details open — blocks optional AI |
| OD-010 | Backup retention count/age, export size policy, and key-recovery procedure in `TBD-008` | Partially resolved: RPO 24h and RTO 4h approved; retention/key recovery open — blocks backup/restore release |
| OD-011 | DolarAPI stale threshold, refresh/conditional-fetch policy, and treatment of absent SLA/rate-limit information | Partially resolved: DolarAPI approved as secondary reference with explicit mapping/provenance; stale policy open — blocks exchange-rate feature |
| OD-012 | Audit, diagnostics, import-session, order, and tracker retention periods not covered by the approved financial/technical-log rules in `TBD-009` | Partially resolved: technical logs 1 year, financial/fiscal 10 years; other classes open — blocks data lifecycle |
| OD-013 | Remaining business-record retention/deletion policy and archive procedure beyond `DATA-040`–`DATA-042` | Partially resolved: 10-year financial/fiscal retention and explicit deletion/incident evidence approved; remainder open — blocks data lifecycle |
| OD-015 | Artifact signing, vulnerability-severity, exception, and support policy in `TBD-014` | Open — blocks security/release |
| OD-016 | Required fiscal/legal validation artifacts and revalidation cadence in `TBD-012` | Partially resolved: Mambo owner is fiscal release approver; artifacts/cadence open — blocks fiscal/costing signoff |
| OD-017 | Activation decision for the `APPROVED ARCHITECTURE — BENCHMARK GATED` NCM/advisor stack after the 13-catalog per-catalog holdout benchmark, including accepted per-dimension thresholds in `TBD-015` | Open — architecture is approved but activation and any metric pass mark are not |

### 26.3 Resolved decision and threshold records

These records are closed by the approved product decisions in this document. Their IDs remain reserved for traceability and shall not be reused.

| Closed record | Resolution | Normative coverage / evidence |
|---|---|---|
| OD-002 | Target fiscal scope is Argentina national rules plus IIBB configurable by province/jurisdiction. The owner of Mambo is the fiscal release approver, and the release is explicitly not legal, tax, or customs certification. | `FISCAL-021`–`FISCAL-024`, `FR-050`; approved decision 6 |
| OD-014 | Quotation lifecycle is approved: 15-day validity, consecutive non-reused numbering, corrections as new immutable versions, and append-only cancellation/substitution events. | `FR-045`, `FR-071`–`FR-073`, `DATA-012`; approved decision 10 |
| TBD-010 | Quotation validity is 15 calendar days; correction requires a new version; cancellation/substitution is append-only. | `FR-045`, `FR-071`–`FR-073`; accepted fixtures at the 15-day boundary |
| TBD-013 | Official fiscal sources are checked daily; a warning appears after 7 calendar days without a successful update; critical fiscal results are blocked after 30 calendar days. Declared dataset validity expiry remains independently fail-closed. | `FISCAL-014`, `FISCAL-016`, `BR-019`, `FR-055`; boundary fixtures at 6/7 and 29/30 days |

### 26.4 Approval and assumption thresholds

| TBD ID | Exact threshold to approve before acceptance | Default if unresolved |
|---|---|---|
| TBD-001 | Parser precision, recall, field grounding, and per-format minimums on the revalidated corpus | No release; no historical default |
| TBD-002 | OCR character/word/field accuracy and maximum excluded-page rate for supported scanned catalogs | No release claim for scanned import; deterministic partial fallback only |
| TBD-003 | Semantic-vision precision, recall, false-acceptance rate, and abstention requirements | Feature disabled/unavailable |
| TBD-004 | Startup, page/file processing, UI responsiveness, commit, export, fiscal refresh, and restore latency thresholds by workload/hardware | No performance acceptance claim |
| TBD-005 | Maximum file bytes, pages, rows, catalog products, images, batch size, peak memory, and temporary disk | No unsupported workload claim |
| TBD-006 | Exact minimum CPU, RAM, GPU/model acceleration, disk, and supported model runtime for the Core and Full profiles | Core/Full profile separation is approved; exact values remain `PROPOSED — PENDING OWNER APPROVAL` until models are dimensioned; no unstated hardware claim |
| TBD-007 | Accessibility standard/conformance level and required testing matrix | Accessibility gate remains open |
| TBD-008 | Backup frequency, retention count/age, export size policy, and key-recovery procedure | RPO 24 hours and RTO 4 hours are approved; retention/key-recovery detail remains open and the recovery gate stays open |
| TBD-009 | Retention periods for audit, diagnostics, import attempts, orders, and tracker records not already fixed by the approved financial/fiscal and technical-log rules | Financial/fiscal 10-year and technical-log 1-year rules are approved; other classes receive no automatic deletion and require manual review |
| TBD-011 | Exact supported Ubuntu/Debian/Fedora/Arch/Omarchy versions and Linux runtime library baseline | x86_64 is approved; Debian 12/13, Ubuntu 24.04/26.04, Fedora 43/44, rolling Arch, Omarchy 4.0.4, and WebKitGTK 4.1 are `PROPOSED — PENDING OWNER APPROVAL`; required matrix incomplete, release blocked |
| TBD-012 | Required fiscal/legal validation artifacts and revalidation cadence | Mambo owner as fiscal release approver is approved; artifacts/cadence remain open and fiscal release stays blocked |
| TBD-014 | Artifact-signing, vulnerability-severity, exception, and support policy | Release remains blocked until the security/release policy is approved |
| TBD-015 | Exact pass thresholds for the 13-catalog per-catalog holdout benchmark: recall@8, hit@1/@3, MRR, precision/recall by field, false-accept rate, ECE/Brier, p50/p95 latency, peak working set, and valid-JSON-emitted rate | No activation; the architecture remains `APPROVED ARCHITECTURE — BENCHMARK GATED` and the model stack remains inactive until thresholds and `OD-017` are approved |

---

## 27. Glossary and abbreviations

| Term | Definition |
|---|---|
| AI | Software-assisted inference used for OCR, vision, classification, or suggestions; target execution is local |
| Atomic update | All-or-nothing activation where no consumer observes a mixed package/state |
| Core profile | Approved hardware profile with deterministic workflows and no AI requirement; assistance states are explicit when models are absent |
| CIF | Cost, Insurance, and Freight |
| CSP | Content Security Policy |
| Critical decision | A decision that changes accepted business data, fiscal treatment, financial output, issued document, tracked state, or durable data |
| DEK | Data encryption key used by the current protected-store implementation |
| Evidence | Source-bound record supporting an extracted or accepted value |
| Fail-closed | Reject, block, or require explicit review when required evidence/integrity/approval is absent |
| FOB | Free On Board value used as a product/order cost basis |
| Full profile | Approved hardware profile with the locally distributed model set, optional GPU acceleration, and an allowed CPU fallback |
| Ground truth | Versioned, human-reviewed labels used to evaluate extraction/assistance quality |
| IIBB | Impuesto sobre los Ingresos Brutos; configured per selected province/jurisdiction |
| ID | Stable identifier |
| Import session | Durable record of one catalog import workflow and all attempts/states |
| Last-known-good (LKG) | Most recently activated fiscal/reference package that passed all integrity and semantic checks |
| Local-first | Core data and workflows operate on the local device without requiring a remote service |
| NCM | Nomenclatura Común del Mercosur; target fiscal classification dataset |
| Normative | Binding on target implementation and acceptance |
| `needs_review` | Explicit unresolved disposition for missing/contradictory evidence, low model score/margin, model failure, or doubt; never an accepted value |
| OCR | Optical Character Recognition |
| OffscreenCanvas | Browser API proposed for canvas work outside the main thread |
| Override | Explicit human replacement of a suggested, detected, or default value |
| Partial import | Explicitly approved commit of a defined subset when one or more files/pages/items are excluded or failed |
| Provenance | Identity of source, method, model/dataset version, evidence, and decision lineage |
| ROI | Return on investment |
| Reranking | Local reordering of a retrieval shortlist with score and top-1 versus top-2 margin; always a suggestion, never an acceptance |
| RPO | Recovery point objective; approved backup objective is 24 hours |
| RTO | Recovery time objective; approved restore objective is 4 hours |
| R1–R10 | Versioned catalog quality-rule contract defined in Section 13.1 |
| Shortlist | Bounded ranked candidate list retrieved from the active NCM package; initially top-8 |
| Sidecar | Local process managed by the application to run the on-demand advisor without an external service installation |
| Snapshot | Immutable historical copy of data/scenario used to reproduce a result |
| Tauri | Desktop application shell/runtime used by the target |
| TBD | Threshold or decision to be approved; not an implied default |
| WebView | Embedded browser runtime used by Tauri on supported platforms |
| Working set | Measured resident memory of a process/component set at runtime; distinct from the on-disk weight-file size |
| Worker | Execution context used for CPU-heavy local processing; target worker use is conditional on equivalence/performance gates |

---

## 28. Verified research source register

This register records what was observed on **2026-09-25**. A source may be primary for its own legal or technical domain without being a complete, machine-readable, or integrity-signed input for the application. Research observations are evidence, not automatic product approval: exact hardware values, the WebKitGTK 4.1 runtime baseline, and the exact Linux versions in Section 22 remain `PROPOSED — PENDING OWNER APPROVAL`. The local NCM/advisor model inventory in `SRC-09` is an approved architecture input recorded in `ARC-001`, not benchmark or accuracy evidence.

| Source ID | Source and URL | Class | Verified observation (2026-09-25) | Limitation for Mambo |
|---|---|---|---|---|
| SRC-01 | ARCA — Arancel Integrado: <https://serviciosweb.afip.gob.ar/aduana/arancelintegrado/default.asp> ; mutable public archive: <https://serviciosweb.afip.gob.ar/aduana/arancelintegrado/archivos/arancel.zip> | Primary official technical/dataset source | Page and ZIP reachable; observed artifact update date 2026-09-25; technical files use an `@`-delimited structure | Mutable artifact; no uniform publisher checksum or signature was observed; parsing and integrity strategy require owner approval under `OD-003`; HTTPS/schema/source-date validation and truthful proof metadata are required |
| SRC-02 | Primary legal corpus: Boletín Oficial (BORA) <https://www.boletinoficial.gob.ar/> ; Argentina Normativa <https://www.argentina.gob.ar/normativa/> ; ARCA Biblioteca Electrónica <https://biblioteca.arca.gob.ar/> | Primary legal sources | Used as the authoritative publication/search layer for legal change detection | No single consolidated machine-readable national JSON for IVA, IVA additional, Ganancias, statistical rate, perceptions, regimes, and IIBB was found; semantic interpretation requires reviewed adapters and owner approval |
| SRC-03 | IIBB evidence: ARCA Registro Único Tributario — jurisdicciones <https://www.afip.gob.ar/registro-unico-tributario/registro/jurisdicciones-adheridas.asp> ; representative ARBA alícuotas service <https://app.arba.gov.ar/ServiciosAlicuotasUI/> ; COMARB jurisdictions <https://www.ca.gob.ar/datos-jurisdicciones> | Primary jurisdictional evidence | Confirms that IIBB data is jurisdiction-specific and published by different authorities | These are evidence that adapters are required, **not** a complete national rate table; no single national IIBB endpoint was found; each enabled province requires its own approved adapter and owner approval |
| SRC-04 | DolarAPI endpoint <https://dolarapi.com/v1/dolares> ; operation documentation <https://dolarapi.com/docs/argentina/operations/get-dolares> | **Secondary reference only — never an official fiscal source** | Response fields include `casa`, `compra`, `venta`, and `fechaActualizacion`; upstream data is attributed to DolarHoy and Ámbito Financiero | No published SLA or rate limit was observed; not a fiscal authority; application must handle the `bolsa`/internal `mep` mapping, explicit side selection, source/retrieval timestamps, and stale/unavailable behavior under `BR-027`–`BR-030` |
| SRC-05 | Tauri v2 technical baseline: prerequisites <https://v2.tauri.app/start/prerequisites/> ; Debian distribution <https://v2.tauri.app/distribute/debian/> ; AppImage distribution <https://v2.tauri.app/distribute/appimage/> ; RPM distribution <https://v2.tauri.app/distribute/rpm/> | Secondary technical documentation | Tauri v2 targets WebKitGTK 4.1 on Linux and requires building on an old enough base system to preserve glibc compatibility; Debian and AppImage packaging guidance was available | Does not approve Mambo's runtime baseline, distro versions, or ARM64 support; WebKitGTK 4.1 and proposed versions remain `PROPOSED — PENDING OWNER APPROVAL` |
| SRC-06 | Native credential-store evidence: `keyring` crate documentation <https://docs.rs/keyring/3.6.2/keyring/> ; freedesktop Secret Service specification <https://specifications.freedesktop.org/secret-service/latest/> | Secondary technical documentation/specification | Windows Credential Manager and Linux Secret Service access are feature-gated (`windows-native`, `sync-secret-service`/`async-secret-service` or an approved keyutils combination); with no applicable store feature the crate uses its mock credential store | `keyring = "3"` without explicit native features does not prove native store behavior; mock storage is not production evidence and is prohibited by `SEC-020`; per-platform runtime verification is required by `SEC-019` |
| SRC-07 | Upstream Linux lifecycle/release indexes: Debian <https://www.debian.org/releases/> ; Ubuntu <https://releases.ubuntu.com/> ; Fedora <https://fedoraproject.org/releases/> ; Arch Linux <https://archlinux.org/> ; Omarchy <https://omarchy.org/> | Primary upstream distribution information | Research proposal lists Debian 12/13, Ubuntu 24.04/26.04, Fedora 43/44, rolling Arch, and Omarchy 4.0.4; Fedora 41 is not in the proposed set | Release existence and lifecycle status do not prove WebKitGTK availability, Secret Service availability, packaging success, or E2E compatibility; exact versions and hardware remain non-normative under `OD-008`, `TBD-006`, and `TBD-011` |
| SRC-08 | Current repository evidence: `src-tauri/Cargo.toml` (`keyring = "3"`), `src-tauri/tauri.conf.json`, CI smoke configuration, and `src/js/app.js::fetchLiveDolarRates` / `renderDolarBadges` | Current implementation evidence (descriptive, not normative) | AppImage/DEB are configured, RPM is absent, the smoke matrix includes unsupported Fedora 41, native key features are not declared, and DolarAPI `bolsa`/internal `mep` handling is inconsistent | Baseline facts only; they do not satisfy `SEC-019`, `PLAT-008`, `BR-028`, or any other target requirement until acceptance evidence exists |
| SRC-09 | Approved product architecture record: `Qwen3-Embedding-0.6B` (Apache-2.0), `Qwen3-Reranker-0.6B` (Apache-2.0), and `Qwen3.5-4B` GGUF Q4_K_M (Apache-2.0); no external URL — recorded in `ARC-001` | Approved product input, **not** acceptance evidence | Roles, local runtimes, quantization, on-demand lifecycle, and 16 GB shared-RAM working-set budget are approved | Contains no Mambo accuracy, calibration, latency, or working-set results; provider or MTEB benchmarks are insufficient; activation remains blocked by `TBD-015`/`OD-017` |

---

## 29. PDF-to-catalog traceability, correction, and benchmark gate

The central quality problem is incorrect or imprecise data after PDF import, including product photos attached to the wrong row. The normative pipeline is therefore trace-first: no value or image association is accepted without page-region evidence, and model assistance may rank, compare, score, or explain but never rewrite the original evidence.

### 29.1 Required import stages and per-row traceability

Every PDF import shall execute these ordered stages, recording completion, evidence, and disposition for each one. Section 12.1 continues to govern session lifecycle; every import session shall map its current state to one of these stages.

| Order | Stage | Required output | Gate to advance |
|---|---|---|---|
| 1 | Ingest | Source identity, file hash, page count, type detection, per-page row anchoring | File/page identity and row anchors are durable |
| 2 | Extraction | Candidate field values with page, bounding box/coordinates, source text span, method, and price evidence | Every extracted critical field has a source-region record or an explicit missing-evidence state |
| 3 | Image association | Image reference, checksum, and the spatial column/region evidence linking the image to the row | Association is supported by spatial evidence; visual similarity alone is insufficient |
| 4 | Normalization | Canonical SKU/identity/format values with references to the unchanged extraction records | Normalization preserves lineage to the original value and evidence |
| 5 | Quality gates | R1–R10 results, importability, warnings, duplicate candidates, and errors | RED/duplicate/evidence failures follow the fail-closed disposition |
| 6 | Local assistance | NCM shortlist/rerank, OCR, vision, or advisor suggestions with provenance, score/confidence, evidence, and model version | Output is valid, evidence-bearing, and never self-accepting |
| 7 | Human review | Accepted/rejected/overridden values with reason, actor action, and timestamp; `needs_review` remains unresolved | Every selected critical value is approved or explicitly overridden |
| 8 | Atomic commit | Idempotent durable catalog write and audit events for the approved selection | Commit is atomic/recoverable; no partial or mixed-version row is exposed |

| ID | Priority | Normative requirement | Rationale / source | Verifiable acceptance criteria |
|---|---|---|---|---|
| FR-074 | Must | Every imported row shall retain source page, bounding box/coordinates, extracted source text, price evidence, image reference, and a content checksum, or an explicit unresolved state when the evidence is absent. | Approved decision 13; Section 29.1; `DATA-004` | Row inspector locates every listed item and checksum verifies against the stored source/asset; missing evidence cannot be hidden. |
| FR-075 | Must | Product images shall be associated from spatial evidence — page position, table column, bounding region, and neighbouring row/cell anchors — and shall never be accepted on visual similarity alone. | Approved decision 13; `GAP-027` | Correct, swapped-column, and visually similar wrong-image fixtures produce the documented association or `needs_review`; similarity-only matching is rejected. |
| FR-076 | Must | Original extraction and image-association evidence shall be immutable; AI or user correction shall create a new linked correction record and shall never rewrite, delete, or silently replace the original evidence. | Approved decision 13; `DATA-003`, `DATA-018` | Before/after inspection proves original evidence is byte/logically identical and the correction is linked, reasoned, and audited. |
| FR-077 | Must | Every PDF import shall execute and record the ordered stages: ingest → extraction → image association → normalization → quality gates → local assistance → human review → atomic commit. | Approved decision 13; Section 12.1 | Stage-order, skip, re-entry, cancellation, and restart fixtures pass; the current stage is always visible. |
| FR-078 | Must | Stage outputs shall be durable and traceable to the same import session and row identity, and the final commit shall be atomic or an explicitly recoverable `partially_committed` outcome. | `FR-010`, `FR-029`, `DATA-030` | Fault injection at each stage leaves the prior committed state or a recoverable outcome with no duplicated or mixed-version row. |
| FR-079 | Must | A row with missing/contradictory evidence, low assistance score, insufficient top-1/top-2 margin, model failure, or image-association doubt shall remain `needs_review` until a human approves, rejects, or overrides it. | Decisions 3, 13, 14; `AI-010`–`AI-012`, `AI-022` | Every doubt fixture is blocked from silent commit and produces a human disposition with before/after evidence. |
| FR-080 | Must | Benchmark reporting shall measure field extraction, prices, SKU, product identity, image association, and duplicate detection as separate dimensions; an aggregate score shall not replace the per-dimension results. | Approved decision 13; `NFR-028` | Benchmark report contains one labeled metric set per dimension, dataset/split provenance, and raw results. |
| FR-081 | Must | An iteration shall be considered an improvement only when it improves the per-catalog holdout on the reported dimensions without a material regression; if it does not improve the per-catalog holdout, it shall not be described or released as an improvement. | Approved decision 13; `ASM-008` | Iteration comparison shows the per-catalog holdout delta for every dimension; a non-improving iteration is recorded as not improved. |

### 29.2 NCM/advisor benchmark gate

The benchmark uses the 13 real supplier catalogs. The split is **by catalog**, not by page or row, so no page, image, or product from one catalog appears on both sides of the split. The exact split, labels, and pass thresholds require owner approval in `TBD-015`; activation additionally requires `OD-017`. MTEB results and provider/model-card benchmarks are context only and are **not sufficient evidence for Mambo**.

| Required metric | Scope | Notes |
|---|---|---|
| recall@8 | NCM retrieval | Measures whether the correct official candidate is in the top-8 shortlist |
| hit@1, hit@3 | NCM reranking | Measures top-1/top-3 correctness after reranking |
| MRR | NCM reranking | Mean reciprocal rank of the correct candidate |
| Precision/recall by field | Prices, SKU, product identity, NCM, image association, duplicates | Reported separately per dimension, not only as one aggregate |
| False-accept rate | Critical fields and image associations | Must remain consistent with the fail-closed/`needs_review` behavior |
| ECE / Brier | Score calibration | Assessed only with documented labels, binning, and calibration method |
| p50 / p95 latency | Per model role and end-to-end | Reported with hardware, runtime, quantization, and concurrency |
| Peak working set | Resident plus on-demand processes | Reported from measured process working set, not weight-file size; checked against the 16 GB budget |
| Valid JSON emitted | Every model-assisted operation | Malformed output counts as failure and routes to `needs_review` |

### 29.3 Architecture approval record

| Record | Value |
|---|---|
| `ARC-001` | `APPROVED ARCHITECTURE — BENCHMARK GATED` |
| Approved components | `Qwen3-Embedding-0.6B` (Apache-2.0, local ONNX INT8/FP16, top-8 shortlist); `Qwen3-Reranker-0.6B` (Apache-2.0, local ONNX INT8, rerank/score/margin/abstention); `Qwen3.5-4B` GGUF Q4_K_M (Apache-2.0, application-managed on-demand local sidecar) |
| Approved runtime boundary | Local only; no cloud or remote inference; no required external Ollama/llama-server installation; advisor loaded on demand and unloaded when finished |
| Approved memory envelope | 16 GB shared RAM; working set measured and reported for resident and on-demand components |
| Approval scope | Architecture, roles, licensing, quantization, residency, and output restrictions |
| Not approved / not claimed | Any achieved recall, hit rate, MRR, calibration, false-accept rate, latency, or working-set result; initial activation; exact metric thresholds |
| Open items | `TBD-015` exact benchmark pass thresholds; `OD-017` activation decision after the per-catalog holdout benchmark |
| Approval date | 2026-09-25 |
| Traceability | `AI-020`–`AI-026`, `NFR-027`, `NFR-028`, `FR-074`–`FR-081`, `GAP-027`, `GAP-028`, Section 28 `SRC-09` |
