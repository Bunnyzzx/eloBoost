//! Resolução das pastas conhecidas do sistema.
//!
//! Todas as raízes analisadas nascem aqui, a partir de variáveis de ambiente do
//! próprio sistema operacional. **Nenhum caminho vem da interface** — o frontend
//! recebe identificadores de categoria e devolve identificadores, nunca strings
//! de caminho (docs/04 §caminhos).
//!
//! O eloBoost é um produto para Windows. As fontes que dependem de áreas
//! exclusivas do Windows declaram isso e devolvem "não suportado" em outras
//! plataformas, em vez de fingir um equivalente. As que têm equivalente real —
//! pasta temporária, Downloads, perfis de navegador — funcionam nas duas, o que
//! permite desenvolver e testar o scanner fora do Windows sem simular nada.

use std::path::PathBuf;

/// Converte o valor de uma variável de ambiente em caminho.
///
/// Uma variável definida como string vazia é tratada como ausente: `PathBuf`
/// aceitaria `""`, e o walker o interpretaria como o diretório atual — a análise
/// mediria a pasta de trabalho do aplicativo em vez da área pretendida.
fn path_from_value(value: Option<std::ffi::OsString>) -> Option<PathBuf> {
    let value = value?;
    if value.is_empty() {
        return None;
    }
    Some(PathBuf::from(value))
}

/// Lê uma variável de ambiente como caminho, ignorando valores vazios.
fn env_path(name: &str) -> Option<PathBuf> {
    path_from_value(std::env::var_os(name))
}

/// Pasta temporária do usuário atual (`%TEMP%` no Windows, `$TMPDIR` fora).
#[must_use]
pub fn user_temp() -> Option<PathBuf> {
    Some(std::env::temp_dir())
}

/// Pasta pessoal do usuário (`%USERPROFILE%` no Windows, `$HOME` fora).
#[must_use]
pub fn user_profile() -> Option<PathBuf> {
    if cfg!(windows) {
        env_path("USERPROFILE")
    } else {
        env_path("HOME")
    }
}

/// `%LOCALAPPDATA%` — dados locais do usuário. Somente Windows.
#[must_use]
pub fn local_app_data() -> Option<PathBuf> {
    env_path("LOCALAPPDATA")
}

/// `%APPDATA%` — dados itinerantes do usuário. Somente Windows.
#[must_use]
pub fn roaming_app_data() -> Option<PathBuf> {
    env_path("APPDATA")
}

/// `%SystemRoot%` — a pasta do Windows, normalmente `C:\Windows`.
///
/// Devolve `None` fora do Windows, mesmo que a variável exista: as áreas que
/// dependem dela não têm equivalente honesto em outro sistema.
#[must_use]
pub fn system_root() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    env_path("SystemRoot").or_else(|| env_path("windir"))
}

/// Pasta de configuração do usuário fora do Windows (`$XDG_CONFIG_HOME`).
///
/// Usada apenas para localizar perfis de navegador durante o desenvolvimento em
/// Linux; no Windows os mesmos navegadores vivem sob `%LOCALAPPDATA%`.
#[must_use]
pub fn unix_config_home() -> Option<PathBuf> {
    if cfg!(windows) {
        return None;
    }
    env_path("XDG_CONFIG_HOME").or_else(|| user_profile().map(|home| home.join(".config")))
}

/// Pasta de cache do usuário fora do Windows (`$XDG_CACHE_HOME`).
#[must_use]
pub fn unix_cache_home() -> Option<PathBuf> {
    if cfg!(windows) {
        return None;
    }
    env_path("XDG_CACHE_HOME").or_else(|| user_profile().map(|home| home.join(".cache")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pasta_temporaria_existe_em_qualquer_plataforma() {
        let temp = user_temp().expect("toda plataforma tem pasta temporária");
        assert!(temp.is_absolute(), "obtido: {}", temp.display());
    }

    #[test]
    fn variavel_vazia_e_tratada_como_ausente() {
        // Uma variável definida como string vazia produziria `PathBuf::from("")`,
        // que o walker interpretaria como o diretório atual — e a análise mediria
        // a pasta de trabalho do aplicativo.
        assert!(path_from_value(Some(std::ffi::OsString::new())).is_none());
        assert!(path_from_value(None).is_none());
        assert_eq!(
            path_from_value(Some(std::ffi::OsString::from("/tmp"))),
            Some(PathBuf::from("/tmp"))
        );
    }

    #[test]
    fn areas_exclusivas_do_windows_nao_sao_inventadas_em_outras_plataformas() {
        if cfg!(windows) {
            assert!(system_root().is_some(), "%SystemRoot% deveria existir");
        } else {
            assert!(system_root().is_none());
            assert!(local_app_data().is_none() || cfg!(windows));
        }
    }

    #[test]
    fn a_pasta_pessoal_e_absoluta_quando_existe() {
        if let Some(profile) = user_profile() {
            assert!(profile.is_absolute(), "obtido: {}", profile.display());
        }
    }
}
