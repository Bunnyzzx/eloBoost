//! Log técnico do eloBoost.
//!
//! Requisitos (docs/05 §6):
//!   • armazenamento local, com rotação diária;
//!   • níveis debug / info / warning / error;
//!   • nenhuma senha, token ou conteúdo de arquivo;
//!   • caminhos mascarados antes de serem registrados (ver [`crate::paths`]);
//!   • um `operation_id` correlacionando log, banco e mensagem ao usuário.

use std::path::{Path, PathBuf};

use tracing_subscriber::layer::SubscriberExt as _;
use tracing_subscriber::util::SubscriberInitExt as _;
use tracing_subscriber::EnvFilter;

/// Guarda do escritor de log em background.
///
/// Precisa permanecer viva enquanto o aplicativo roda; ao ser descartada, as
/// linhas pendentes são gravadas.
#[allow(
    dead_code,
    reason = "guarda RAII: o valor existe para ser descartado no fim do processo"
)]
pub struct LoggingGuard(tracing_appender::non_blocking::WorkerGuard);

/// Configuração do log.
#[derive(Debug, Clone)]
pub struct LoggingConfig {
    /// Pasta onde os arquivos são gravados.
    pub directory: PathBuf,
    /// Nível mínimo registrado.
    pub level: LogLevel,
    /// Também escrever no console (desenvolvimento).
    pub to_stderr: bool,
}

/// Níveis de log expostos ao usuário nas configurações.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    /// Detalhado — ativado apenas com o modo avançado.
    Debug,
    /// Padrão.
    Info,
    /// Apenas avisos e erros.
    Warning,
    /// Apenas erros.
    Error,
}

impl LogLevel {
    #[must_use]
    const fn as_filter(self) -> &'static str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Warning => "warn",
            Self::Error => "error",
        }
    }
}

impl LoggingConfig {
    /// Configuração padrão para a pasta de dados informada.
    #[must_use]
    pub fn new(directory: impl Into<PathBuf>) -> Self {
        Self {
            directory: directory.into(),
            level: if cfg!(debug_assertions) {
                LogLevel::Debug
            } else {
                LogLevel::Info
            },
            to_stderr: cfg!(debug_assertions),
        }
    }
}

/// Inicializa o log técnico.
///
/// Rotação diária em `<directory>/eloboost.log`. Falhas de inicialização não
/// derrubam o aplicativo: o log é diagnóstico, não funcionalidade.
///
/// # Errors
/// Devolve erro se a pasta de log não puder ser criada.
pub fn init(config: &LoggingConfig) -> std::io::Result<LoggingGuard> {
    std::fs::create_dir_all(&config.directory)?;

    let appender = tracing_appender::rolling::daily(&config.directory, "eloboost.log");
    let (writer, guard) = tracing_appender::non_blocking(appender);

    // `ELOBOOST_LOG` permite aumentar o detalhe em diagnóstico sem novo build.
    let filter = EnvFilter::try_from_env("ELOBOOST_LOG")
        .unwrap_or_else(|_| EnvFilter::new(config.level.as_filter()));

    let file_layer = tracing_subscriber::fmt::layer()
        .with_writer(writer)
        .with_ansi(false)
        .with_target(true)
        .with_thread_ids(false);

    let stderr_layer = config.to_stderr.then(|| {
        tracing_subscriber::fmt::layer()
            .with_writer(std::io::stderr)
            .with_target(false)
    });

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(file_layer)
        .with(stderr_layer)
        .try_init();

    Ok(LoggingGuard(guard))
}

/// Caminho do arquivo de log do dia, para exibição nas configurações.
#[must_use]
pub fn current_log_file(directory: &Path) -> PathBuf {
    directory.join("eloboost.log")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cria_a_pasta_de_log() {
        let dir = tempfile::tempdir().expect("tempdir");
        let target = dir.path().join("logs");

        let guard = init(&LoggingConfig {
            directory: target.clone(),
            level: LogLevel::Info,
            to_stderr: false,
        })
        .expect("inicialização");

        assert!(target.exists());
        drop(guard);
    }

    #[test]
    fn nivel_padrao_depende_do_perfil_de_compilacao() {
        let dir = tempfile::tempdir().expect("tempdir");
        let config = LoggingConfig::new(dir.path());
        if cfg!(debug_assertions) {
            assert_eq!(config.level, LogLevel::Debug);
        } else {
            assert_eq!(config.level, LogLevel::Info);
        }
    }

    #[test]
    fn niveis_mapeiam_para_o_filtro_correto() {
        assert_eq!(LogLevel::Debug.as_filter(), "debug");
        assert_eq!(LogLevel::Warning.as_filter(), "warn");
    }
}
