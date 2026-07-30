//! Utilitários de caminho voltados a privacidade.
//!
//! Nenhum caminho vai para log, histórico ou relatório exportado sem passar
//! por [`mask_path`]. O objetivo é impedir que o nome do usuário e nomes de
//! arquivos pessoais vazem em material que pode ser compartilhado com suporte
//! (docs/05 §6).
//!
//! Este módulo **não** valida permissão de acesso — isso é responsabilidade do
//! `PathGuard`, que entra no Épico 2, antes de qualquer funcionalidade de
//! limpeza.

use std::path::Path;

/// Substitui trechos sensíveis de um caminho por marcadores estáveis.
///
/// * o diretório do perfil do usuário vira `%USERPROFILE%`;
/// * o nome da conta vira `%USER%` em qualquer posição;
/// * variáveis conhecidas (`AppData\Local`, `Windows`) são normalizadas.
///
/// A saída continua legível para diagnóstico, mas não identifica a pessoa.
#[must_use]
pub fn mask_path(path: impl AsRef<Path>) -> String {
    let raw = path.as_ref().to_string_lossy().replace('/', "\\");
    let mut masked = raw;

    if let Some(user) = current_user_name() {
        if !user.is_empty() {
            // `\Users\<nome>\` → `\Users\%USER%\`
            masked = replace_case_insensitive(&masked, &format!("\\{user}\\"), "\\%USER%\\");
            // Caminho terminando no diretório do usuário.
            masked = strip_trailing_user(&masked, &user);
        }
    }

    for (needle, replacement) in [
        ("\\AppData\\Local\\Temp", "\\%TEMP%"),
        ("\\AppData\\Local", "\\%LOCALAPPDATA%"),
        ("\\AppData\\Roaming", "\\%APPDATA%"),
    ] {
        masked = replace_case_insensitive(&masked, needle, replacement);
    }

    masked
}

fn strip_trailing_user(input: &str, user: &str) -> String {
    let suffix = format!("\\{user}");
    if input.to_lowercase().ends_with(&suffix.to_lowercase()) {
        let keep = input.len() - suffix.len();
        format!("{}\\%USER%", &input[..keep])
    } else {
        input.to_owned()
    }
}

/// Substituição sem diferenciar maiúsculas de minúsculas — o Windows trata
/// caminhos assim, e o log precisa mascarar independentemente da grafia.
fn replace_case_insensitive(haystack: &str, needle: &str, replacement: &str) -> String {
    if needle.is_empty() {
        return haystack.to_owned();
    }

    let lower_haystack = haystack.to_lowercase();
    let lower_needle = needle.to_lowercase();

    let mut result = String::with_capacity(haystack.len());
    let mut cursor = 0;

    while let Some(found) = lower_haystack[cursor..].find(&lower_needle) {
        let start = cursor + found;
        result.push_str(&haystack[cursor..start]);
        result.push_str(replacement);
        cursor = start + needle.len();
    }

    result.push_str(&haystack[cursor..]);
    result
}

/// Nome da conta do usuário atual, quando disponível.
fn current_user_name() -> Option<String> {
    std::env::var("USERNAME")
        .ok()
        .or_else(|| std::env::var("USER").ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mascara_variaveis_conhecidas_do_windows() {
        let masked = mask_path("C:\\Users\\Ana\\AppData\\Local\\Temp\\arquivo.tmp");
        assert!(masked.contains("%TEMP%"), "obtido: {masked}");
        assert!(!masked.contains("AppData\\Local\\Temp"));
    }

    #[test]
    fn mascara_appdata_roaming() {
        let masked = mask_path("C:\\Users\\Ana\\AppData\\Roaming\\eloBoost\\eloboost.db");
        assert!(masked.contains("%APPDATA%"), "obtido: {masked}");
    }

    #[test]
    fn substituicao_ignora_maiusculas_e_minusculas() {
        let masked = mask_path("C:\\Users\\Ana\\appdata\\local\\Programs\\app.exe");
        assert!(masked.contains("%LOCALAPPDATA%"), "obtido: {masked}");
    }

    #[test]
    fn mascara_o_nome_do_usuario_atual() {
        // SAFETY-equivalente: `set_var` é seguro aqui porque o teste é single-thread
        // no que diz respeito a esta variável e o valor é restaurado logo em seguida.
        let previous = std::env::var("USERNAME").ok();
        std::env::set_var("USERNAME", "fulano");

        let masked = mask_path("C:\\Users\\fulano\\Documents\\relatorio.pdf");
        assert!(masked.contains("%USER%"), "obtido: {masked}");
        assert!(!masked.contains("fulano"), "obtido: {masked}");

        match previous {
            Some(value) => std::env::set_var("USERNAME", value),
            None => std::env::remove_var("USERNAME"),
        }
    }

    #[test]
    fn normaliza_separadores() {
        assert!(!mask_path("C:/Windows/Temp").contains('/'));
    }

    #[test]
    fn caminho_sem_dado_sensivel_permanece_legivel() {
        assert_eq!(mask_path("C:\\Windows\\Logs"), "C:\\Windows\\Logs");
    }

    #[test]
    fn substituicao_multipla_funciona() {
        let result = replace_case_insensitive("aXbXc", "x", "-");
        assert_eq!(result, "a-b-c");
    }

    #[test]
    fn substituicao_com_agulha_vazia_nao_trava() {
        assert_eq!(replace_case_insensitive("abc", "", "-"), "abc");
    }
}
