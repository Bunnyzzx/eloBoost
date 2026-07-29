//! Acesso ao banco local (`SQLite`).
//!
//! Todos os dados do eloBoost ficam neste computador, em `%APPDATA%\eloBoost`.
//! Nenhuma query é montada por concatenação — apenas *prepared statements*.

pub mod migrations;

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::errors::{AppError, AppResult, ErrorCode};
use crate::paths::mask_path;

/// Banco local do eloBoost.
///
/// A conexão é serializada por um mutex: o `SQLite` embutido é usado em modo
/// WAL, e o volume de escrita do aplicativo não justifica um pool.
pub struct Database {
    connection: Mutex<Connection>,
    path: PathBuf,
}

/// Diagnóstico do banco, exposto na tela Sobre.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    /// Versão do schema efetivamente aplicada.
    pub schema_version: i64,
    /// Versão que este build espera.
    pub expected_version: i64,
    /// Migrations já aplicadas.
    pub applied_migrations: Vec<AppliedMigrationDto>,
    /// Caminho do arquivo, com o nome do usuário mascarado.
    pub database_path_masked: String,
    /// Tamanho do arquivo em bytes.
    pub size_bytes: u64,
    /// `true` quando o schema está na versão esperada.
    pub healthy: bool,
}

/// Migration aplicada, no formato consumido pela interface.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppliedMigrationDto {
    /// Número da migration.
    pub version: i64,
    /// Nome legível.
    pub name: String,
    /// Data de aplicação (ISO-8601 UTC).
    pub applied_at: String,
}

impl From<migrations::AppliedMigration> for AppliedMigrationDto {
    fn from(value: migrations::AppliedMigration) -> Self {
        Self {
            version: value.version,
            name: value.name,
            applied_at: value.applied_at,
        }
    }
}

impl Database {
    /// Abre (ou cria) o banco no caminho informado e aplica as migrations
    /// pendentes.
    ///
    /// O diretório pai é criado se não existir.
    pub fn open(path: impl AsRef<Path>) -> AppResult<Self> {
        let path = path.as_ref().to_path_buf();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|error| {
                AppError::new(ErrorCode::DatabaseError)
                    .with_message("Não foi possível criar a pasta de dados do eloBoost.")
                    .with_details(error)
                    .with_context("pasta", mask_path(parent))
            })?;
        }

        let mut connection = Connection::open(&path).map_err(|error| {
            AppError::new(ErrorCode::DatabaseError)
                .with_details(error)
                .with_context("banco", mask_path(&path))
        })?;

        configure(&connection)?;
        migrations::run(&mut connection)?;

        tracing::info!(banco = %mask_path(&path), "banco local pronto");

        Ok(Self {
            connection: Mutex::new(connection),
            path,
        })
    }

    /// Abre um banco em memória — usado exclusivamente em testes.
    #[cfg(any(test, feature = "testing"))]
    pub fn open_in_memory() -> AppResult<Self> {
        let mut connection = Connection::open_in_memory()?;
        configure(&connection)?;
        migrations::run(&mut connection)?;

        Ok(Self {
            connection: Mutex::new(connection),
            path: PathBuf::from(":memory:"),
        })
    }

    /// Empresta a conexão. Envenenamento do mutex vira erro tipado em vez de
    /// derrubar o processo.
    pub fn connection(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection.lock().map_err(|_| {
            AppError::new(ErrorCode::DatabaseError)
                .with_message("Os dados locais ficaram temporariamente indisponíveis.")
                .with_details("mutex da conexão envenenado por um panic anterior")
        })
    }

    /// Caminho do arquivo do banco.
    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Coleta o diagnóstico exibido na tela Sobre.
    pub fn status(&self) -> AppResult<DatabaseStatus> {
        let connection = self.connection()?;

        let schema_version = migrations::current_version(&connection)?;
        let expected_version = migrations::expected_version();
        let applied = migrations::applied_migrations(&connection)?
            .into_iter()
            .map(Into::into)
            .collect();

        // Banco em memória (testes) não tem arquivo em disco: tamanho zero.
        let size_bytes = std::fs::metadata(&self.path).map_or(0, |meta| meta.len());

        Ok(DatabaseStatus {
            schema_version,
            expected_version,
            applied_migrations: applied,
            database_path_masked: mask_path(&self.path),
            size_bytes,
            healthy: schema_version == expected_version,
        })
    }
}

/// Aplica os PRAGMAs padrão da conexão.
fn configure(connection: &Connection) -> AppResult<()> {
    // `journal_mode` devolve uma linha; por isso não usa `execute_batch`.
    let mode: String = connection.query_row("PRAGMA journal_mode = WAL", [], |row| row.get(0))?;
    if !mode.eq_ignore_ascii_case("wal") && !mode.eq_ignore_ascii_case("memory") {
        tracing::warn!(modo = %mode, "não foi possível ativar o modo WAL");
    }

    connection.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA synchronous = NORMAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA auto_vacuum = INCREMENTAL;",
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abre_banco_em_arquivo_e_aplica_migrations() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("sub").join("eloboost.db");

        let database = Database::open(&path).expect("abrir banco");
        let status = database.status().expect("status");

        assert!(path.exists(), "o arquivo do banco deve ser criado");
        assert_eq!(status.schema_version, migrations::expected_version());
        assert!(status.healthy);
        assert!(!status.applied_migrations.is_empty());
    }

    #[test]
    fn reabrir_o_mesmo_banco_nao_reaplica_migrations() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("eloboost.db");

        let first = Database::open(&path).expect("primeira abertura");
        let version = first.status().expect("status").schema_version;
        drop(first);

        let second = Database::open(&path).expect("segunda abertura");
        assert_eq!(second.status().expect("status").schema_version, version);
    }

    #[test]
    fn chaves_estrangeiras_estao_ativas() {
        let database = Database::open_in_memory().expect("banco");
        let connection = database.connection().expect("conexão");

        let enabled: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("pragma");
        assert_eq!(enabled, 1);
    }

    #[test]
    fn integridade_referencial_e_aplicada() {
        let database = Database::open_in_memory().expect("banco");
        let connection = database.connection().expect("conexão");

        // cleanup_items referencia cleanup_scans; um scan_id inexistente deve falhar.
        let result = connection.execute(
            "INSERT INTO cleanup_items
               (id, scan_id, category, path, file_size, risk_level, selected, status)
             VALUES ('i1', 'scan-que-nao-existe', 'user_temp', 'x', 10, 'low', 0, 'pending')",
            [],
        );

        assert!(result.is_err(), "FK deveria impedir o insert órfão");
    }

    #[test]
    fn status_mascara_o_caminho_do_banco() {
        let database = Database::open_in_memory().expect("banco");
        let status = database.status().expect("status");
        assert!(!status.database_path_masked.is_empty());
    }

    #[test]
    fn restricoes_check_do_schema_sao_aplicadas() {
        let database = Database::open_in_memory().expect("banco");
        let connection = database.connection().expect("conexão");

        let result = connection.execute(
            "INSERT INTO activity_logs
               (id, operation_id, action_type, message, level, result, created_at)
             VALUES ('a1', 'op1', 'acao_invalida', 'msg', 'info', 'success', '2026-01-01T00:00:00Z')",
            [],
        );

        assert!(
            result.is_err(),
            "CHECK deveria rejeitar action_type inválido"
        );
    }
}
