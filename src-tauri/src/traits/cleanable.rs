//! O contrato que toda categoria limpável cumpre.
//!
//! O desenho central: **os quatro verbos têm implementação padrão**. Uma
//! categoria nova informa apenas quem é e onde vive; varredura, prévia,
//! validação e limpeza vêm de graça, idênticas para todas.
//!
//! ```ignore
//! impl Cleanable for UserTemp {
//!     fn category(&self) -> ScanCategory { ScanCategory::UserTemp }
//!     fn roots(&self) -> Vec<ScanRoot> { sources::user_temp::roots() }
//! }
//! ```
//!
//! É o que impede a duplicação que o produto não pode ter: se cada categoria
//! escrevesse a própria caminhada, existiriam sete implementações de "nunca
//! seguir link" — e só uma delas seria revisada com o cuidado devido.
//!
//! O mesmo contrato será usado pelos Épicos seguintes (otimizações,
//! inicialização, aplicativos): o que muda é a fonte, nunca o motor.

use crate::cleaner::validator::PathGuard;
use crate::cleaner::{engine, CleanObserver};
use crate::models::clean_preview::CategoryPreview;
use crate::models::clean_result::CategoryCleanResult;
use crate::models::scan_category::{RemovalPolicy, ScanCategory};
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, ScanRoot};

/// Uma área do sistema que o eloBoost sabe medir e — quando a política permitir
/// — limpar.
pub trait Cleanable: Send + Sync {
    /// Identificador estável da categoria.
    fn category(&self) -> ScanCategory;

    /// Onde esta área vive **neste** computador.
    ///
    /// Sempre resolvido no backend. Nenhuma raiz vem da interface.
    fn roots(&self) -> Vec<ScanRoot>;

    /// Se a categoria pode ser removida em lote.
    ///
    /// O padrão respeita a política declarada no modelo: Downloads é a única
    /// área pessoal, e ela nunca é limpa em lote (docs/05 §2).
    fn is_cleanable(&self) -> bool {
        matches!(self.category().removal_policy(), RemovalPolicy::Cleanable)
    }

    /// Mede a área. Somente leitura.
    fn scan(&self) -> CategoryScan {
        let roots = self.roots();
        if roots.is_empty() {
            return CategoryScan::not_found(
                self.category(),
                "Esta área não existe neste computador.",
            );
        }
        scanner::scan_roots(self.category(), &roots)
    }

    /// Descreve o que aconteceria numa limpeza. **Não remove nada.**
    fn preview(&self) -> CategoryPreview {
        CategoryPreview::from_scan(&self.scan(), self.is_cleanable())
    }

    /// Constrói os guardas das raízes desta categoria.
    ///
    /// Uma raiz sem guarda é uma raiz que **não será limpa**: o guarda só é
    /// criado quando a pasta existe, é um diretório de verdade, não é link e
    /// não está numa área proibida.
    fn validate(&self) -> Vec<PathGuard> {
        self.roots()
            .iter()
            .filter_map(|root| PathGuard::for_root(&root.path).map(|guard| (guard, root)))
            .map(|(guard, _)| guard)
            .collect()
    }

    /// Limpa a área, publicando o progresso no observador.
    ///
    /// Uma categoria não limpável nunca chega aqui — a Engine a recusa antes —,
    /// mas a verificação é repetida por segurança: uma trava de produto que
    /// existe num lugar só é uma trava que uma refatoração remove sem perceber.
    fn clean(&self, observer: &dyn CleanObserver) -> CategoryCleanResult {
        if !self.is_cleanable() {
            return CategoryCleanResult::skipped(self.category());
        }
        engine::clean_roots(self.category(), &self.roots(), observer)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cleaner::SilentObserver;
    use crate::models::clean_preview::CleanEligibility;
    use crate::models::clean_result::CleanStatus;

    use std::path::PathBuf;

    /// Categoria de teste apontando para uma pasta que não existe.
    struct AreaInexistente;

    impl Cleanable for AreaInexistente {
        fn category(&self) -> ScanCategory {
            ScanCategory::UserTemp
        }
        fn roots(&self) -> Vec<ScanRoot> {
            vec![ScanRoot::recursive(PathBuf::from(
                "/eloboost-area-que-nao-existe",
            ))]
        }
    }

    /// Categoria de teste que se declara não limpável.
    struct AreaPessoal;

    impl Cleanable for AreaPessoal {
        fn category(&self) -> ScanCategory {
            ScanCategory::Downloads
        }
        fn roots(&self) -> Vec<ScanRoot> {
            vec![ScanRoot::recursive(std::env::temp_dir())]
        }
    }

    #[test]
    fn uma_categoria_so_precisa_declarar_quem_e_e_onde_vive() {
        // O ponto do contrato: `scan`, `preview`, `validate` e `clean` não
        // foram escritos por `AreaInexistente`, e ainda assim funcionam.
        let scan = AreaInexistente.scan();
        assert_eq!(scan.category, ScanCategory::UserTemp);
        assert_eq!(scan.size_bytes, 0);
    }

    #[test]
    fn a_previa_de_uma_area_ausente_nao_e_selecionavel() {
        let preview = AreaInexistente.preview();
        assert_eq!(preview.eligibility, CleanEligibility::Unavailable);
    }

    #[test]
    fn uma_raiz_inexistente_nao_produz_guarda() {
        // Sem guarda, não há remoção possível naquela raiz.
        assert!(AreaInexistente.validate().is_empty());
    }

    #[test]
    fn a_politica_de_area_pessoal_vem_do_modelo() {
        assert!(!AreaPessoal.is_cleanable());
        assert!(AreaInexistente.is_cleanable());
    }

    #[test]
    fn uma_area_pessoal_nunca_e_limpa_mesmo_chamando_clean_direto() {
        // A trava repetida: mesmo que a Engine falhasse em filtrar, o contrato
        // recusa. Note que a raiz é a pasta temporária real — se a limpeza
        // acontecesse, o teste destruiria o ambiente.
        let resultado = AreaPessoal.clean(&SilentObserver);

        assert_eq!(resultado.status, CleanStatus::Skipped);
        assert_eq!(resultado.removed_files, 0);
        assert_eq!(resultado.freed_bytes, 0);
    }
}
