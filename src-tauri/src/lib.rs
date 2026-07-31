//! Aplicativo Tauri do eloBoost.
//!
//! Responsabilidade deste crate: montar a janela, inicializar o log e o banco
//! local, e registrar os comandos nomeados. Toda a lógica testável mora em
//! `elo-core`.
//!
//! **Escopo atual (Épico 2):** infraestrutura, **leitura** de informações do
//! sistema e **análise** das áreas limpáveis. Nenhuma limpeza, remoção,
//! otimização, escrita no registro, encerramento de processo ou chamada ao
//! `PowerShell` existe no projeto. O acesso ao Win32 é somente leitura e está
//! confinado a [`system::ffi`]; o scanner ([`scanner`]) apenas percorre
//! diretórios e soma tamanhos, e há um teste que falha se qualquer API de
//! escrita aparecer no seu código.

pub mod cleaner;
pub mod commands;
pub mod models;
pub mod scanner;
pub mod services;
pub mod state;
pub mod system;
pub mod traits;
pub mod util;

use std::path::PathBuf;

use elo_core::logging::{self, LoggingConfig};
use tauri::Manager as _;

use crate::state::AppState;

/// Ponto de entrada compartilhado entre o binário e os testes de integração.
///
/// # Panics
/// Encerra o aplicativo se a pasta de dados do usuário for inacessível ou se o
/// banco local não puder ser preparado — sem eles não há histórico, backup nem
/// reversão, e seguir adiante seria pior do que falhar de forma visível.
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let data_dir = resolve_data_dir(app.handle())?;

            // O log é diagnóstico: se falhar, o aplicativo continua.
            let logging_guard = match logging::init(&LoggingConfig::new(data_dir.join("logs"))) {
                Ok(guard) => Some(guard),
                Err(error) => {
                    eprintln!("[eloBoost] não foi possível iniciar o log técnico: {error}");
                    None
                }
            };

            tracing::info!(versao = env!("CARGO_PKG_VERSION"), "eloBoost iniciando");

            let state = AppState::initialize(data_dir).map_err(|error| {
                tracing::error!(erro = %error, "falha ao inicializar o estado do aplicativo");
                Box::<dyn std::error::Error>::from(error.to_string())
            })?;

            app.manage(state);
            if let Some(guard) = logging_guard {
                app.manage(guard);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app::app_get_info,
            commands::app::app_get_database_status,
            commands::system::app_get_runtime_info,
            commands::system::system_get_snapshot,
            commands::scanner::scanner_list_categories,
            commands::scanner::scanner_scan_all,
            commands::cleaner::cleaner_preview,
            commands::cleaner::cleaner_execute,
            commands::cleaner::history_list_recent,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a janela do eloBoost");
}

/// Resolve a pasta de dados do aplicativo (`%APPDATA%\eloBoost` no Windows).
fn resolve_data_dir(handle: &tauri::AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let dir = handle.path().app_data_dir()?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}
