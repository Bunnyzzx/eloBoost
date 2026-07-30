//! Normalização de texto vindo do sistema operacional.
//!
//! Strings do Win32 e da WMI chegam com padding, caracteres nulos e espaços
//! duplos com frequência incômoda. Passar tudo por aqui evita que a interface
//! receba `"AMD Ryzen 5 5600X\0\0"` ou `"Intel(R)  Core(TM)  i7"`.

/// Limpa uma string do sistema, devolvendo `None` quando não sobra conteúdo.
///
/// Remove terminadores nulos, apara as bordas e colapsa espaços internos.
/// `None` é intencional: um campo vazio deve virar "indisponível", não uma
/// string vazia exibida como se fosse um dado.
#[must_use]
pub fn sanitize(raw: &str) -> Option<String> {
    let cleaned = raw
        .trim_matches('\0')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_terminadores_nulos_do_win32() {
        assert_eq!(
            sanitize("AMD Ryzen 5 5600X\0\0").as_deref(),
            Some("AMD Ryzen 5 5600X")
        );
    }

    #[test]
    fn colapsa_espacos_internos_duplicados() {
        assert_eq!(
            sanitize("Intel(R)  Core(TM)   i7-9700K").as_deref(),
            Some("Intel(R) Core(TM) i7-9700K")
        );
    }

    #[test]
    fn apara_as_bordas() {
        assert_eq!(
            sanitize("  NVIDIA GeForce RTX 3060  ").as_deref(),
            Some("NVIDIA GeForce RTX 3060")
        );
    }

    #[test]
    fn texto_vazio_vira_none_em_vez_de_string_vazia() {
        // Uma string vazia na interface apareceria como um dado em branco; `None`
        // faz o campo ser marcado como indisponível, com motivo.
        assert_eq!(sanitize(""), None);
        assert_eq!(sanitize("   "), None);
        assert_eq!(sanitize("\0\0\0"), None);
        assert_eq!(sanitize("\t\n "), None);
    }

    #[test]
    fn preserva_acentos_e_caracteres_multibyte() {
        assert_eq!(
            sanitize("Módulo de vídeo").as_deref(),
            Some("Módulo de vídeo")
        );
    }
}
