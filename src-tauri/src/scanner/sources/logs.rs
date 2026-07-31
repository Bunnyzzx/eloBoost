//! Registros técnicos que o Windows mantém em disco.
//!
//! Duas raízes conhecidas — `%SystemRoot%\Logs` e `%SystemRoot%\System32\LogFiles`
//! — filtradas por extensão (`.log`, `.etl`), conforme a allowlist de docs/05 §2.
//! O filtro importa: `System32\LogFiles` contém subpastas de serviços com
//! arquivos que não são log, e medir tudo daria um número que não corresponde ao
//! que poderia ser limpo.
//!
//! Parte destas pastas exige administrador para ser lida. Quando isso acontece a
//! categoria conclui assim mesmo, marcada com o que ficou de fora — a análise
//! não para por causa de uma pasta protegida.

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, locations, FileFilter, ScanRoot};

const CATEGORY: ScanCategory = ScanCategory::Logs;

/// Extensões consideradas registro descartável.
const LOG_EXTENSIONS: &[&str] = &["log", "etl"];

/// Raízes desta categoria neste computador.
#[must_use]
pub fn roots() -> Vec<ScanRoot> {
    let Some(windows) = locations::system_root() else {
        return Vec::new();
    };

    let filter = FileFilter::Extension(LOG_EXTENSIONS);

    vec![
        ScanRoot::recursive(windows.join("Logs")).filtered(filter),
        ScanRoot::recursive(windows.join("System32").join("LogFiles")).filtered(filter),
    ]
}

/// Analisa a categoria. Somente leitura.
#[must_use]
pub fn scan() -> CategoryScan {
    let roots = roots();
    if roots.is_empty() {
        return CategoryScan::not_supported(CATEGORY, "Estes registros existem apenas no Windows.");
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
            let scan = scan();
            assert_eq!(scan.status, ScanStatus::NotSupported);
            assert_eq!(scan.size_bytes, 0);
        }
    }

    #[test]
    fn as_duas_raizes_conhecidas_sao_filtradas_por_extensao() {
        let roots = roots();
        if roots.is_empty() {
            return; // fora do Windows
        }

        assert_eq!(roots.len(), 2);
        for root in roots {
            assert_eq!(root.filter, FileFilter::Extension(LOG_EXTENSIONS));
        }
    }

    #[test]
    fn o_filtro_aceita_apenas_registros() {
        let filtro = FileFilter::Extension(LOG_EXTENSIONS);

        assert!(filtro.accepts("CBS.log"));
        assert!(filtro.accepts("Sistema.ETL"));

        // Estes convivem com os logs e não são descartáveis.
        assert!(!filtro.accepts("configuracao.ini"));
        assert!(!filtro.accepts("driver.sys"));
        assert!(!filtro.accepts("arquivo-sem-extensao"));
    }
}
