//! Identificação do sistema operacional e da máquina.

use sysinfo::System;

use crate::models::availability::{Availability, UnavailableReason};
use crate::models::system::OsInfo;
use crate::system::ffi;
use crate::util::text::sanitize;

/// Coleta nome do computador, sistema, edição, build e arquitetura.
///
/// Combina duas fontes:
///   • `sysinfo` — multiplataforma: nome do host, nome e versão do sistema;
///   • registro do Windows via [`ffi`] — edição, versão comercial e build, que
///     não têm equivalente multiplataforma.
///
/// Fora do Windows, os campos exclusivos ficam indisponíveis com motivo
/// explícito, em vez de receberem um valor aproximado.
#[must_use]
pub fn collect() -> OsInfo {
    let computer_name = System::host_name()
        .as_deref()
        .and_then(sanitize)
        .map_or_else(
            || Availability::unavailable(UnavailableReason::ReadFailed),
            Availability::available,
        );

    let user_name = current_user_name().map_or_else(
        || Availability::unavailable(UnavailableReason::ReadFailed),
        Availability::available,
    );

    let name = System::name().as_deref().and_then(sanitize).map_or_else(
        || Availability::unavailable(UnavailableReason::ReadFailed),
        Availability::available,
    );

    let kernel_version = System::kernel_version()
        .as_deref()
        .and_then(sanitize)
        .map_or_else(
            || Availability::unavailable(UnavailableReason::NotSupported),
            Availability::available,
        );

    // Edição, versão comercial e build vêm do registro do Windows.
    let windows = ffi::windows_version();

    let edition = resolve_edition(windows.as_ref());
    let display_version = windows
        .as_ref()
        .and_then(|version| version.display_version.clone())
        .map_or_else(Availability::not_supported, Availability::available);
    let build = resolve_build(windows.as_ref());

    OsInfo {
        computer_name,
        user_name,
        name,
        edition,
        display_version,
        build,
        // `ARCH` é resolvido em tempo de compilação e sempre existe.
        architecture: std::env::consts::ARCH.to_owned(),
        kernel_version,
    }
}

/// Edição do Windows — ex.: "Windows 11 Pro".
fn resolve_edition(windows: Option<&ffi::WindowsVersion>) -> Availability<String> {
    windows
        .and_then(|version| version.product_name.clone())
        .map_or_else(Availability::not_supported, Availability::available)
}

/// Número de build. No Windows vem do registro; fora dele, tentamos a versão
/// longa do `sysinfo`, cuja primeira parte numérica corresponde ao build.
fn resolve_build(windows: Option<&ffi::WindowsVersion>) -> Availability<u32> {
    if let Some(build) = windows.and_then(|version| version.build) {
        return Availability::available(build);
    }

    let parsed = System::os_version()
        .as_deref()
        .and_then(parse_leading_number);

    Availability::from_option(parsed, UnavailableReason::NotSupported)
}

/// Extrai o primeiro número inteiro de uma string de versão.
fn parse_leading_number(version: &str) -> Option<u32> {
    let digits: String = version.chars().take_while(char::is_ascii_digit).collect();
    digits.parse().ok()
}

/// Conta do usuário atual, a partir das variáveis padrão de cada plataforma.
///
/// `USERNAME` é o nome no Windows; `USER` e `LOGNAME` cobrem shells POSIX, onde
/// nem sempre as duas estão definidas.
fn current_user_name() -> Option<String> {
    ["USERNAME", "USER", "LOGNAME"]
        .into_iter()
        .filter_map(|key| std::env::var(key).ok())
        .find_map(|value| sanitize(&value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coleta_sempre_devolve_arquitetura_real() {
        let os = collect();

        // A arquitetura vem do compilador: nunca é desconhecida.
        assert!(!os.architecture.is_empty());
        assert_eq!(os.architecture, std::env::consts::ARCH);
    }

    #[test]
    fn nome_do_computador_e_lido_no_ambiente_atual() {
        // `host_name` funciona em Linux e Windows; se falhar, o campo precisa
        // vir marcado como indisponível — nunca como string vazia.
        let os = collect();
        match os.computer_name {
            Availability::Available { value } => assert!(!value.is_empty()),
            Availability::Unavailable { reason, .. } => {
                assert_eq!(reason, UnavailableReason::ReadFailed);
            }
        }
    }

    #[cfg(not(windows))]
    #[test]
    fn fora_do_windows_a_edicao_e_declarada_indisponivel() {
        let os = collect();

        // O ponto importante: não inventamos "Windows 11 Pro" no Linux.
        assert!(!os.edition.is_available());
        assert!(!os.display_version.is_available());
    }

    #[cfg(windows)]
    #[test]
    fn no_windows_edicao_e_build_sao_lidos() {
        let os = collect();
        assert!(os.edition.is_available(), "edição deveria vir do registro");
        assert!(os.build.is_available(), "build deveria vir do registro");
    }

    #[test]
    fn extrai_numero_inicial_de_string_de_versao() {
        assert_eq!(parse_leading_number("22631"), Some(22_631));
        assert_eq!(parse_leading_number("6.5.0-generic"), Some(6));
        assert_eq!(parse_leading_number("sem numero"), None);
        assert_eq!(parse_leading_number(""), None);
    }
}
