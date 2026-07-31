# 03 — Modelo de Dados (SQLite)

Status: **Entrega 1 — planejamento**.

Local: `%APPDATA%\eloBoost\eloboost.db` · Modo WAL · `foreign_keys = ON` ·
`journal_size_limit` para evitar crescimento indefinido.

Convenções:
- Chaves primárias: `TEXT` contendo UUIDv7 (ordenável por tempo) — exceto `settings`, com chave natural.
- Datas: `TEXT` ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SS.sssZ`). Nunca timestamps ambíguos.
- Tamanhos: `INTEGER` em **bytes**. Nunca "MB" pré-formatado no banco.
- Booleanos: `INTEGER` 0/1 com `CHECK`.
- Enums: `TEXT` com `CHECK (col IN (...))` — legível em inspeção manual.

---

## 1. Migrations

```
src-tauri/migrations/
  0001_init.sql
  0002_optimization_catalog_seed.sql
  0003_indexes.sql
```

Tabela de controle, criada antes de tudo:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  applied_at  TEXT NOT NULL,
  checksum    TEXT NOT NULL          -- SHA-256 do arquivo .sql
);
```

Regras:
- Migrations são aplicadas em ordem, cada uma dentro de uma transação.
- O `checksum` é verificado no boot: um arquivo já aplicado que mudou aborta a inicialização com
  `InvalidConfiguration` — evita divergência silenciosa entre builds.
- **Nunca editamos uma migration já publicada**; criamos a próxima.
- Downgrade não é suportado; o app detecta `user_version` futura e exibe
  "banco criado por versão mais nova do eloBoost".

---

## 2. DDL — `0001_init.sql`

### settings

```sql
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,                     -- JSON serializado
  value_type  TEXT NOT NULL CHECK (value_type IN ('bool','int','float','string','json')),
  updated_at  TEXT NOT NULL
);
```
> `id` foi substituído por chave natural (`key`): não há caso de uso para dois registros da mesma
> chave, e o `PRIMARY KEY` textual dá o UPSERT de graça. Validação por Zod/serde no acesso.

### cleanup_scans

```sql
CREATE TABLE cleanup_scans (
  id            TEXT PRIMARY KEY,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  total_files   INTEGER NOT NULL DEFAULT 0,
  total_size    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL CHECK (status IN
                  ('running','completed','cancelled','failed')),
  dry_run       INTEGER NOT NULL DEFAULT 0 CHECK (dry_run IN (0,1)),
  operation_id  TEXT NOT NULL,
  app_version   TEXT NOT NULL
);
```

### cleanup_items

```sql
CREATE TABLE cleanup_items (
  id           TEXT PRIMARY KEY,
  scan_id      TEXT NOT NULL REFERENCES cleanup_scans(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,
  path         TEXT NOT NULL,
  file_size    INTEGER NOT NULL,
  last_modified TEXT,
  risk_level   TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
  selected     INTEGER NOT NULL DEFAULT 0 CHECK (selected IN (0,1)),
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                 ('pending','removed','skipped','failed','locked')),
  error_code   TEXT
);
CREATE INDEX idx_cleanup_items_scan     ON cleanup_items(scan_id);
CREATE INDEX idx_cleanup_items_category ON cleanup_items(scan_id, category);
```
> **Retenção:** varreduras completas podem gerar centenas de milhares de linhas. Política: só
> persistimos itens detalhados do scan **ativo** e dos itens efetivamente **removidos** (para o
> histórico/undo). Scans antigos são compactados para os agregados em `cleanup_scans` e seus itens
> apagados por uma rotina de manutenção (padrão: manter detalhes por 30 dias ou 5 scans).

### optimization_definitions

```sql
CREATE TABLE optimization_definitions (
  id              TEXT PRIMARY KEY,
  code            TEXT NOT NULL UNIQUE,          -- ex.: 'power.plan.high_performance'
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN
                    ('general','performance','appearance','gaming','privacy',
                     'network','power','storage','startup','lab')),
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
  requires_admin  INTEGER NOT NULL CHECK (requires_admin IN (0,1)),
  requires_restart INTEGER NOT NULL CHECK (requires_restart IN (0,1)),
  reversible      INTEGER NOT NULL DEFAULT 1 CHECK (reversible IN (0,1)),
  is_experimental INTEGER NOT NULL DEFAULT 0 CHECK (is_experimental IN (0,1)),
  expected_benefit TEXT NOT NULL,
  side_effects    TEXT NOT NULL,                 -- JSON array de strings
  how_it_works    TEXT NOT NULL,
  min_windows_build INTEGER,
  max_windows_build INTEGER,
  catalog_version INTEGER NOT NULL
);
```
> Populada por migration a partir de `resources/optimizations.toml`. O catálogo é **dado
> versionado**, revisável em PR (requisito 12: nada de "dezenas de chaves de registro sem
> documentação" — cada linha aqui exige `description`, `side_effects` e `how_it_works` não vazios,
> validado em teste).

### optimization_history

```sql
CREATE TABLE optimization_history (
  id                TEXT PRIMARY KEY,
  optimization_id   TEXT NOT NULL REFERENCES optimization_definitions(id),
  operation_id      TEXT NOT NULL,
  target            TEXT NOT NULL,               -- chave/config exata alterada
  previous_value    TEXT,                        -- JSON; NULL = valor não existia
  new_value         TEXT,
  applied_at        TEXT NOT NULL,
  reverted_at       TEXT,
  status            TEXT NOT NULL CHECK (status IN
                      ('applied','reverted','failed','pending_restart','partially_applied')),
  requires_restart  INTEGER NOT NULL DEFAULT 0 CHECK (requires_restart IN (0,1)),
  user_name         TEXT NOT NULL,
  app_version       TEXT NOT NULL,
  backup_id         TEXT REFERENCES backups(id),
  error_code        TEXT
);
CREATE INDEX idx_optim_history_optim ON optimization_history(optimization_id, applied_at DESC);
```
> Atende ao requisito 15 integralmente: chave alterada, valor anterior, valor posterior,
> data/hora, usuário, versão do app, resultado e necessidade de reinício.

### backups

```sql
CREATE TABLE backups (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL CHECK (type IN
                 ('registry_snapshot','settings_snapshot','startup_snapshot',
                  'system_restore_point','gaming_session','full_report')),
  description  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  path         TEXT,                            -- NULL para restore points do Windows
  sha256       TEXT,
  size_bytes   INTEGER,
  operation_id TEXT,
  external_ref TEXT,                            -- sequence number do restore point
  status       TEXT NOT NULL CHECK (status IN
                 ('created','restored','failed','deleted','stale')),
  expires_at   TEXT
);
```

### activity_logs

```sql
CREATE TABLE activity_logs (
  id           TEXT PRIMARY KEY,
  operation_id TEXT NOT NULL,
  action_type  TEXT NOT NULL CHECK (action_type IN
                 ('scan','cleanup','optimization_apply','optimization_revert',
                  'startup_toggle','process_kill','app_uninstall','restore_point_create',
                  'restore','backup_create','backup_delete','settings_change',
                  'gaming_session_start','gaming_session_end','update')),
  message      TEXT NOT NULL,                   -- legível, já redigido/mascarado
  level        TEXT NOT NULL CHECK (level IN ('debug','info','warning','error')),
  result       TEXT NOT NULL CHECK (result IN
                 ('success','partial','failed','cancelled')),
  affected_count INTEGER NOT NULL DEFAULT 0,
  released_bytes INTEGER NOT NULL DEFAULT 0,
  details      TEXT,                            -- JSON estruturado, já redigido
  undo_ref     TEXT,                            -- id em backups/optimization_history/startup_snapshots
  undo_kind    TEXT CHECK (undo_kind IN
                 ('optimization','startup','backup','none')),
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_op      ON activity_logs(operation_id);
```
> `undo_ref`/`undo_kind` são o que alimentam o botão "Desfazer" do histórico (requisito 16).
> Limpeza de arquivos **não** é desfazível — o registro carrega `undo_kind = 'none'` e a UI
> mostra isso explicitamente em vez de um botão que falharia.

### startup_snapshots

```sql
CREATE TABLE startup_snapshots (
  id              TEXT PRIMARY KEY,
  item_identifier TEXT NOT NULL,                -- hash estável: fonte + escopo + nome + caminho
  display_name    TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN
                    ('registry_run','registry_run_once','startup_folder',
                     'scheduled_task','service')),
  scope           TEXT NOT NULL CHECK (scope IN ('machine','user')),
  previous_state  TEXT NOT NULL CHECK (previous_state IN ('enabled','disabled','unknown')),
  new_state       TEXT NOT NULL CHECK (new_state IN ('enabled','disabled')),
  raw_previous    TEXT,                         -- bytes originais do StartupApproved, base64
  changed_at      TEXT NOT NULL,
  operation_id    TEXT NOT NULL,
  reverted_at     TEXT
);
CREATE INDEX idx_startup_item ON startup_snapshots(item_identifier, changed_at DESC);
```
> `raw_previous` guarda o blob binário original do valor `StartupApproved` — restaurar o byte
> exato é mais seguro do que "recriar" o estado habilitado.

### Tabelas adicionais (não pedidas explicitamente, mas necessárias)

```sql
-- Exclusões configuradas pelo usuário (requisito 20)
CREATE TABLE exclusions (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL CHECK (kind IN ('folder','application','process','browser_profile')),
  value      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(kind, value)
);

-- Resultados de análise de saúde, para mostrar tendência
CREATE TABLE health_snapshots (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  score        INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  factors      TEXT NOT NULL,      -- JSON: cada critério, peso, valor observado e pontuação
  operation_id TEXT NOT NULL
);

-- Sessões do perfil Gaming, para restauração após reinício inesperado
CREATE TABLE gaming_sessions (
  id              TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  ended_at        TEXT,
  status          TEXT NOT NULL CHECK (status IN ('active','ended','recovered','failed')),
  applied_changes TEXT NOT NULL,   -- JSON: lista de mudanças e valores anteriores
  metrics_before  TEXT,
  metrics_after   TEXT
);
```
> `gaming_sessions.status = 'active'` na inicialização ⇒ o app detecta uma sessão interrompida
> (queda de energia, crash) e oferece restaurar o estado anterior — requisito 13.

---

## 3. Regras de integridade e privacidade

| Regra | Motivo |
|---|---|
| Nenhuma coluna armazena senha, token, cookie ou conteúdo de arquivo | Requisito 16/20 |
| `activity_logs.message` e `.details` passam por `security::redact` antes do INSERT | Impede vazar nomes de arquivos pessoais no histórico exportado |
| `cleanup_items.path` é mantido apenas enquanto o scan é relevante | Reduz superfície: o histórico agregado não precisa dos caminhos |
| Exportação de relatório é opt-in e mostra prévia do que será exportado | Requisito 16 |
| `PRAGMA foreign_keys = ON` sempre | Evita órfãos após purga de scans |
| Banco fica em `%APPDATA%` (por usuário), nunca em `ProgramData` | Não misturar dados entre contas do PC |

## 4. Estimativa de volume

| Cenário | Linhas | Tamanho |
|---|---|---|
| Scan rápido típico | ~15k `cleanup_items` | ~3 MB |
| Scan profundo (analisar todo o disco) | até ~400k | ~90 MB → por isso a política de retenção |
| 1 ano de uso normal | ~4k `activity_logs` | < 5 MB |

Rotina de manutenção no boot (assíncrona, baixa prioridade): purga de scans expirados +
`PRAGMA incremental_vacuum`.
