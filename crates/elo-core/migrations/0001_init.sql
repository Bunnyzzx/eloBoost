-- eloBoost — schema inicial.
--
-- Referência: docs/03-MODELO-DE-DADOS.md
--
-- Convenções:
--   • Chaves primárias: TEXT com UUID (v7 quando ordenável por tempo importa).
--   • Datas: TEXT ISO-8601 UTC. Nunca timestamps ambíguos.
--   • Tamanhos: INTEGER em bytes. Nunca "MB" pré-formatado.
--   • Booleanos: INTEGER 0/1 com CHECK.
--   • Enums: TEXT com CHECK — legível em inspeção manual do banco.
--
-- Esta migration cria o schema completo previsto no planejamento. As tabelas
-- de funcionalidades ainda não implementadas ficam vazias até que o épico
-- correspondente entre; criá-las agora evita migrations parciais e mantém o
-- modelo de dados revisável em um único lugar.

-- ─────────────────────────────────────────────────────────────
-- Preferências do aplicativo
-- ─────────────────────────────────────────────────────────────
CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    value_type TEXT NOT NULL CHECK (value_type IN ('bool', 'int', 'float', 'string', 'json')),
    updated_at TEXT NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- Limpeza (Épico 3)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE cleanup_scans (
    id           TEXT PRIMARY KEY,
    started_at   TEXT NOT NULL,
    finished_at  TEXT,
    total_files  INTEGER NOT NULL DEFAULT 0,
    total_size   INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL CHECK (status IN ('running', 'completed', 'cancelled', 'failed')),
    dry_run      INTEGER NOT NULL DEFAULT 0 CHECK (dry_run IN (0, 1)),
    operation_id TEXT NOT NULL,
    app_version  TEXT NOT NULL
);

CREATE TABLE cleanup_items (
    id            TEXT PRIMARY KEY,
    scan_id       TEXT NOT NULL REFERENCES cleanup_scans (id) ON DELETE CASCADE,
    category      TEXT NOT NULL,
    path          TEXT NOT NULL,
    file_size     INTEGER NOT NULL,
    last_modified TEXT,
    risk_level    TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    selected      INTEGER NOT NULL DEFAULT 0 CHECK (selected IN (0, 1)),
    status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'removed', 'skipped', 'failed', 'locked')),
    error_code    TEXT
);

CREATE INDEX idx_cleanup_items_scan ON cleanup_items (scan_id);
CREATE INDEX idx_cleanup_items_category ON cleanup_items (scan_id, category);

-- ─────────────────────────────────────────────────────────────
-- Otimizações (Épico 9)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE optimization_definitions (
    id                TEXT PRIMARY KEY,
    code              TEXT NOT NULL UNIQUE,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL,
    category          TEXT NOT NULL CHECK (category IN (
                          'general', 'performance', 'appearance', 'gaming', 'privacy',
                          'network', 'power', 'storage', 'startup', 'lab')),
    risk_level        TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
    requires_admin    INTEGER NOT NULL CHECK (requires_admin IN (0, 1)),
    requires_restart  INTEGER NOT NULL CHECK (requires_restart IN (0, 1)),
    reversible        INTEGER NOT NULL DEFAULT 1 CHECK (reversible IN (0, 1)),
    is_experimental   INTEGER NOT NULL DEFAULT 0 CHECK (is_experimental IN (0, 1)),
    expected_benefit  TEXT NOT NULL,
    side_effects      TEXT NOT NULL,
    how_it_works      TEXT NOT NULL,
    min_windows_build INTEGER,
    max_windows_build INTEGER,
    catalog_version   INTEGER NOT NULL
);

-- ─────────────────────────────────────────────────────────────
-- Backups (declarada antes de optimization_history por causa da FK)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE backups (
    id           TEXT PRIMARY KEY,
    type         TEXT NOT NULL CHECK (type IN (
                     'registry_snapshot', 'settings_snapshot', 'startup_snapshot',
                     'system_restore_point', 'gaming_session', 'full_report')),
    description  TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    path         TEXT,
    sha256       TEXT,
    size_bytes   INTEGER,
    operation_id TEXT,
    external_ref TEXT,
    status       TEXT NOT NULL CHECK (status IN ('created', 'restored', 'failed', 'deleted', 'stale')),
    expires_at   TEXT
);

CREATE INDEX idx_backups_created ON backups (created_at DESC);

CREATE TABLE optimization_history (
    id               TEXT PRIMARY KEY,
    optimization_id  TEXT NOT NULL REFERENCES optimization_definitions (id),
    operation_id     TEXT NOT NULL,
    target           TEXT NOT NULL,
    previous_value   TEXT,
    new_value        TEXT,
    applied_at       TEXT NOT NULL,
    reverted_at      TEXT,
    status           TEXT NOT NULL CHECK (status IN (
                         'applied', 'reverted', 'failed', 'pending_restart', 'partially_applied')),
    requires_restart INTEGER NOT NULL DEFAULT 0 CHECK (requires_restart IN (0, 1)),
    user_name        TEXT NOT NULL,
    app_version      TEXT NOT NULL,
    backup_id        TEXT REFERENCES backups (id),
    error_code       TEXT
);

CREATE INDEX idx_optim_history_optim ON optimization_history (optimization_id, applied_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Histórico legível (Épico 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE activity_logs (
    id             TEXT PRIMARY KEY,
    operation_id   TEXT NOT NULL,
    action_type    TEXT NOT NULL CHECK (action_type IN (
                       'scan', 'cleanup', 'optimization_apply', 'optimization_revert',
                       'startup_toggle', 'process_kill', 'app_uninstall', 'restore_point_create',
                       'restore', 'backup_create', 'backup_delete', 'settings_change',
                       'gaming_session_start', 'gaming_session_end', 'update')),
    message        TEXT NOT NULL,
    level          TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warning', 'error')),
    result         TEXT NOT NULL CHECK (result IN ('success', 'partial', 'failed', 'cancelled')),
    affected_count INTEGER NOT NULL DEFAULT 0,
    released_bytes INTEGER NOT NULL DEFAULT 0,
    details        TEXT,
    undo_ref       TEXT,
    undo_kind      TEXT CHECK (undo_kind IN ('optimization', 'startup', 'backup', 'none')),
    created_at     TEXT NOT NULL
);

CREATE INDEX idx_activity_created ON activity_logs (created_at DESC);
CREATE INDEX idx_activity_op ON activity_logs (operation_id);

-- ─────────────────────────────────────────────────────────────
-- Inicialização (Épico 8)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE startup_snapshots (
    id              TEXT PRIMARY KEY,
    item_identifier TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    source          TEXT NOT NULL CHECK (source IN (
                        'registry_run', 'registry_run_once', 'startup_folder',
                        'scheduled_task', 'service')),
    scope           TEXT NOT NULL CHECK (scope IN ('machine', 'user')),
    previous_state  TEXT NOT NULL CHECK (previous_state IN ('enabled', 'disabled', 'unknown')),
    new_state       TEXT NOT NULL CHECK (new_state IN ('enabled', 'disabled')),
    raw_previous    TEXT,
    changed_at      TEXT NOT NULL,
    operation_id    TEXT NOT NULL,
    reverted_at     TEXT
);

CREATE INDEX idx_startup_item ON startup_snapshots (item_identifier, changed_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Exclusões configuradas pelo usuário (Épico 4)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE exclusions (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('folder', 'application', 'process', 'browser_profile')),
    value      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (kind, value)
);

-- ─────────────────────────────────────────────────────────────
-- Saúde do sistema (Épico 5)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE health_snapshots (
    id           TEXT PRIMARY KEY,
    created_at   TEXT NOT NULL,
    score        INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    factors      TEXT NOT NULL,
    operation_id TEXT NOT NULL
);

CREATE INDEX idx_health_created ON health_snapshots (created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- Sessões do perfil Gaming (futuro)
--
-- `status = 'active'` na inicialização indica sessão interrompida por queda de
-- energia ou encerramento abrupto: o app oferece restaurar o estado anterior.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE gaming_sessions (
    id              TEXT PRIMARY KEY,
    started_at      TEXT NOT NULL,
    ended_at        TEXT,
    status          TEXT NOT NULL CHECK (status IN ('active', 'ended', 'recovered', 'failed')),
    applied_changes TEXT NOT NULL,
    metrics_before  TEXT,
    metrics_after   TEXT
);

-- ─────────────────────────────────────────────────────────────
-- Journal de operações — recuperação após crash (docs/07 §5)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE pending_operations (
    id            TEXT PRIMARY KEY,
    operation_id  TEXT NOT NULL,
    kind          TEXT NOT NULL,
    plan          TEXT NOT NULL,
    started_at    TEXT NOT NULL,
    verified_at   TEXT,
    status        TEXT NOT NULL CHECK (status IN ('in_progress', 'applied', 'verified', 'failed')),
    app_version   TEXT NOT NULL
);

CREATE INDEX idx_pending_status ON pending_operations (status);
