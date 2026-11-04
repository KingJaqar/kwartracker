# Kwartracker Android EAS Build workflow

**Baseline:** [PRD/SRS v1.11](Kwartracker-PRD-SRS-v1_11.md), FR-DEV-001–007. **Applies to:** Execution Phases 0–8; setup begins in [Phase 0](Kwartracker-PRD-SRS-v1_11-Execution-Phases.md#phase-0--foundation-guardrails-and-de-risking-spikes-l). **Owner:** Engineering Lead; QA Lead verifies BUILD-VER-01. **Updated:** 2026-10-31.

This workflow adopts the EAS cloud path from the supplied [Expo Android Development Build Guide](../documentation_guides/expo-android-development-build-guide.docx). It produces Android APKs for private development and testing. No Google Play upload on any track, App Store/TestFlight delivery, EAS Submit/auto-submit, OTA publication, hosting deployment or production environment is part of this work. No cloud build or dependency change was executed while preparing these documentation revisions.

**Current policy amendment — 2026-11-03:** The user directed one existing development-client APK for every phase and made native changes optional. [Execution-plan Section 3.6](Kwartracker-PRD-SRS-v1_11-Execution-Phases.md#36-one-development-client-apk-and-optional-native-changes--all-phases) is the shared authority; PRD Section 16 amends acceptance. Reuse build `ca81554a-6ca5-4990-9297-15d50d679532` on james with local Metro for compatible changes. Older setup, dual-variant, standalone and rebuild procedures below are historical/future reference, **not current mandatory actions or build authorization**. Existing profiles/artifacts are preserved; no replacement dev-client, probe, validation or final APK is planned. Native-dependent features absent from the binary and standalone/release-only assertions are optional/deferred, not passed. This policy update changes documentation only.

## 1. Source and precedence

**Active installation rule — 2026-11-04 (james only):** Keep the pinned development client (same SHA-256) in the Owner profile of MuMu james; it is the only emulator and install target for every phase. Test profiles and other emulators are not used; synthetic-data checks follow the snapshot/restore procedure in plan Section 3.6. Do not create validation/probe installs, app clones or numbered launcher copies without explicit user permission. Compatible code changes use Metro; missing native capabilities remain optional/deferred. The older multi-variant setup below is historical/future reference only. Cleanup and any pending deletion approval are recorded in [plan Section3.6](Kwartracker-PRD-SRS-v1_11-Execution-Phases.md#36-one-development-client-apk-and-optional-native-changes--all-phases); historical EAS records are retained.

Read the full Word guide for its explanations and troubleshooting. Its SHA-256 at incorporation is `247cc211a1c5bdfe9727e41bc36b43f3d821811580fa28bae5d71607aca036be`. It contains both local native compilation (Step 5A) and EAS cloud compilation (Step 5B); only Step 5B is adopted. Its sample C:\Projects path and My App identifiers are examples, not Kwartracker configuration. Existing repository configuration and this build-only contract take precedence.

| Guide content | Kwartracker application | Verification |
|---|---|---|
| Step 1 open/create project | Open existing G:\codebase\kwartracker; npm/package-lock.json; no scaffold replacement | TC-120 repository/version record |
| Step 2 development client | Expo installer selects the installed SDK 57-compatible expo-dev-client | TC-120 package/lock evidence |
| Step 3 identity | Preserve name/slug/assets/plugins and base identity; explicitly select and record development/validation application identities | TC-120 config/project audit |
| Step 4 / Step 5B | EAS account/project linking, cloud APK build and private installation | BUILD-VER-01 build/install evidence |
| Step 5A | Local compiler/native-build route not used | Guardrail review |
| Steps 6–8 | Start Metro development-client mode; use current QR/URL; daily Fast Refresh | TC-120 installed dev-client result |
| Step 9 | Network/firewall/cache/module troubleshooting; rebuild native changes via EAS | TC-120 procedure review |
| Added validation workflow | Separate bundled-JS internal APK for offline/performance/native acceptance | TC-121; no production deployment |

The guide was read as text, tables and hyperlinks; this revision does not assess or modify its Word page layout. No new Word document is produced.

## 2. Tooling prerequisites and identity

Execute commands only when implementing Phase 0; they are instructions, not evidence of completed work. Use Windows PowerShell, the project's npm/lockfile, a supported Node version, an Expo account with access to the intended EAS project, internet for cloud compilation/download, and an Android phone allowing installation from the chosen browser. Android Studio/JDK/native compiler are not needed for EAS cloud compilation onto a phone; an emulator is optional and requires its own installed emulator tooling.

```powershell
Set-Location 'G:\codebase\kwartracker'
npm ci
npx expo install expo-dev-client
npx expo install --check
npx expo-doctor
npx eas-cli@latest --version
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build:configure --platform android
```

Record actual resolved Expo/React Native/CLI versions and the lockfile hash. Read effective app config before accepting account/project/signing prompts; link the intended existing project instead of creating a duplicate. Record real project ID and app identifiers; no existing registration is invented. The current app's name/slug/scheme are kwartracker; merge native settings without replacing plugins or assets.

Use clearly named development and validation variants with distinct Android package IDs and development-link schemes, derived from a developer-selected base identifier and recorded in BUILD-VER-01. Configure the effective app.config to select the variant from APP_VARIANT; preserve source identity fields for the base app. This permits both APKs to coexist despite signing/build differences and prevents installing a debug APK over the validation sandbox. Never uninstall a data-bearing app just to resolve a signing conflict. Test with synthetic data and use explicit v6 backup/restore when a test needs data transferred between variants. No Play registration is required to choose an Android application ID.

EAS project credentials/signing prompts concern APK compilation and installation; they do not grant submission authority. Record signing certificate fingerprint/reference privately, never private keystore material or tokens. Restrict internal APK/download access to intended testers; an install URL is not a public-release channel and should not appear in telemetry or public source.

## 3. Approved EAS profiles

Apply the [documented profile example](contracts/eas-build-profiles.example.json) to the real eas.json during Phase 0; this example alone does not configure the project. Both profiles explicitly select EAS environment development. The APP_VARIANT value must be consumed by effective app configuration to produce the recorded distinct package IDs/schemes; an unused environment variable is not variant configuration.

| Profile | developmentClient | distribution | Android artifact | Use |
|---|---|---|---|---|
| development | true | internal | APK | Native development launcher + Metro/Fast Refresh |
| validation | false | internal | APK | Bundled JavaScript, standalone internal tests; no developer launcher/debug menu |

Review what build:configure generated before the first build. Keep only these current profiles; remove generated production/submit entries. Inspect profile inheritance, package lifecycle hooks, EAS workflow files and other CI actions for hidden publication steps. No submit block, auto-submit option, production environment/profile, Google service-account upload credential, Play/Apple track, EAS Update channel/publication or hosting job is allowed. EAS Update delivery remains disabled in effective native configuration; a development launcher may use local Metro but no published OTA endpoint is configured for acceptance. If expo-updates is present, record its effective disabled configuration and verify that the validation APK cold-starts its embedded bundle.

Cloud build uses a source archive. Inspect .gitignore/.easignore and actual archive inclusion rules; exclude real SQLite/WAL/SHM files, user backup/PDF exports, secrets, private keys, logs, telemetry queues and recovery artifacts. Use synthetic fixture data only. An ignored .env is not assumed to exist in EAS; configure only necessary nonproduction build variables in the selected EAS development environment, and never put secrets in EXPO_PUBLIC variables. Both build variants retain runtime finance privacy rules.

## 4. EAS development APK and daily work

```powershell
Set-Location 'G:\codebase\kwartracker'
npx eas-cli@latest build --platform android --profile development
```

Wait for successful cloud completion; record EAS build ID/URL privately, source revision and APK SHA-256. Download/install the resulting APK from the private EAS installation link. Enable the browser's install permission only as needed. On an already-running optional Android emulator, installing that same cloud-built APK is allowed; local compilation is not required.

Start Metro separately:

```powershell
Set-Location 'G:\codebase\kwartracker'
$env:APP_VARIANT = 'development'
npx expo start --dev-client --lan
```

Confirm the terminal targets a development build. Connect phone/computer to the same private network and open the current terminal-generated QR/URL in the matching development APK. Do not hardcode the guide's sample IP/port/exp+ scheme. Leave Metro running for development. On later days, start Metro and reconnect; ordinary JS/screen edits use Fast Refresh.

Native changes would normally require rebuilding; a missing native module cannot arrive through Fast Refresh. Under the current one-client policy, make those changes and dependent unavailable features optional/deferred instead of rebuilding. Implement only compatible changes through Metro, preserve financial/security guarantees and isolate unavailable native imports before exercising a path. No APK/SDK/permissions/config-plugin change is implied by a phase boundary. Full standalone NFR-01 proof is deferred; local data operations can still be tested without a financial network service while Metro uses the development connection.

## 5. Standalone internal validation APK

**Optional / Deferred for the current milestone, including Phase 8.** The procedure below is retained solely for a separately authorized future standalone-validation scope. Do not execute it or use its absence to block current compatible phase work. Dev-client observations do not establish release/offline-startup certification.

```powershell
Set-Location 'G:\codebase\kwartracker'
npx eas-cli@latest build --platform android --profile validation
```

This is a second internal EAS Build, not a public/production deployment. Verify the effective validation variant identity, developmentClient=false, bundled JavaScript, release-mode compilation/Hermes, actual optimization/minification/debug flags and disabled OTA/network crash capture until opt-in. EAS labels alone do not prove these properties. Keep its package separate from development and record its APK hash/build ID/device install.

Stop Metro and remote debugging, enable airplane mode with Wi-Fi/mobile data disabled, then cold-launch the validation APK. In Phase 0 verify the gated shell; as features arrive rerun TC-81 and the specific money/recurrence/restore/notification/security/performance cases. Run final PERF-01/UI-PERF-01, native recovery and payload inspections on this standalone internal APK. Development-client timings or a Metro-dependent launch cannot substitute. Preserve all existing numerical quality targets; exclude iOS-specific evidence only as explicitly Deferred by PRD Section 16.

## 6. Troubleshooting and safe rebuilds

| Symptom | Action |
|---|---|
| QR cannot open the app | Verify matching development variant APK is installed; use the current terminal QR/URL and correct scheme |
| Phone cannot reach Metro | Check shared private network, actual IP/port and Windows private-network firewall allowance for Node; do not disable the firewall broadly |
| Network blocks LAN | Optional `npx expo start --dev-client --tunnel` with APP_VARIANT=development; install tunnel support only when needed and acknowledge the tunneled dev traffic. Keep real financial data out of remote debugging/tunnel sessions |
| Stale JS state | `npx expo start --dev-client --clear` with APP_VARIANT=development; do not clear the installed app's financial data as a cache fix |
| Native module missing | Rebuild development APK via EAS; changing JavaScript alone cannot add native code |
| APK signing/package conflict | Check package and certificate; use the separate documented variant identity. Preserve any data-bearing install; do not silently uninstall it |
| Validation APK requests Metro or crashes offline | Fail TC-121; inspect profile, embedded bundle, dev/OTA configuration and effective runtime flags, then rebuild through EAS |

## 7. Phase 0 acceptance evidence

BUILD-VER-01 must contain source-guide hash, source commit/dirty-state evidence, effective config/profile digests, npm lock hash, resolved SDK/CLI versions, actual EAS project and both variant IDs, cloud build IDs, private artifact references, APK hashes, certificate fingerprints (no private keys), OS/device identifiers, install/launch results, and separate development-Metro versus standalone-offline results. If source was not committed, attach the exact source archive/hash used by EAS; never claim an unrelated commit built the APK.

TC-120 static checks run before any cloud job; its build/install/Metro assertions require actual results. TC-121 Phase 0 evidence covers the available shell; later feature checks are not marked PASS early. BUILD-VER-01 also records that no production/store/OTA/hosting action was invoked or configured. A complete recipe, passed profile JSON check or queued job alone does not close Phase 0.

## 8. Official verification references

Checked 2026-10-23:

- [SDK 57 DevClient](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/) — installed client capability; use the actual SDK-compatible version.
- [Development builds with EAS](https://docs.expo.dev/develop/development-builds/introduction/?buildenv=build-with-eas) — cloud compilation and prerequisites.
- [EAS profile configuration](https://docs.expo.dev/build/eas-json/) — named profiles and internal distribution; development and preview-style builds have distinct tooling behavior.
- [Android APK builds](https://docs.expo.dev/build-reference/apk/) — installable APK configuration and installation.
- [Using development builds](https://docs.expo.dev/develop/development-builds/use-development-builds/) — Metro, QR/device opening and native rebuild distinction.
- [App variants](https://docs.expo.dev/build-reference/variants/) — distinct package/scheme identities selected by build configuration.
- [EAS environment variables](https://docs.expo.dev/eas/environment-variables/) — explicit selected environment and cloud/local variable handling.

Framework documentation establishes supported setup, not proof that Kwartracker is configured or that any build has passed. EAS cloud build limits/account availability may affect execution; record the actual result rather than promising a quota, price or build duration.

## 9. Build budget for all execution phases

**Current Phases 0–8 budget: zero new APK submissions.** Reuse the one recorded existing development client and serve compatible changes through local Metro. A phase boundary, optional native feature or Phase 8 final review does not create a build requirement. No routine account/quota lookup or capacity reservation is needed when no build is planned. Preserve historical quota/artifact records without treating old balances/reset predictions as current facts. This supersedes the earlier mandatory standalone-candidate budget.

| Change or check | Reuse or build decision |
|---|---|
| Compatible JavaScript, screens, domain logic or SQL changes | Use the same installed development client and Metro; record APK identity and served-source hashes. No new APK. |
| Added/changed native dependency, SDK, native implementation, config plugin or compiled configuration | Optional/deferred, including dependent features absent from the client; do not schedule a rebuild. Keep unavailable modules out of active paths and preserve safety. |
| Standalone offline, release-performance or unavailable native acceptance | Optional/deferred under the approved scope. Run supported functional/development observations with truthful labels; no standalone or release PASS inferred. |
| More emulator profiles, appearances, fixture cases or testers | Reuse the same compatible APK across these runs; no build per device or test case. |
| Phase 8 final review | Same client and final served-source identity; compatible regression checks plus an explicit optional/deferred report. No final APK exception. |

**Future build only after a new explicit scope change.** If the user later authorizes changing/replacing the pinned client or a standalone build, first record actual account capacity/reset/pending jobs, reviewed source/native compatibility and the intended build count/reserve. Do not submit merely to discover capacity, assume failed jobs are free, enable a paid upgrade or reinstate per-phase builds automatically. No such authorization is supplied by the current amendment.

Record zero planned development/native-probe/standalone-validation submissions in the context index for this scope. Do not preinstall speculative dependencies to prepare a replacement client. Historical APKs stay archived and are not additional active clients or evidence for the current served source.

**Conditional submission checklist (future scope only).** After explicit authorization, review source/API, lint/typecheck/affected tests, dependencies/configuration, archive exclusions, native compatibility and quota; reuse unchanged matching evidence. These checks are not permission to upload and do not prove native compilation. Current phase work uses no source archive submission.

**Artifact and quota ledger.** Keep one shared ledger in [the context index](execution-context/index.json), linking detailed evidence rather than copying it into every phase. For each actual attempt record date/phase/reason, observed capacity and reserve, source-archive/lock/config identities, profile/package, build ID/status (or refusal without a job), APK hash, native module compatibility, bundled-JavaScript identity, accounting impact when known, checks covered and reuse limits. Never store signed download URLs, credentials or financial data there. Existing build evidence remains historical; this policy does not imply a newly verified balance.

**No build/testing loop.** Continue compatible authorized work on the existing client; optional native/standalone evidence does not block phase progression. Keep actual compatible failures visible and fix their causes before a scoped retry. Reuse passing tests for unchanged dependencies; never restart successful checks or submit unchanged builds solely because a new phase starts. No automatic EAS/OTA/paid/local-native workaround is allowed. A future explicitly authorized build follows the bounded-attempt policy and records any failure once before a diagnosed correction.

The original budget policy was added on 2026-10-31; the user superseded its planned-build requirement on 2026-11-03 with the one-existing-client/optional-native scope. Expo's [development-build guidance](https://docs.expo.dev/develop/development-builds/use-development-builds/) confirms compatible JavaScript reuse and the native-code rebuild distinction. Under this scope, defer missing native capability rather than rebuild. No cloud job or billing change occurred.
