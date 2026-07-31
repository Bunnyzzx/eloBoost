//! Pasta Downloads — **somente medida**.
//!
//! Esta é a única categoria do scanner que toca uma pasta pessoal, e o requisito
//! é explícito: medir o tamanho, nunca oferecer remoção em lote (docs/05 §2). A
//! trava não é um comentário — está no tipo:
//! [`ScanCategory::removal_policy`] devolve `ManualSelectionOnly` para Downloads,
//! o resumo exclui a categoria do "espaço recuperável", e há um teste que quebra
//! se alguém mudar isso.
//!
//! O scanner não olha dentro dos arquivos, não lê nomes para fora desta função e
//! não os envia a lugar nenhum: o resultado é uma contagem e uma soma.

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, locations, ScanRoot};

const CATEGORY: ScanCategory = ScanCategory::Downloads;

/// Raízes desta categoria neste computador.
#[must_use]
pub fn roots() -> Vec<ScanRoot> {
    locations::user_profile()
        .map(|profile| vec![ScanRoot::recursive(profile.join("Downloads"))])
        .unwrap_or_default()
}

/// Analisa a categoria. Somente leitura, e sem qualquer sugestão de remoção.
#[must_use]
pub fn scan() -> CategoryScan {
    let roots = roots();
    if roots.is_empty() {
        return CategoryScan::not_found(
            CATEGORY,
            "Não foi possível localizar a pasta pessoal deste usuário.",
        );
    }
    scanner::scan_roots(CATEGORY, &roots)
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::models::scan_category::RemovalPolicy;

    #[test]
    fn downloads_nunca_e_oferecida_para_limpeza_em_lote() {
        // A trava de produto mais importante desta fonte.
        assert_eq!(scan().removal_policy, RemovalPolicy::ManualSelectionOnly);
    }

    #[test]
    fn a_raiz_e_a_subpasta_downloads_da_pasta_pessoal() {
        for root in roots() {
            assert!(
                root.path.ends_with("Downloads"),
                "raiz inesperada: {}",
                root.path.display()
            );
        }
    }

    #[test]
    fn a_descricao_avisa_que_sao_arquivos_do_usuario() {
        // O texto faz parte do contrato com o usuário: ele precisa saber que
        // esta linha do relatório é diferente das outras.
        let scan = scan();
        assert!(
            scan.description.contains("apenas mede"),
            "descrição sem o aviso: {}",
            scan.description
        );
    }
}
