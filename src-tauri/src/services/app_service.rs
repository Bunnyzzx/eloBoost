//! Informações do próprio aplicativo.

use crate::models::system::AppRuntimeInfo;

/// Alvo de compilação deste binário.
///
/// `std::env::consts` é resolvido pelo compilador para a plataforma de destino,
/// não pela máquina que executa — então o valor é o alvo real do build, e não um
/// palpite a partir do sistema em execução.
fn build_target() -> String {
    format!(
        "{}-{}-{}",
        std::env::consts::ARCH,
        std::env::consts::OS,
        std::env::consts::FAMILY
    )
}

/// Coleta nome, versão, perfil e alvo de compilação.
#[must_use]
pub fn collect() -> AppRuntimeInfo {
    AppRuntimeInfo {
        name: elo_core::APP_NAME.to_owned(),
        version: env!("CARGO_PKG_VERSION").to_owned(),
        build_profile: if cfg!(debug_assertions) {
            "debug".to_owned()
        } else {
            "release".to_owned()
        },
        target: build_target(),
        running_in_tauri: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reporta_a_versao_do_pacote_e_nao_um_literal() {
        let info = collect();
        assert_eq!(info.name, "eloBoost");
        assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
        assert!(info.running_in_tauri);
    }

    #[test]
    fn o_alvo_de_compilacao_e_preenchido() {
        let info = collect();
        assert!(!info.target.is_empty());
        assert!(info.target.contains(std::env::consts::ARCH));
    }

    #[test]
    fn o_perfil_reflete_o_modo_de_compilacao() {
        let info = collect();
        let esperado = if cfg!(debug_assertions) {
            "debug"
        } else {
            "release"
        };
        assert_eq!(info.build_profile, esperado);
    }

    #[test]
    fn serializa_em_camel_case_para_a_interface() {
        let json = serde_json::to_value(collect()).expect("serialização");
        assert!(json.get("buildProfile").is_some());
        assert!(json.get("runningInTauri").is_some());
        assert!(json.get("build_profile").is_none());
    }
}
