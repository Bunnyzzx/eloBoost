//! Comandos de infraestrutura do aplicativo.
//!
//! Contrato: docs/04-CONTRATOS-IPC.md. Cada comando é nomeado, tipado e
//! validado — **não existe** e nunca existirá um comando que receba uma linha
//! de comando arbitrária vinda da interface (docs/05 §T5).
//!
//! Os dois comandos abaixo são somente-leitura e não tocam o sistema
//! operacional: leem a identidade do build e o estado do banco local.

use elo_core::db::DatabaseStatus;
use elo_core::errors::AppResult;
use serde::Serialize;

use crate::state::AppState;

/// Informações do próprio aplicativo — não do sistema operacional.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    /// Nome do produto.
    pub name: String,
    /// Versão vinda do `Cargo.toml`.
    pub version: String,
    /// `debug` ou `release`.
    pub build_profile: String,
    /// Sempre `true` quando respondido pelo backend.
    pub running_in_tauri: bool,
}

/// Devolve nome, versão e perfil de compilação do eloBoost.
#[must_use]
#[tauri::command]
pub fn app_get_info() -> AppInfo {
    AppInfo {
        name: elo_core::APP_NAME.to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_owned()
        } else {
            "release".to_owned()
        },
        running_in_tauri: true,
    }
}

/// Devolve o diagnóstico do banco local: versão do schema, migrations
/// aplicadas, tamanho e caminho mascarado.
///
/// # Errors
/// Devolve `DatabaseError` se o banco local estiver inacessível ou
/// inconsistente.
// `tauri::State` é sempre recebido por valor: é assim que o macro de comando
// injeta o estado. Não há referência a tomar aqui.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn app_get_database_status(state: tauri::State<'_, AppState>) -> AppResult<DatabaseStatus> {
    state.database.status()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reporta_a_versao_do_pacote() {
        let info = app_get_info();

        assert_eq!(info.name, "eloBoost");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert!(info.running_in_tauri);
    }

    #[test]
    fn app_info_serializa_em_camel_case_para_a_interface() {
        let json = serde_json::to_value(app_get_info()).expect("serialização");

        assert!(json.get("buildProfile").is_some());
        assert!(json.get("runningInTauri").is_some());
        // Confirma que não sobrou nenhum campo em snake_case.
        assert!(json.get("build_profile").is_none());
    }
}
