//! Estado compartilhado do aplicativo.
//!
//! Mantido deliberadamente pequeno: no Épico 0 há apenas o banco local e a
//! identificação do build. Serviços de limpeza, otimização e monitoramento
//! entram aqui nos épicos seguintes, sempre atrás de uma interface testável.

use std::path::PathBuf;

use elo_core::db::Database;
use elo_core::errors::{AppError, AppResult, ErrorCode};

/// Estado global registrado no Tauri via `manage`.
pub struct AppState {
    /// Banco local, já migrado.
    pub database: Database,
    /// Pasta de dados do aplicativo (`%APPDATA%\eloBoost`).
    pub data_dir: PathBuf,
}

impl AppState {
    /// Inicializa o estado a partir da pasta de dados do usuário.
    ///
    /// Falhar aqui é fatal e intencional: sem banco não há histórico, backup
    /// nem reversão — e um utilitário de manutenção que não consegue registrar
    /// o que fez não deve seguir adiante.
    ///
    /// # Errors
    /// Devolve `DatabaseError` se a pasta de dados não puder ser criada ou se
    /// as migrations não puderem ser aplicadas.
    pub fn initialize(data_dir: PathBuf) -> AppResult<Self> {
        let database = Database::open(data_dir.join("eloboost.db")).map_err(|error| {
            tracing::error!(erro = %error, "falha ao abrir o banco local");
            error
        })?;

        Ok(Self { database, data_dir })
    }

    /// Pasta onde os logs técnicos são gravados.
    #[must_use]
    pub fn log_dir(&self) -> PathBuf {
        self.data_dir.join("logs")
    }
}

/// Erro padrão quando um serviço ainda não implementado é acionado.
///
/// Existe para que uma chamada indevida durante o desenvolvimento devolva um
/// erro tipado e legível, em vez de um `unwrap` ou de um valor simulado que
/// pareceria uma funcionalidade pronta.
#[must_use]
pub fn not_implemented(feature: &str) -> AppError {
    AppError::new(ErrorCode::UnsupportedSystem)
        .with_message("Esta funcionalidade ainda não está disponível nesta versão.")
        .with_details(format!("recurso não implementado: {feature}"))
}
