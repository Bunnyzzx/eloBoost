//! Arquivos temporários do próprio Windows (`%SystemRoot%\Temp`).
//!
//! Área do sistema, não do usuário: acumula sobras de atualizações e de
//! instaladores. Boa parte dela costuma exigir permissão de administrador para
//! ser lida, e é por isso que o resultado desta categoria frequentemente vem
//! marcado como "analisada com itens sem permissão" — o que é informação útil,
//! não uma falha.

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, locations, ScanRoot};

const CATEGORY: ScanCategory = ScanCategory::WindowsTemp;

/// Raízes desta categoria neste computador.
#[must_use]
pub fn roots() -> Vec<ScanRoot> {
    locations::system_root()
        .map(|windows| vec![ScanRoot::recursive(windows.join("Temp"))])
        .unwrap_or_default()
}

/// Analisa a categoria. Somente leitura.
#[must_use]
pub fn scan() -> CategoryScan {
    let roots = roots();
    if roots.is_empty() {
        return CategoryScan::not_supported(CATEGORY, "Esta área existe apenas no Windows.");
    }
    scanner::scan_roots(CATEGORY, &roots)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_result::ScanStatus;

    #[test]
    fn fora_do_windows_a_categoria_se_declara_nao_suportada() {
        let scan = scan();

        if cfg!(windows) {
            assert_ne!(scan.status, ScanStatus::NotSupported);
        } else {
            // Nada de medir `/tmp` e chamar de "temporários do Windows": a
            // categoria diz honestamente que não existe aqui.
            assert_eq!(scan.status, ScanStatus::NotSupported);
            assert_eq!(scan.size_bytes, 0);
            assert!(scan.message.is_some());
        }
    }

    #[test]
    fn a_raiz_e_sempre_a_subpasta_temp_do_windows() {
        for root in roots() {
            assert!(
                root.path.ends_with("Temp"),
                "raiz inesperada: {}",
                root.path.display()
            );
            assert!(root.recursive);
        }
    }
}
