# 01 — Arquitetura do BoostCore

Status: **Entrega 1 — planejamento**.

---

## 1. Visão em camadas

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PROCESSO DE UI — BoostCore.exe (integridade média, sem elevação)        │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ WebView2 — React + TypeScript                                      │  │
│  │  pages/ → components/ → hooks/ → stores/ (Zustand)                 │  │
│  │                          │                                         │  │
│  │                    services/ (única camada que fala com o backend) │  │
│  │                          │  invoke<T>() + validação Zod da resposta│  │
│  └──────────────────────────┼─────────────────────────────────────────┘  │
│                             │ IPC do Tauri (comandos nomeados/tipados)   │
│  ┌──────────────────────────▼─────────────────────────────────────────┐  │
│  │ Núcleo Rust                                                        │  │
│  │  commands/    fronteira fina: desserializa, valida, delega         │  │
│  │  security/    PathGuard, ProtectedList, Elevation, Signature       │  │
│  │  services/    regra de negócio (Cleanup, Startup, Optimization…)   │  │
│  │  cleaners/    provedores por categoria de limpeza                  │  │
│  │  optimizations/ catálogo declarativo de ajustes                    │  │
│  │  monitoring/  amostragem de métricas (PDH, WMI, Win32)             │  │
│  │  backup/      snapshots internos + pontos de restauração           │  │
│  │  system/      wrappers Win32/COM (o único lugar com `unsafe`)      │  │
│  │  repositories/ acesso a SQLite (rusqlite)                          │  │
│  │  models/ errors/ logging/                                          │  │
│  └──────────────────────────┬─────────────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │ named pipe \\.\pipe\BoostCore.Elevator.<sid>
                              │ (ACL: só o SID do usuário; JSON tipado)
┌─────────────────────────────▼────────────────────────────────────────────┐
│  BoostCore.Elevator.exe (integridade alta, só durante a operação)        │
│  Catálogo FECHADO de operações privilegiadas + revalidação completa      │
└──────────────────────────────────────────────────────────────────────────┘
```

## 2. Fluxo obrigatório de qualquer ação

O requisito 3 define o pipeline. Ele é materializado assim:

```
1. UI dispara ação                     pages/CleanupPage.tsx
2. service do frontend                 services/cleanupService.ts  → invoke("cleanup_execute", req)
3. comando Tauri                       commands/cleanup.rs          → Request: Deserialize + validate()
4. verificação de permissão            security/permission.rs       → precisa admin? já temos?
5. análise prévia (dry-run interno)    services/cleanup_service.rs  → nada é removido sem plano
6. backup / snapshot                   backup/snapshot_service.rs   → registra estado anterior
7. confirmação do usuário              (a UI já confirmou; o backend exige `confirmation_token`)
8. execução                            cleaners/*.rs
9. validação pós-execução              services/*::verify()
10. registro                           logging/ + repositories/activity_log_repo.rs
11. retorno tipado                     Result<CleanupExecutionResult, AppError> → TS
```

Nenhuma etapa é opcional para operações que escrevem no sistema. Operações somente-leitura
(monitoramento, listagens) pulam 5–7 e 9.

### O `confirmation_token`

Para impedir que um bug de UI (ou XSS hipotético dentro do WebView) execute uma limpeza sem
confirmação, operações destrutivas exigem duas chamadas:

```
cleanup_scan(req)   -> CleanupScanResult { scan_id, ... }
cleanup_prepare(scan_id, selected_item_ids) -> CleanupPlan { plan_id, confirmation_token, totals, warnings }
cleanup_execute(plan_id, confirmation_token) -> CleanupExecutionResult
```

O token é gerado no backend, tem validade curta (5 min), é de uso único e está atrelado ao
conjunto exato de itens do plano. Se a seleção mudar, o token é invalidado. Isso garante que o
backend só apaga aquilo que ele próprio analisou e apresentou.

## 3. Princípios de design

| Princípio | Consequência prática |
|---|---|
| **Frontend é burro sobre o SO** | Nenhum caminho de arquivo, chave de registro ou PID é construído no TypeScript. O frontend só manipula IDs opacos devolvidos pelo backend. |
| **Tudo é reversível ou explicitamente irreversível** | Toda operação declara `reversible: bool`. Se `false` (ex.: esvaziar Lixeira), a UI exibe aviso destacado e o backend exige confirmação reforçada. |
| **Declarativo > imperativo** | O catálogo de otimizações e o catálogo de categorias de limpeza são **dados** (structs/TOML embutido), não `if`s espalhados. Um ajuste novo = uma entrada no catálogo + testes. |
| **Nada silencioso** | Toda ação que toca o sistema gera uma linha em `activity_logs` com `operation_id` correlacionável ao log técnico. |
| **Falha parcial é um resultado, não uma exceção** | `CleanupExecutionResult` carrega `errors[]` e `skippedFiles`. Não existe "deu tudo certo" quando não deu. |
| **Sem `any`** | `tsc --strict` + `noUncheckedIndexedAccess`. Exceções exigem comentário `// eslint-disable-next-line ... — justificativa`. |
| **Menor privilégio** | Elevação por operação; capabilities do Tauri negam FS/shell ao frontend. |

## 4. Módulos de serviço (backend)

| Serviço | Responsabilidade | Precisa admin? | Fonte de dados |
|---|---|---|---|
| `SystemInformationService` | SO, CPU, GPU, RAM, discos, uptime, nome da máquina | Não | `GetSystemInfo`, `RtlGetVersion`, WMI (`Win32_Processor`, `Win32_VideoController`), `GetDiskFreeSpaceEx`, `GetTickCount64` |
| `StorageAnalysisService` | Varredura de espaço, categorias, pastas grandes, duplicados | Não (perfil do usuário) / Sim (todo o disco) | `FindFirstFileEx`, `GetFileInformationByHandle` |
| `CleanupService` | Orquestra scan → plan → execute → verify | Depende da categoria | `cleaners/*` |
| `StartupManagerService` | Enumera e alterna itens de inicialização | Sim para HKLM e serviços | Registro (`Run`, `RunOnce`, `StartupApproved`), pasta Startup, Task Scheduler (COM `ITaskService`) |
| `ProcessManagerService` | Lista/encerra processos | Sim para processos de outros usuários | `CreateToolhelp32Snapshot`, `NtQuerySystemInformation`, `QueryFullProcessImageName`, PDH |
| `OptimizationService` | Lê estado atual, aplica, reverte | Depende do ajuste | Registro, `PowerSetActiveScheme`, `SystemParametersInfo` |
| `BackupService` | Snapshots internos (JSON assinado por hash) | Não | SQLite + `%LOCALAPPDATA%\BoostCore\backups` |
| `RestorePointService` | Pontos de restauração do Windows | **Sim** | `SRSetRestorePoint` (srclient.dll) |
| `ApplicationManagerService` | Apps instalados, desinstalação oficial | Depende do app | Registro `Uninstall` (HKLM/HKCU, 32/64) + `PackageManager` (MSIX) |
| `ActivityLogService` | Histórico legível + undo | Não | SQLite |
| `SettingsService` | Preferências, validadas por schema | Não | SQLite |
| `PermissionService` | Decide se precisa elevar e negocia com o Elevator | — | Token do processo, `IsUserAnAdmin`-equivalente |
| `MonitoringService` | Amostragem periódica, buffers circulares 60s/5min/15min | Não | PDH, WMI |
| `UpdateService` | Verificação, download, validação de assinatura | Sim para instalar | `tauri-plugin-updater` |

## 5. Estado no frontend

Zustand com *slices* por domínio, sem estado global monolítico:

- `systemStore` — info estática do sistema + snapshot de saúde (cache com TTL).
- `monitoringStore` — buffers de séries temporais (não persistido).
- `cleanupStore` — scan atual, seleção, plano, progresso.
- `optimizationStore` — catálogo + estado aplicado.
- `settingsStore` — persistido no SQLite via backend, hidratado no boot.
- `uiStore` — modais, toasts, sidebar, escala, `reduceMotion`.

Regra: *stores* **não** chamam `invoke` diretamente; chamam `services/`, que fazem `invoke` +
`schema.parse()` (Zod) antes de devolver. Assim, uma mudança de contrato no Rust falha em um
único lugar, com erro legível.

## 6. Eventos backend → frontend

Progresso e telemetria em tempo real não usam polling. Canais de evento do Tauri:

| Evento | Payload | Uso |
|---|---|---|
| `cleanup:progress` | `{ operationId, category, filesDone, filesTotal, bytesFreed, currentPathMasked }` | Barra de progresso |
| `cleanup:finished` | `CleanupExecutionResult` | Fecha modal |
| `scan:progress` | `{ operationId, phase, percent }` | Análise |
| `monitor:sample` | `MonitorSample` (1 Hz, só quando a tela de monitoramento/dashboard está visível) | Gráficos |
| `elevation:required` | `{ operationId, reason, operations[] }` | Abre `PermissionDialog` |
| `app:notice` | `{ level, message }` | Toasts |

`currentPathMasked` nunca contém o nome completo do arquivo do usuário no log — ver
`docs/05-PLANO-DE-SEGURANCA.md` §6.

## 7. Cancelamento

Toda operação longa recebe um `CancellationToken` (`Arc<AtomicBool>` + `tokio::sync::Notify`).
Cancelamento é **cooperativo e seguro**: o cancelamento é verificado *entre* arquivos, nunca no
meio de uma remoção. O resultado devolvido é `cancelled: true` com os totais parciais reais
já persistidos — nunca deixamos o banco inconsistente com o disco.

## 8. Concorrência

- Comandos Tauri são `async` e rodam no runtime Tokio; varreduras de disco pesadas vão para
  `tokio::task::spawn_blocking` com `rayon` para paralelismo de I/O limitado (máx.
  `min(4, num_cpus)` threads, para não saturar o disco do usuário).
- Uma única operação mutante por vez: um `OperationLock` global impede, por exemplo, limpeza
  simultânea com aplicação de otimizações. Tentativas concorrentes recebem
  `ServiceUnavailable` com mensagem clara.

## 9. Persistência

SQLite em `%APPDATA%\BoostCore\boostcore.db` (WAL ativado), migrations versionadas em
`src-tauri/migrations/NNNN_nome.sql` aplicadas na inicialização dentro de uma transação, com
tabela `schema_migrations`. Detalhes em `docs/03-MODELO-DE-DADOS.md`.

Arquivos grandes (snapshots de backup, relatórios exportados) ficam fora do banco, em
`%LOCALAPPDATA%\BoostCore\backups\<uuid>.json` com hash SHA-256 registrado na tabela `backups`.

## 10. Estratégia de erros

Um único `AppError` em Rust (enum `thiserror`) serializado para um objeto TS estável.
Detalhes e catálogo completo em `docs/04-CONTRATOS-IPC.md` §5.

## 11. Testabilidade

O ponto crítico: **nenhum teste pode tocar pastas reais do Windows** (requisito 28).

Solução: todos os serviços que tocam o FS recebem um `PathGuard` construído a partir de um
`SystemPaths` **injetável**:

```rust
pub trait SystemPaths: Send + Sync {
    fn user_temp(&self) -> PathBuf;
    fn windows_temp(&self) -> PathBuf;
    fn local_app_data(&self) -> PathBuf;
    /* ... */
}
pub struct RealSystemPaths;                 // produção: lê do SO
pub struct FakeSystemPaths { root: TempDir } // testes: tudo dentro de um tempdir
```

Nos testes, `FakeSystemPaths` aponta para um `tempfile::TempDir`; o `PathGuard` construído a
partir dele **rejeita qualquer caminho fora do tempdir**, então mesmo um bug no teste não pode
apagar arquivos reais. O mesmo vale para registro: `RegistryBackend` tem implementação real e
uma `InMemoryRegistry` para testes.
