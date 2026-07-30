//! Lixeira do Windows.
//!
//! Esta é a única fonte que **não** faz uma caminhada de diretório. A pasta
//! `$Recycle.Bin` é interna ao Windows: o layout muda entre versões, contém
//! metadados por usuário e enumerar aquilo na mão significaria interpretar um
//! formato não documentado para chegar a um número que o próprio sistema já
//! fornece. Usamos `SHQueryRecycleBin`, a API oficial, que apenas consulta
//! (docs/05 §2).
//!
//! Como não há caminhada, não há pastas a contar: a categoria reporta os itens
//! como arquivos e zero pastas — que é exatamente o que o Windows informa.

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::{CategoryScan, ScanStatus, SkippedItems};
use crate::scanner;
use crate::system::ffi;

const CATEGORY: ScanCategory = ScanCategory::RecycleBin;

/// Analisa a categoria. Somente leitura — nada é esvaziado nem restaurado.
#[must_use]
pub fn scan() -> CategoryScan {
    let started = std::time::Instant::now();

    let Some(usage) = ffi::recycle_bin_usage() else {
        return if cfg!(windows) {
            CategoryScan::failed(CATEGORY, "O Windows não respondeu à consulta da Lixeira.")
                .with_duration_ms(scanner::elapsed_ms(started))
        } else {
            CategoryScan::not_supported(CATEGORY, "A Lixeira existe apenas no Windows.")
                .with_duration_ms(scanner::elapsed_ms(started))
        };
    };

    CategoryScan {
        category: CATEGORY,
        name: CATEGORY.name(),
        description: CATEGORY.description(),
        removal_policy: CATEGORY.removal_policy(),
        file_count: usage.item_count,
        // A API devolve itens, sem distinguir arquivos de pastas apagadas.
        // Reportar um número de pastas aqui seria inventá-lo.
        folder_count: 0,
        size_bytes: usage.size_bytes,
        duration_ms: scanner::elapsed_ms(started),
        status: ScanStatus::Completed,
        message: None,
        skipped: SkippedItems::default(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fora_do_windows_a_categoria_se_declara_nao_suportada() {
        let scan = scan();

        if cfg!(windows) {
            assert_ne!(scan.status, ScanStatus::NotSupported);
        } else {
            assert_eq!(scan.status, ScanStatus::NotSupported);
            assert_eq!(scan.size_bytes, 0);
            assert_eq!(scan.file_count, 0);
        }
    }

    #[test]
    fn a_analise_nunca_reporta_pastas_percorridas() {
        // A API oficial não distingue arquivos de pastas apagadas; qualquer
        // número aqui seria invenção.
        assert_eq!(scan().folder_count, 0);
    }

    #[test]
    fn o_resultado_sempre_traz_o_texto_da_categoria() {
        let scan = scan();
        assert_eq!(scan.name, ScanCategory::RecycleBin.name());
        assert_eq!(scan.category, ScanCategory::RecycleBin);
    }
}
