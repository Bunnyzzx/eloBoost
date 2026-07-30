//! Arquivos temporários do usuário atual (`%TEMP%`).
//!
//! A área mais previsível do sistema: programas escrevem ali durante a execução
//! e, quando fecham mal, deixam para trás. Existe em qualquer plataforma, então
//! esta fonte produz números reais também fora do Windows.

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, locations, ScanRoot};

const CATEGORY: ScanCategory = ScanCategory::UserTemp;

/// Raízes desta categoria neste computador.
fn roots() -> Vec<ScanRoot> {
    locations::user_temp()
        .map(|path| vec![ScanRoot::recursive(path)])
        .unwrap_or_default()
}

/// Analisa a categoria. Somente leitura.
#[must_use]
pub fn scan() -> CategoryScan {
    let roots = roots();
    if roots.is_empty() {
        return CategoryScan::not_found(
            CATEGORY,
            "Não foi possível localizar a pasta de temporários deste usuário.",
        );
    }
    scanner::scan_roots(CATEGORY, &roots)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_result::ScanStatus;

    #[test]
    fn a_pasta_temporaria_e_encontrada_neste_computador() {
        // Todo sistema tem uma; se esta fonte reportar "não encontrada", algo
        // está errado com a resolução de caminhos, não com a máquina.
        assert_eq!(roots().len(), 1);
    }

    #[test]
    fn analisa_a_pasta_real_deste_computador() {
        let scan = scan();

        // A pasta temporária existe em qualquer máquina, então a categoria
        // sempre mede — nunca se declara não suportada nem falha.
        assert_eq!(scan.category, ScanCategory::UserTemp);
        assert!(
            scan.status.has_measurement(),
            "status inesperado: {:?} — {:?}",
            scan.status,
            scan.message
        );
        assert_ne!(scan.status, ScanStatus::NotSupported);

        // A prova de que a análise não altera nada está em
        // `scanner::tests::a_analise_nao_altera_nada_no_disco`, que compara um
        // manifesto completo numa árvore isolada. Aqui não daria: outros testes
        // criam e removem arquivos na mesma pasta temporária em paralelo.
    }

    #[test]
    fn o_resultado_traz_o_texto_para_o_usuario() {
        let scan = scan();
        assert_eq!(scan.name, ScanCategory::UserTemp.name());
        assert!(scan.description.contains("programas"));
    }
}
