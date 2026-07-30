//! Comandos de leitura de informações do sistema.
//!
//! Todos são **somente leitura**: nada aqui altera o sistema, o registro ou
//! arquivos. Cada comando é nomeado e tipado; não existe comando genérico
//! (docs/05 §3).

use elo_core::AppResult;

use crate::models::system::{AppRuntimeInfo, SystemSnapshot};
use crate::services::{app_service, system_service};
use crate::state::AppState;

/// Devolve o retrato completo do computador: sistema, CPU, memória, GPU,
/// volumes, tempo ligado e privilégio do processo.
///
/// Um único comando em vez de vários, para que a interface não tenha de
/// orquestrar chamadas nem lidar com estados parcialmente carregados. As
/// leituras lentas rodam em paralelo dentro do serviço.
///
/// # Errors
/// Devolve `ServiceUnavailable` se a sonda de sistema estiver inacessível.
#[allow(
    clippy::needless_pass_by_value,
    reason = "`tauri::State` é sempre injetado por valor pelo macro de comando"
)]
#[tauri::command]
pub async fn system_get_snapshot(state: tauri::State<'_, AppState>) -> AppResult<SystemSnapshot> {
    system_service::collect_snapshot(&state.system_probe).await
}

/// Devolve nome, versão, perfil e alvo de compilação do eloBoost.
#[must_use]
#[tauri::command]
pub fn app_get_runtime_info() -> AppRuntimeInfo {
    app_service::collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn o_runtime_info_do_comando_e_o_do_servico() {
        // O comando é uma casca fina: nenhuma lógica própria a divergir.
        let pelo_comando = app_get_runtime_info();
        let pelo_servico = app_service::collect();

        assert_eq!(pelo_comando.version, pelo_servico.version);
        assert_eq!(pelo_comando.target, pelo_servico.target);
    }
}
