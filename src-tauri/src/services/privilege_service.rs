//! Privilégio do processo atual.

use crate::models::availability::Availability;
use crate::models::system::PrivilegeInfo;
use crate::system::ffi;

/// Verifica se o eloBoost está rodando elevado.
///
/// O aplicativo roda **sem** elevação por padrão (docs/06 §1). Este dado existe
/// para que a interface informe o estado e desabilite antecipadamente ações que
/// exigiriam administrador — em vez de deixá-las falhar depois do clique.
#[must_use]
pub fn collect() -> PrivilegeInfo {
    match ffi::process_privileges() {
        Some(privileges) => PrivilegeInfo {
            is_elevated: Availability::available(privileges.is_elevated),
            can_elevate: Availability::available(privileges.is_admin_member),
        },
        None => PrivilegeInfo {
            is_elevated: Availability::not_supported(),
            can_elevate: Availability::not_supported(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nunca_entra_em_panico_na_plataforma_atual() {
        let _ = collect();
    }

    #[cfg(not(windows))]
    #[test]
    fn fora_do_windows_o_privilegio_e_indeterminado() {
        // Reportar "não elevado" no Linux seria afirmar algo que não medimos.
        let info = collect();
        assert!(!info.is_elevated.is_available());
        assert!(!info.can_elevate.is_available());
    }

    #[cfg(windows)]
    #[test]
    fn no_windows_o_estado_de_elevacao_e_conhecido() {
        let info = collect();
        assert!(info.is_elevated.is_available());
    }
}
