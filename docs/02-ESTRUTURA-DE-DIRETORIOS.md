# 02 — Árvore de Diretórios

Status: **Entrega 1 — planejamento**. Nada disto foi criado ainda.

Legenda: `[MVP]` entra na primeira versão funcional · `[1.0]` versão 1.0 · `[FUT]` futuro.

```
eloBoost/
├── README.md
├── ARCHITECTURE.md                  → aponta para docs/01
├── SECURITY.md
├── PRIVACY.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json                    → strict, noUncheckedIndexedAccess, noImplicitAny
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── eslint.config.js
├── .prettierrc
├── playwright.config.ts             [1.0]
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                   → tsc + eslint + vitest + cargo fmt/clippy/test
│   │   └── release.yml              [1.0] → build NSIS/MSI + assinatura
│   └── pull_request_template.md
│
├── docs/
│   ├── 00-DECISAO-TECNICA.md
│   ├── 01-ARQUITETURA.md
│   ├── 02-ESTRUTURA-DE-DIRETORIOS.md
│   ├── 03-MODELO-DE-DADOS.md
│   ├── 04-CONTRATOS-IPC.md
│   ├── 05-PLANO-DE-SEGURANCA.md
│   ├── 06-PERMISSOES-ADMINISTRATIVAS.md
│   ├── 07-BACKUP-E-REVERSAO.md
│   ├── 08-WIREFRAMES.md
│   ├── 09-BACKLOG-E-ROADMAP.md
│   ├── 10-RISCOS.md
│   ├── guides/                      [1.0]
│   │   ├── desenvolvimento.md
│   │   ├── build.md
│   │   ├── testes.md
│   │   ├── instalador.md
│   │   ├── publicacao.md
│   │   └── permissoes-necessarias.md
│   └── commands/                    [1.0] → referência de cada comando Tauri
│
├── src/                                              # Frontend
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   ├── providers.tsx            → Theme, Toast, Motion, ErrorBoundary, i18n
│   │   └── bootstrap.ts             → hidratação de settings, first-run check
│   ├── layouts/
│   │   ├── AppLayout.tsx            → Sidebar + Header + Outlet
│   │   └── OnboardingLayout.tsx
│   ├── pages/
│   │   ├── dashboard/DashboardPage.tsx            [MVP]
│   │   ├── cleanup/CleanupPage.tsx                [MVP]
│   │   ├── optimizations/OptimizationsPage.tsx    [1.0]
│   │   ├── startup/StartupPage.tsx                [1.0]
│   │   ├── apps/InstalledAppsPage.tsx             [1.0]
│   │   ├── processes/ProcessesPage.tsx            [1.0]
│   │   ├── storage/StoragePage.tsx                [1.0]
│   │   ├── monitoring/MonitoringPage.tsx          [1.0]
│   │   ├── restore/RestorePage.tsx                [MVP]
│   │   ├── history/HistoryPage.tsx                [MVP]
│   │   ├── settings/SettingsPage.tsx              [MVP]
│   │   ├── about/AboutPage.tsx                    [MVP]
│   │   ├── gaming/GamingProfilePage.tsx           [FUT]
│   │   ├── lab/LabPage.tsx                        [FUT] "Laboratório — Recursos experimentais"
│   │   └── onboarding/                            [MVP]
│   │       ├── WelcomeStep.tsx
│   │       ├── SafetyNoticeStep.tsx
│   │       ├── PreferencesStep.tsx
│   │       └── FirstScanStep.tsx
│   ├── components/
│   │   ├── layout/{Sidebar,Header,PageHeader,NavItem}.tsx
│   │   ├── ui/{Button,Card,Toggle,Tooltip,Toast,Modal,Badge,Skeleton,
│   │   │        SearchInput,FilterDropdown,ProgressBar,Checkbox,Tabs}.tsx
│   │   ├── feedback/{EmptyState,ErrorState,LoadingState,ConfirmationModal,
│   │   │             ProgressModal,PermissionDialog,RestorePointDialog}.tsx
│   │   ├── domain/{StatCard,SystemInfoCard,HealthGauge,OptimizationCard,
│   │   │           CleanupCategoryCard,RiskBadge,ActivityTable,ProcessTable,
│   │   │           StartupItemRow,AppListItem}.tsx
│   │   └── charts/{StorageChart,ResourceChart,Sparkline}.tsx
│   ├── hooks/
│   │   ├── useSystemInfo.ts  useCleanupScan.ts  useMonitorStream.ts
│   │   ├── useTauriEvent.ts  useConfirm.ts  useToast.ts
│   │   └── useReducedMotion.ts  useKeyboardNav.ts
│   ├── services/                    → ÚNICA camada que chama invoke()
│   │   ├── ipc.ts                   → wrapper genérico: invoke + Zod + mapeamento de erro
│   │   ├── systemService.ts  cleanupService.ts  storageService.ts
│   │   ├── startupService.ts  processService.ts  optimizationService.ts
│   │   ├── backupService.ts  activityService.ts  settingsService.ts
│   ├── stores/
│   │   └── {systemStore,cleanupStore,monitoringStore,optimizationStore,
│   │        settingsStore,uiStore}.ts
│   ├── types/                       → espelham 1:1 os structs Rust
│   │   └── {system,cleanup,storage,startup,process,optimization,
│   │        backup,activity,settings,errors}.ts
│   ├── schemas/                     → validadores Zod (fonte da verdade em runtime)
│   ├── utils/
│   │   └── {formatBytes,formatDate,classNames,sort,risk,a11y}.ts
│   ├── constants/
│   │   └── {routes,riskLevels,categories,theme}.ts
│   ├── i18n/
│   │   └── {pt-BR.json,en-US.json}
│   ├── styles/
│   │   ├── globals.css
│   │   └── theme.css                → tokens CSS do design system
│   └── assets/
│       ├── logo/                    → identidade PRÓPRIA do BoostCore
│       └── illustrations/
│
├── src-tauri/                                        # Backend Rust
│   ├── Cargo.toml
│   ├── build.rs
│   ├── tauri.conf.json              → CSP restritiva, capabilities, updater, bundle
│   ├── capabilities/
│   │   └── default.json             → permissões mínimas; SEM fs/shell para o frontend
│   ├── icons/
│   ├── migrations/
│   │   ├── 0001_init.sql
│   │   ├── 0002_optimization_catalog.sql
│   │   └── ...
│   ├── resources/
│   │   ├── protected_paths.toml     → lista de diretórios proibidos
│   │   ├── protected_processes.toml → processos críticos
│   │   ├── protected_startup.toml   → itens de startup essenciais
│   │   └── optimizations.toml       → catálogo declarativo de ajustes
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── state.rs                 → AppState (pool SQLite, locks, config)
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── system.rs  cleanup.rs  storage.rs  startup.rs
│       │   ├── process.rs  optimization.rs  backup.rs  restore.rs
│       │   ├── apps.rs  activity.rs  settings.rs  permission.rs
│       ├── services/                → um arquivo por serviço da §4 de docs/01
│       ├── cleaners/
│       │   ├── mod.rs               → trait Cleaner { analyze, clean }
│       │   ├── user_temp.rs  windows_temp.rs  thumbnails.rs
│       │   ├── explorer_cache.rs  windows_logs.rs  error_reports.rs
│       │   ├── update_cache.rs  recycle_bin.rs  shader_cache.rs
│       │   ├── memory_dumps.rs  old_installers.rs  downloads_hint.rs
│       │   └── browsers/
│       │       ├── mod.rs           → trait BrowserProfileLocator
│       │       ├── chromium.rs      → Chrome, Edge, Brave, Opera, Opera GX
│       │       └── firefox.rs
│       ├── optimizations/
│       │   ├── mod.rs               → trait Optimization { read, apply, revert, verify }
│       │   ├── catalog.rs           → carrega optimizations.toml
│       │   ├── power.rs  visual.rs  gaming.rs  privacy.rs
│       │   ├── network.rs  storage.rs  startup.rs
│       │   └── lab/                 [FUT] experimentais, desabilitados por padrão
│       ├── monitoring/
│       │   ├── sampler.rs  pdh.rs  gpu.rs  network.rs  sensors.rs
│       │   └── ring_buffer.rs
│       ├── backup/
│       │   ├── snapshot_service.rs  restore_point.rs  export.rs
│       ├── security/
│       │   ├── path_guard.rs        → allowlist, canonicalização, anti-traversal
│       │   ├── protected.rs         → listas protegidas
│       │   ├── elevation.rs         → negociação com o Elevator
│       │   ├── signature.rs         → WinTrust / Authenticode
│       │   ├── confirmation.rs      → tokens de confirmação
│       │   └── redact.rs            → mascaramento de dados sensíveis em logs
│       ├── system/
│       │   ├── mod.rs  paths.rs     → trait SystemPaths (injetável para testes)
│       │   ├── os_info.rs  cpu.rs  gpu.rs  memory.rs  disks.rs
│       │   ├── registry.rs          → trait RegistryBackend + real + in-memory
│       │   ├── processes.rs  tasks.rs  wmi.rs  ffi.rs   ← único módulo com `unsafe`
│       ├── repositories/
│       │   ├── mod.rs  db.rs  migrations.rs
│       │   └── {settings,cleanup,optimization,backup,activity,startup}_repo.rs
│       ├── models/                  → structs serde espelhando docs/04
│       ├── errors/
│       │   └── mod.rs               → AppError + ErrorCode + serialização estável
│       ├── logging/
│       │   └── mod.rs               → tracing + rotação + redaction
│       └── tests/                   → testes de integração (tempdir isolado)
│
├── src-elevator/                                     # Broker elevado (binário separado)
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs                  → manifest requireAdministrator
│       ├── protocol.rs              → enum FECHADO de operações
│       ├── pipe.rs                  → named pipe + ACL + verificação do chamador
│       └── ops/{registry,restore_point,service,task,power}.rs
│
├── crates/
│   └── boostcore-core/              → tipos e validações compartilhados entre app e elevator
│
└── tests/
    ├── e2e/                         [1.0] Playwright
    └── fixtures/                    → árvores de arquivos falsas para testes
```

## Notas sobre a árvore

1. **`src-elevator` é um crate separado**, não um módulo — isso garante que código sem
   necessidade de privilégio não possa acidentalmente rodar elevado, e permite auditar o binário
   privilegiado isoladamente (ele será pequeno: estimativa < 1500 linhas).
2. **`crates/boostcore-core`** contém as validações de caminho e os tipos de operação, para que a
   revalidação do lado elevado use exatamente o mesmo código testado — sem divergência.
3. **`system/ffi.rs` concentra todo `unsafe`.** O restante do crate declara
   `#![forbid(unsafe_code)]` por módulo onde possível; a revisão de segurança foca em um arquivo.
4. **`resources/*.toml` são dados versionados**, o que permite revisar mudanças de política
   (ex.: "adicionamos um caminho à allowlist") como diff legível em PR.
5. A pasta `pages/` segue a lista do requisito 4 (16 telas + modais); modais moram em
   `components/feedback/` porque são reutilizados por várias páginas.
