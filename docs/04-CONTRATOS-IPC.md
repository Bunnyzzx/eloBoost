# 04 — Contratos entre Frontend e Backend

Status: **Entrega 1 — planejamento**. Os trechos abaixo são a especificação do contrato; ainda
não existem no repositório.

Princípios:
- **Um comando por operação.** Não existe comando genérico. Nunca existirá
  `execute_shell_command`.
- Nomes em `snake_case` no Rust; `serde(rename_all = "camelCase")` para o payload; tipos TS em
  `camelCase`.
- Toda resposta atravessa `Result<T, AppError>`. O frontend nunca recebe `undefined` silencioso.
- Todo tipo TS tem um **schema Zod** correspondente; `services/ipc.ts` valida a resposta antes de
  entregá-la. Divergência de contrato vira erro explícito, não `undefined` propagado.

---

## 1. Catálogo de comandos

### Sistema e saúde
| Comando | Entrada | Saída | Admin |
|---|---|---|---|
| `system_get_info` | — | `SystemInfo` | não |
| `system_get_health` | `{ refresh: bool }` | `HealthReport` | não |
| `system_analyze` | `{ deep: bool }` | `AnalysisResult` | não |

### Limpeza
| Comando | Entrada | Saída | Admin |
|---|---|---|---|
| `cleanup_list_categories` | — | `CleanupCategoryInfo[]` | não |
| `cleanup_scan` | `CleanupScanRequest` | `CleanupScanResult` | não* |
| `cleanup_get_items` | `{ scanId, category, page, pageSize }` | `Paged<CleanupItem>` | não |
| `cleanup_prepare` | `{ scanId, selectedItemIds \| selectedCategories, dryRun }` | `CleanupPlan` | não |
| `cleanup_execute` | `{ planId, confirmationToken }` | `CleanupExecutionResult` | depende |
| `cleanup_cancel` | `{ operationId }` | `()` | não |

\* categorias de sistema (`windows_temp`, `windows_logs`, `memory_dumps`) leem áreas que podem
exigir elevação; o scan reporta `partiallyAccessible: true` em vez de falhar.

### Navegadores
| Comando | Entrada | Saída |
|---|---|---|
| `browsers_detect` | — | `DetectedBrowser[]` |
| `browsers_check_running` | `{ browserIds }` | `BrowserRunningStatus[]` |

### Armazenamento
| Comando | Entrada | Saída |
|---|---|---|
| `storage_list_volumes` | — | `VolumeInfo[]` |
| `storage_analyze` | `{ volumeId, mode: "quick" \| "deep" }` | `StorageAnalysis` |
| `storage_find_duplicates` | `{ roots, minSize, mode }` | `DuplicateGroup[]` |
| `storage_reveal_in_explorer` | `{ itemId }` | `()` |

### Inicialização
| Comando | Entrada | Saída | Admin |
|---|---|---|---|
| `startup_list_items` | `{ includeServices: bool }` | `StartupItem[]` | não / sim p/ serviços |
| `startup_toggle_item` | `{ itemId, enabled, confirmationToken? }` | `StartupToggleResult` | depende do escopo |
| `startup_reveal_location` | `{ itemId }` | `()` | não |

### Aplicativos
| Comando | Entrada | Saída |
|---|---|---|
| `apps_list_installed` | `{ includeSystemComponents: bool }` | `InstalledApp[]` |
| `apps_uninstall` | `{ appId }` | `UninstallLaunchResult` |
| `apps_repair` | `{ appId }` | `UninstallLaunchResult` |
| `apps_reveal_location` | `{ appId }` | `()` |

> `apps_uninstall` **lança o desinstalador oficial registrado** (`UninstallString` /
> `PackageManager.RemovePackageAsync`) e devolve o resultado do lançamento. O BoostCore nunca
> apaga a pasta de um aplicativo.

### Processos
| Comando | Entrada | Saída | Admin |
|---|---|---|---|
| `process_list` | `{ includeSystem: bool }` | `ProcessInfo[]` | não |
| `process_get_details` | `{ pid, startTime }` | `ProcessDetails` | não |
| `process_terminate` | `{ pid, startTime, confirmationToken }` | `TerminateResult` | depende |
| `process_terminate_tree` | `{ pid, startTime, confirmationToken }` | `TerminateResult` | depende |

> `startTime` acompanha o `pid` em **todas** as operações: PIDs são reciclados pelo Windows, e sem
> esse par o app poderia encerrar um processo diferente do exibido. Divergência ⇒ erro
> `ProcessIdentityMismatch`.

### Otimizações
| Comando | Entrada | Saída |
|---|---|---|
| `optimization_list` | `{ category?, includeExperimental: bool }` | `OptimizationEntry[]` |
| `optimization_read_state` | `{ codes }` | `OptimizationState[]` |
| `optimization_apply` | `{ code, confirmationToken }` | `OptimizationApplyResult` |
| `optimization_revert` | `{ historyId }` | `OptimizationApplyResult` |

### Backup e restauração
| Comando | Entrada | Saída | Admin |
|---|---|---|---|
| `backup_list` | `{ types?, limit, offset }` | `Paged<BackupEntry>` | não |
| `backup_create_snapshot` | `{ kind, description }` | `BackupEntry` | não |
| `backup_restore` | `{ backupId, confirmationToken }` | `RestoreResult` | depende |
| `backup_delete` | `{ backupId }` | `()` | não |
| `backup_export_report` | `{ backupId, targetPath }` | `{ path }` | não |
| `restore_point_list` | — | `RestorePoint[]` | não |
| `restore_point_create` | `{ description }` | `RestorePoint` | **sim** |

> Restaurar um ponto de restauração do Windows **não** é feito silenciosamente: o app abre a
> interface oficial `rstrui.exe` com o ponto selecionado. Reverter o sistema é uma decisão que
> merece a tela nativa do Windows, com seus próprios avisos.

### Histórico, configurações, permissões
| Comando | Entrada | Saída |
|---|---|---|
| `activity_list` | `{ filters, limit, offset }` | `Paged<ActivityEntry>` |
| `activity_get_details` | `{ id }` | `ActivityDetails` |
| `activity_undo` | `{ id, confirmationToken }` | `UndoResult` |
| `settings_get_all` | — | `AppSettings` |
| `settings_update` | `Partial<AppSettings>` | `AppSettings` |
| `settings_reset` | `{ confirmationToken }` | `AppSettings` |
| `settings_wipe_local_data` | `{ confirmationToken }` | `()` |
| `permission_get_status` | — | `PermissionStatus` |
| `permission_request_elevation` | `{ operationId, reason }` | `ElevationResult` |

---

## 2. Tipos TypeScript

```ts
// ─────────────────────────── comuns
export type RiskLevel = "low" | "medium" | "high";
export type OperationId = string;   // UUIDv7

export interface Paged<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
}

// ─────────────────────────── limpeza
export type CleanupCategory =
  | "user_temp"
  | "windows_temp"
  | "thumbnails"
  | "explorer_cache"
  | "windows_logs"
  | "error_reports"
  | "update_cache"
  | "recycle_bin"
  | "browser_cache"
  | "shader_cache"
  | "app_temp"
  | "memory_dumps"
  | "old_installers"
  | "downloads_old";

export interface CleanupCategoryInfo {
  category: CleanupCategory;
  name: string;
  description: string;
  paths: string[];               // caminhos que SERÃO analisados — transparência total
  riskLevel: RiskLevel;
  recommendation: "recommended" | "optional" | "manual_review";
  selectedByDefault: boolean;    // false para downloads_old, memory_dumps, cookies…
  requiresAdmin: boolean;
  warnings: string[];
  available: boolean;            // false quando a categoria não se aplica ao sistema
  unavailableReason?: string;
}

export interface CleanupScanRequest {
  categories: CleanupCategory[];
  includeDetails: boolean;
  browserSelections?: BrowserDataSelection[];
}

export interface CleanupItem {
  id: string;
  category: CleanupCategory;
  path: string;
  size: number;                  // bytes
  lastModified: string;          // ISO-8601
  riskLevel: RiskLevel;
  selected: boolean;
  locked: boolean;               // arquivo em uso detectado na análise
  isSymlink: boolean;
}

export interface CleanupScanResult {
  scanId: string;
  operationId: OperationId;
  totals: Record<CleanupCategory, { files: number; size: number }>;
  totalFiles: number;
  totalSize: number;
  warnings: string[];
  partiallyAccessible: boolean;
  inaccessiblePaths: number;
  durationMs: number;
  items?: CleanupItem[];         // só quando includeDetails = true (limitado por página)
}

export interface CleanupPlan {
  planId: string;
  confirmationToken: string;     // uso único, TTL 5 min
  expiresAt: string;
  categories: CleanupCategory[];
  totalFiles: number;
  estimatedBytes: number;
  warnings: string[];
  irreversibleCategories: CleanupCategory[];
  dryRun: boolean;
}

export interface CleanupExecutionResult {
  operationId: OperationId;
  planId: string;
  dryRun: boolean;
  removedFiles: number;
  releasedBytes: number;
  skippedFiles: number;
  errors: OperationError[];
  cancelled: boolean;
  durationMs: number;
  perCategory: Array<{
    category: CleanupCategory;
    removedFiles: number;
    releasedBytes: number;
    skippedFiles: number;
  }>;
}

// ─────────────────────────── navegadores
export type BrowserId = "chrome" | "edge" | "firefox" | "opera" | "opera_gx" | "brave";
export type BrowserDataKind =
  | "cache" | "cookies" | "history" | "sessions" | "form_data";

export interface DetectedBrowser {
  id: BrowserId;
  name: string;
  installPath: string;
  profiles: Array<{ id: string; name: string; path: string }>;
  running: boolean;
  availableData: BrowserDataKind[];
}

export interface BrowserDataSelection {
  browserId: BrowserId;
  profileIds: string[];
  kinds: BrowserDataKind[];      // padrão: apenas ["cache"]
  onRunning: "cancel" | "skip";  // NUNCA "force_close" sem autorização explícita
}
```

```ts
// ─────────────────────────── sistema
export interface SystemInfo {
  computerName: string;
  userName: string;
  os: { name: string; edition: string; version: string; build: number; architecture: string };
  cpu: { name: string; cores: number; logicalProcessors: number; baseClockMhz: number | null };
  gpus: Array<{ name: string; vramBytes: number | null; driverVersion: string | null }>;
  memory: { totalBytes: number; availableBytes: number; modules: number | null };
  disks: Array<{
    id: string; letter: string | null; label: string | null;
    mediaType: "ssd" | "hdd" | "unknown"; totalBytes: number; freeBytes: number;
    fileSystem: string; isSystem: boolean;
  }>;
  uptimeSeconds: number;
  collectedAt: string;
}

export interface HealthFactor {
  code: string;                  // ex.: "disk_free_ratio"
  label: string;
  weight: number;                // 0..1, soma = 1
  observedValue: string;         // valor REAL observado, exibido ao usuário
  score: number;                 // 0..100
  status: "good" | "attention" | "critical" | "unknown";
  explanation: string;           // por que essa pontuação
}

export interface HealthReport {
  score: number;                 // 0..100 — média ponderada dos fatores conhecidos
  status: "good" | "attention" | "critical";
  factors: HealthFactor[];       // critérios TRANSPARENTES, nunca números inventados
  unknownFactors: string[];      // fatores não avaliáveis neste dispositivo
  computedAt: string;
}
```

```ts
// ─────────────────────────── inicialização / processos / apps / otimizações
export interface StartupItem {
  id: string;
  name: string;
  publisher: string | null;
  command: string;
  executablePath: string | null;
  source: "registry_run" | "registry_run_once" | "startup_folder"
        | "scheduled_task" | "service";
  scope: "machine" | "user";
  enabled: boolean;
  impact: "low" | "medium" | "high" | "unknown";
  impactSource: "measured" | "estimated" | "unknown";
  signature: { status: "valid" | "invalid" | "unsigned" | "unknown"; signer: string | null };
  installedAt: string | null;
  isProtected: boolean;          // componente essencial do Windows
  protectionReason?: string;
  requiresAdmin: boolean;
}

export interface ProcessInfo {
  pid: number;
  startTime: string;             // identidade junto com o pid
  name: string;
  cpuPercent: number;
  memoryBytes: number;
  diskBytesPerSec: number | null;
  executablePath: string | null;
  publisher: string | null;
  signature: { status: "valid" | "invalid" | "unsigned" | "unknown"; signer: string | null };
  userName: string | null;
  integrityLevel: "low" | "medium" | "high" | "system" | "unknown";
  threadCount: number;
  isProtected: boolean;
  protectionReason?: string;
}

export interface InstalledApp {
  id: string;
  name: string;
  publisher: string | null;
  version: string | null;
  installDate: string | null;
  estimatedSizeBytes: number | null;
  sizeSource: "registry_estimate" | "measured" | "unknown";
  installLocation: string | null;
  iconDataUrl: string | null;
  kind: "win32" | "msix";
  canUninstall: boolean;
  canRepair: boolean;
  isSystemComponent: boolean;
}

export type OptimizationCategory =
  | "general" | "performance" | "appearance" | "gaming" | "privacy"
  | "network" | "power" | "storage" | "startup" | "lab";

export interface OptimizationEntry {
  code: string;
  name: string;
  description: string;
  category: OptimizationCategory;
  riskLevel: RiskLevel;
  requiresAdmin: boolean;
  requiresRestart: boolean;
  reversible: boolean;
  isExperimental: boolean;
  expectedBenefit: string;
  sideEffects: string[];
  howItWorks: string;
  supported: boolean;
  unsupportedReason?: string;
  currentValue: string | null;
  recommendedValue: string;
  isApplied: boolean;
  appliedHistoryId: string | null;
}
```

```ts
// ─────────────────────────── erros
export type ErrorCode =
  | "PERMISSION_DENIED" | "PATH_NOT_ALLOWED" | "FILE_IN_USE" | "BROWSER_RUNNING"
  | "OPERATION_CANCELLED" | "RESTORE_POINT_FAILED" | "REGISTRY_ACCESS_FAILED"
  | "UNSUPPORTED_SYSTEM" | "INSUFFICIENT_DISK_SPACE" | "INVALID_CONFIGURATION"
  | "BACKUP_FAILED" | "CLEANUP_PARTIALLY_COMPLETED" | "SERVICE_UNAVAILABLE"
  | "CONFIRMATION_REQUIRED" | "CONFIRMATION_EXPIRED" | "PROTECTED_RESOURCE"
  | "PROCESS_IDENTITY_MISMATCH" | "ELEVATION_CANCELLED" | "UNKNOWN";

export interface OperationError {
  code: ErrorCode;
  message: string;         // amigável, em pt-BR, sem jargão
  technicalDetails: string | null;   // visível só no modo avançado / detalhes
  suggestion: string | null;         // "possível solução"
  retryable: boolean;
  diagnosticId: string;              // correlaciona com o log técnico
  context?: Record<string, string>;  // já redigido
}
```

---

## 3. Structs Rust equivalentes (amostra)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CleanupCategory {
    UserTemp, WindowsTemp, Thumbnails, ExplorerCache, WindowsLogs,
    ErrorReports, UpdateCache, RecycleBin, BrowserCache, ShaderCache,
    AppTemp, MemoryDumps, OldInstallers, DownloadsOld,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupItem {
    pub id: String,
    pub category: CleanupCategory,
    pub path: String,
    pub size: u64,
    pub last_modified: Option<String>,
    pub risk_level: RiskLevel,
    pub selected: bool,
    pub locked: bool,
    pub is_symlink: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecutionResult {
    pub operation_id: String,
    pub plan_id: String,
    pub dry_run: bool,
    pub removed_files: u64,
    pub released_bytes: u64,
    pub skipped_files: u64,
    pub errors: Vec<OperationError>,
    pub cancelled: bool,
    pub duration_ms: u64,
    pub per_category: Vec<CategoryOutcome>,
}

#[tauri::command]
pub async fn cleanup_execute(
    state: tauri::State<'_, AppState>,
    plan_id: String,
    confirmation_token: String,
) -> Result<CleanupExecutionResult, AppError> {
    let plan = state.plans.take_valid(&plan_id, &confirmation_token)?; // valida e consome o token
    state.cleanup.execute(plan).await
}
```

```rust
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("permissão negada")]           PermissionDenied { operation: String, needs_admin: bool },
    #[error("caminho não permitido")]      PathNotAllowed  { reason: PathRejection },
    #[error("arquivo em uso")]             FileInUse       { locked_by: Option<String> },
    #[error("navegador em execução")]      BrowserRunning  { browser: BrowserId },
    #[error("operação cancelada")]         OperationCancelled,
    /* … um variante por ErrorCode … */
}

impl serde::Serialize for AppError { /* → OperationError com diagnosticId */ }
```

---

## 4. Regras de validação de entrada

Todo comando valida antes de qualquer efeito colateral:

| Tipo de entrada | Validação |
|---|---|
| Caminhos | **Nunca vêm do frontend.** O frontend envia IDs de itens produzidos pelo backend. As poucas exceções (pasta de exclusão escolhida pelo usuário, destino de exportação) passam por diálogo nativo do SO e por `PathGuard`. |
| IDs | UUID válido + existência no banco/estado. Um ID inexistente é `InvalidConfiguration`, não um no-op. |
| Enums | Desserialização estrita do serde (`deny_unknown_fields`); valor desconhecido = erro. |
| Inteiros | Faixas explícitas (`pageSize` 1..500, `minSize` ≥ 0). |
| Tokens | Uso único, TTL, atrelados ao plano; comparação em tempo constante. |
| PIDs | Sempre acompanhados de `startTime`. |

## 5. Erros — catálogo

| Código | Quando | Mensagem ao usuário (pt-BR) | Sugestão | Retentável |
|---|---|---|---|---|
| `PERMISSION_DENIED` | Falta privilégio | "O Windows negou acesso a este recurso." | "Execute a ação com permissão de administrador." | sim |
| `PATH_NOT_ALLOWED` | Fora da allowlist / traversal / symlink suspeito | "Este local não pode ser modificado pelo BoostCore." | "Isso protege arquivos importantes. Nenhuma ação é necessária." | não |
| `FILE_IN_USE` | Arquivo bloqueado | "Alguns arquivos estão em uso e foram ignorados." | "Feche os programas relacionados e analise novamente." | sim |
| `BROWSER_RUNNING` | Navegador aberto | "O {navegador} está aberto." | "Feche o navegador ou ignore-o nesta limpeza." | sim |
| `OPERATION_CANCELLED` | Usuário cancelou | "Operação cancelada." | — | sim |
| `RESTORE_POINT_FAILED` | `SRSetRestorePoint` falhou | "Não foi possível criar o ponto de restauração." | "Verifique se a Proteção do Sistema está ativada no disco C:." | sim |
| `REGISTRY_ACCESS_FAILED` | Erro no registro | "Não foi possível ler/gravar uma configuração do Windows." | "Tente novamente com permissão de administrador." | sim |
| `UNSUPPORTED_SYSTEM` | Build/edição incompatível | "Este recurso não é compatível com sua versão do Windows." | — | não |
| `INSUFFICIENT_DISK_SPACE` | Sem espaço p/ backup | "Espaço em disco insuficiente para criar o backup." | "Libere espaço e tente novamente." | sim |
| `INVALID_CONFIGURATION` | Estado/entrada inválidos | "Configuração inválida." | "Reabra a tela e tente novamente." | sim |
| `BACKUP_FAILED` | Snapshot falhou | "Não foi possível criar o backup — a alteração foi cancelada." | "A alteração NÃO foi aplicada." | sim |
| `CLEANUP_PARTIALLY_COMPLETED` | Parcial | "A limpeza terminou parcialmente." | "Veja os detalhes para saber o que foi ignorado." | sim |
| `SERVICE_UNAVAILABLE` | Outra operação em curso / WMI indisponível | "Outra operação está em andamento." | "Aguarde a conclusão e tente novamente." | sim |
| `CONFIRMATION_REQUIRED` / `CONFIRMATION_EXPIRED` | Token ausente/expirado | "A confirmação expirou." | "Analise novamente para atualizar os resultados." | sim |
| `PROTECTED_RESOURCE` | Alvo protegido | "Este item é essencial para o Windows e não pode ser alterado aqui." | — | não |
| `PROCESS_IDENTITY_MISMATCH` | PID reciclado | "Este processo não existe mais." | "Atualize a lista." | sim |
| `ELEVATION_CANCELLED` | UAC negado | "Permissão de administrador não concedida." | "A ação não foi executada." | sim |

**Nunca** exibimos stack trace ao usuário comum: `technicalDetails` só aparece atrás de
"Ver detalhes" e no modo avançado; o `diagnosticId` é sempre visível e copiável para suporte.
