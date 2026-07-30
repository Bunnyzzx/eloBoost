//! Migrations versionadas do banco local.
//!
//! Regras (docs/03 §1):
//!   • Cada migration roda em uma transação própria, em ordem crescente.
//!   • O SHA-256 do arquivo é gravado e verificado a cada inicialização: uma
//!     migration já aplicada que mudou aborta o boot em vez de deixar dois
//!     bancos divergentes em campo.
//!   • Migrations publicadas nunca são editadas — cria-se a próxima.
//!   • Downgrade não é suportado; um banco criado por versão mais nova é
//!     detectado e reportado com mensagem clara.

use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};

use crate::errors::{AppError, AppResult, ErrorCode};

/// Uma migration embutida no binário.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    /// Número sequencial, começando em 1.
    pub version: i64,
    /// Nome legível, usado no diagnóstico.
    pub name: &'static str,
    /// Conteúdo SQL.
    pub sql: &'static str,
}

/// Lista ordenada de migrations conhecidas por este build.
///
/// `include_str!` embute o arquivo no binário — não há dependência de arquivos
/// externos em tempo de execução.
pub const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "init",
    sql: include_str!("../../migrations/0001_init.sql"),
}];

/// Versão de schema que este build espera encontrar.
#[must_use]
pub fn expected_version() -> i64 {
    MIGRATIONS.last().map_or(0, |migration| migration.version)
}

/// Registro de uma migration já aplicada.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppliedMigration {
    /// Número da migration.
    pub version: i64,
    /// Nome registrado no momento da aplicação.
    pub name: String,
    /// Quando foi aplicada (ISO-8601 UTC).
    pub applied_at: String,
}

fn checksum(sql: &str) -> String {
    let mut hasher = Sha256::new();
    // Normaliza CRLF: o mesmo arquivo não pode gerar hashes diferentes só por
    // ter passado pelo autocrlf do Git no Windows.
    hasher.update(sql.replace("\r\n", "\n").as_bytes());
    format!("{:x}", hasher.finalize())
}

fn ensure_migrations_table(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER PRIMARY KEY,
            name       TEXT NOT NULL,
            applied_at TEXT NOT NULL,
            checksum   TEXT NOT NULL
        );",
    )?;
    Ok(())
}

/// Lê as migrations já aplicadas, em ordem crescente.
pub fn applied_migrations(connection: &Connection) -> AppResult<Vec<AppliedMigration>> {
    ensure_migrations_table(connection)?;

    let mut statement = connection
        .prepare("SELECT version, name, applied_at FROM schema_migrations ORDER BY version")?;

    let rows = statement.query_map([], |row| {
        Ok(AppliedMigration {
            version: row.get(0)?,
            name: row.get(1)?,
            applied_at: row.get(2)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }
    Ok(result)
}

/// Versão de schema atualmente aplicada (0 em banco novo).
pub fn current_version(connection: &Connection) -> AppResult<i64> {
    ensure_migrations_table(connection)?;

    let version: Option<i64> = connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .optional()?
        .flatten();

    Ok(version.unwrap_or(0))
}

/// Aplica todas as migrations pendentes.
///
/// Devolve os números das migrations efetivamente aplicadas nesta chamada.
pub fn run(connection: &mut Connection) -> AppResult<Vec<i64>> {
    ensure_migrations_table(connection)?;
    verify_integrity(connection)?;

    let current = current_version(connection)?;
    let mut applied = Vec::new();

    for migration in MIGRATIONS {
        if migration.version <= current {
            continue;
        }

        let transaction = connection.transaction()?;
        transaction.execute_batch(migration.sql).map_err(|error| {
            AppError::new(ErrorCode::DatabaseError)
                .with_message("Não foi possível preparar o banco de dados local do eloBoost.")
                .with_details(error)
                .with_context("migration", migration.name)
        })?;

        transaction.execute(
            "INSERT INTO schema_migrations (version, name, applied_at, checksum)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                migration.version,
                migration.name,
                crate::now_iso8601(),
                checksum(migration.sql),
            ],
        )?;

        transaction.commit()?;
        tracing::info!(
            version = migration.version,
            name = migration.name,
            "migration aplicada"
        );
        applied.push(migration.version);
    }

    Ok(applied)
}

/// Verifica se o banco é compatível com este build.
///
/// Falha quando:
///   • o banco foi criado por uma versão mais nova do eloBoost;
///   • uma migration já aplicada teve o conteúdo alterado.
pub fn verify_integrity(connection: &Connection) -> AppResult<()> {
    let current = current_version(connection)?;
    let expected = expected_version();

    if current > expected {
        return Err(AppError::new(ErrorCode::InvalidConfiguration)
            .with_message("Os dados locais foram criados por uma versão mais recente do eloBoost.")
            .with_details(format!(
                "versão do banco: {current}; versão suportada por este build: {expected}"
            )));
    }

    let mut statement =
        connection.prepare("SELECT version, checksum FROM schema_migrations ORDER BY version")?;
    let rows = statement.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
    })?;

    for row in rows {
        let (version, stored) = row?;
        let Some(migration) = MIGRATIONS.iter().find(|m| m.version == version) else {
            // Migration desconhecida por este build: já coberto pela checagem de
            // versão acima, mas mantemos a guarda explícita.
            continue;
        };

        if checksum(migration.sql) != stored {
            return Err(AppError::new(ErrorCode::InvalidConfiguration)
                .with_message("Os dados locais do eloBoost estão inconsistentes.")
                .with_details(format!(
                    "a migration {version} ({}) foi alterada após ter sido aplicada",
                    migration.name
                ))
                .with_context("migration", migration.name));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn memory_connection() -> Connection {
        Connection::open_in_memory().expect("banco em memória")
    }

    #[test]
    fn banco_novo_comeca_na_versao_zero() {
        let connection = memory_connection();
        assert_eq!(current_version(&connection).expect("versão"), 0);
    }

    #[test]
    fn aplica_todas_as_migrations_pendentes() {
        let mut connection = memory_connection();
        let applied = run(&mut connection).expect("migrations");

        assert_eq!(applied, vec![1]);
        assert_eq!(
            current_version(&connection).expect("versão"),
            expected_version()
        );
    }

    #[test]
    fn execucao_repetida_e_idempotente() {
        let mut connection = memory_connection();
        run(&mut connection).expect("primeira execução");
        let second = run(&mut connection).expect("segunda execução");

        assert!(
            second.is_empty(),
            "nenhuma migration deveria ser reaplicada"
        );
    }

    #[test]
    fn registra_nome_e_data_de_cada_migration() {
        let mut connection = memory_connection();
        run(&mut connection).expect("migrations");

        let applied = applied_migrations(&connection).expect("lista");
        assert_eq!(applied.len(), MIGRATIONS.len());
        assert_eq!(applied[0].version, 1);
        assert_eq!(applied[0].name, "init");
        assert!(!applied[0].applied_at.is_empty());
    }

    #[test]
    fn cria_todas_as_tabelas_do_modelo_de_dados() {
        let mut connection = memory_connection();
        run(&mut connection).expect("migrations");

        let esperadas = [
            "settings",
            "cleanup_scans",
            "cleanup_items",
            "optimization_definitions",
            "optimization_history",
            "backups",
            "activity_logs",
            "startup_snapshots",
            "exclusions",
            "health_snapshots",
            "gaming_sessions",
            "pending_operations",
        ];

        for tabela in esperadas {
            let existe: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [tabela],
                    |row| row.get(0),
                )
                .expect("consulta");
            assert_eq!(existe, 1, "tabela ausente: {tabela}");
        }
    }

    #[test]
    fn checksum_ignora_diferenca_de_quebra_de_linha() {
        assert_eq!(
            checksum("SELECT 1;\nSELECT 2;"),
            checksum("SELECT 1;\r\nSELECT 2;")
        );
    }

    #[test]
    fn detecta_migration_alterada_apos_aplicada() {
        let mut connection = memory_connection();
        run(&mut connection).expect("migrations");

        connection
            .execute(
                "UPDATE schema_migrations SET checksum = 'hash-diferente' WHERE version = 1",
                [],
            )
            .expect("adulteração");

        let error = verify_integrity(&connection).expect_err("deveria falhar");
        assert_eq!(error.code(), ErrorCode::InvalidConfiguration);
    }

    #[test]
    fn detecta_banco_de_versao_futura() {
        let mut connection = memory_connection();
        run(&mut connection).expect("migrations");

        connection
            .execute(
                "INSERT INTO schema_migrations (version, name, applied_at, checksum)
                 VALUES (?1, 'do_futuro', '2030-01-01T00:00:00Z', 'x')",
                [expected_version() + 10],
            )
            .expect("insert");

        let error = verify_integrity(&connection).expect_err("deveria falhar");
        assert_eq!(error.code(), ErrorCode::InvalidConfiguration);
    }

    #[test]
    fn migrations_tem_versoes_unicas_e_crescentes() {
        let mut previous = 0;
        for migration in MIGRATIONS {
            assert!(
                migration.version > previous,
                "versões devem ser únicas e crescentes"
            );
            previous = migration.version;
        }
    }
}
