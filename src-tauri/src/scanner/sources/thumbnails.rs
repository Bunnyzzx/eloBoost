//! Cache de miniaturas e de ícones do Explorador de Arquivos.
//!
//! Vive em `%LOCALAPPDATA%\Microsoft\Windows\Explorer`, junto com outros
//! arquivos do Explorador que **não** são cache. Por isso a raiz é rasa e
//! filtrada por nome: só entram `thumbcache_*.db` e `iconcache_*.db`, que é
//! exatamente a allowlist de docs/05 §2. Medir a pasta inteira daria um número
//! maior e erraria sobre o que poderia ser limpo.

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, locations, FileFilter, ScanRoot};

const CATEGORY: ScanCategory = ScanCategory::Thumbnails;

/// Prefixos dos arquivos de cache gerados pelo Explorador.
const CACHE_PREFIXES: &[&str] = &["thumbcache_", "iconcache_"];

/// Raízes desta categoria neste computador.
#[must_use]
pub fn roots() -> Vec<ScanRoot> {
    let Some(local) = locations::local_app_data() else {
        return Vec::new();
    };

    vec![
        ScanRoot::shallow(local.join("Microsoft").join("Windows").join("Explorer"))
            .filtered(FileFilter::NamePrefix(CACHE_PREFIXES)),
    ]
}

/// Analisa a categoria. Somente leitura.
#[must_use]
pub fn scan() -> CategoryScan {
    let roots = roots();
    if roots.is_empty() {
        return CategoryScan::not_supported(
            CATEGORY,
            "O cache de miniaturas existe apenas no Windows.",
        );
    }
    scanner::scan_roots(CATEGORY, &roots)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_result::ScanStatus;

    #[test]
    fn fora_do_windows_a_categoria_se_declara_nao_suportada() {
        if !cfg!(windows) {
            assert_eq!(scan().status, ScanStatus::NotSupported);
        }
    }

    #[test]
    fn a_raiz_e_rasa_e_filtrada_pelos_arquivos_de_cache() {
        for root in roots() {
            // Rasa de propósito: a pasta Explorer tem subpastas que não são cache.
            assert!(!root.recursive, "a raiz não deveria ser recursiva");
            assert_eq!(root.filter, FileFilter::NamePrefix(CACHE_PREFIXES));
        }
    }

    #[test]
    fn o_filtro_aceita_os_arquivos_de_cache_e_recusa_o_resto() {
        let filtro = FileFilter::NamePrefix(CACHE_PREFIXES);

        assert!(filtro.accepts("thumbcache_1024.db"));
        assert!(filtro.accepts("iconcache_32.db"));
        // Maiúsculas: o Windows não diferencia, e o filtro também não.
        assert!(filtro.accepts("ThumbCache_16.db"));

        // Estes vivem na mesma pasta e não são cache de miniatura.
        assert!(!filtro.accepts("ExplorerStartupLog.etl"));
        assert!(!filtro.accepts("relatorio-do-usuario.docx"));
    }
}
