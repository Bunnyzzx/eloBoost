//! Catálogo das categorias que a Engine conhece.
//!
//! Cada categoria é um tipo sem estado que implementa
//! [`Cleanable`](crate::traits::cleanable::Cleanable) informando **apenas** quem
//! é e onde vive. Varredura, prévia, validação e limpeza vêm do contrato — é
//! isto que garante que não existam sete implementações de "nunca seguir link".
//!
//! Acrescentar uma categoria no futuro é: uma variante em `ScanCategory`, uma
//! função `roots()` na fonte correspondente, e cinco linhas aqui.
//!
//! O catálogo é **fechado**: a interface envia identificadores e recebe
//! identificadores; nada aqui é construído a partir de texto vindo do frontend.

use crate::models::scan_category::ScanCategory;
use crate::scanner::{sources, ScanRoot};
use crate::traits::cleanable::Cleanable;

/// Gera as implementações do contrato — todas idênticas em forma.
///
/// A macro existe para que a diferença entre uma categoria e outra fique
/// visível numa linha, em vez de enterrada em sete blocos quase iguais que a
/// revisão passa a ler na diagonal.
macro_rules! categoria {
    ($tipo:ident, $variante:ident, $fonte:path) => {
        /// Categoria do catálogo.
        pub struct $tipo;

        impl Cleanable for $tipo {
            fn category(&self) -> ScanCategory {
                ScanCategory::$variante
            }

            fn roots(&self) -> Vec<ScanRoot> {
                $fonte()
            }
        }
    };
}

categoria!(UserTemp, UserTemp, sources::user_temp::roots);
categoria!(WindowsTemp, WindowsTemp, sources::windows_temp::roots);
categoria!(Thumbnails, Thumbnails, sources::thumbnails::roots);
categoria!(Logs, Logs, sources::logs::roots);
categoria!(BrowserCache, BrowserCache, sources::browser_cache::roots);
categoria!(Downloads, Downloads, sources::downloads::roots);

/// Lixeira: medida pela API oficial do Windows, sem caminhada de diretório.
///
/// Esvaziar a Lixeira exige `SHEmptyRecycleBin`, que é uma operação de outra
/// natureza — com o seu próprio diálogo de confirmação do Windows e a decisão
/// D-2 de `docs/10` ainda em aberto. Enquanto isso, a categoria continua
/// **somente leitura**: aparece na prévia com o tamanho real e não é
/// selecionável.
pub struct RecycleBin;

impl Cleanable for RecycleBin {
    fn category(&self) -> ScanCategory {
        ScanCategory::RecycleBin
    }

    fn roots(&self) -> Vec<ScanRoot> {
        // Sem raízes: `$Recycle.Bin` nunca é percorrido à mão.
        Vec::new()
    }

    fn is_cleanable(&self) -> bool {
        false
    }

    fn scan(&self) -> crate::models::scan_result::CategoryScan {
        sources::recycle_bin::scan()
    }
}

/// Devolve a implementação de uma categoria.
///
/// O `match` é exaustivo: acrescentar uma variante em [`ScanCategory`] sem
/// registrá-la aqui **não compila**.
#[must_use]
pub fn for_category(category: ScanCategory) -> Box<dyn Cleanable> {
    match category {
        ScanCategory::UserTemp => Box::new(UserTemp),
        ScanCategory::WindowsTemp => Box::new(WindowsTemp),
        ScanCategory::RecycleBin => Box::new(RecycleBin),
        ScanCategory::Thumbnails => Box::new(Thumbnails),
        ScanCategory::Logs => Box::new(Logs),
        ScanCategory::Downloads => Box::new(Downloads),
        ScanCategory::BrowserCache => Box::new(BrowserCache),
    }
}

/// Todas as categorias do catálogo, na ordem de exibição.
#[must_use]
pub fn all() -> Vec<Box<dyn Cleanable>> {
    ScanCategory::ALL.into_iter().map(for_category).collect()
}

/// Categorias que podem ser limpas em lote nesta versão.
#[must_use]
pub fn cleanable_categories() -> Vec<ScanCategory> {
    all()
        .iter()
        .filter(|item| item.is_cleanable())
        .map(|item| item.category())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toda_categoria_conhecida_tem_implementacao() {
        for category in ScanCategory::ALL {
            assert_eq!(for_category(category).category(), category);
        }
    }

    #[test]
    fn o_catalogo_cobre_exatamente_as_categorias_do_modelo() {
        assert_eq!(all().len(), ScanCategory::ALL.len());
    }

    #[test]
    fn downloads_e_a_lixeira_nunca_sao_limpaveis() {
        // A trava de produto do Épico 3: as duas áreas que envolvem escolha do
        // usuário — arquivos pessoais e itens já descartados — ficam de fora da
        // limpeza em lote.
        assert!(!for_category(ScanCategory::Downloads).is_cleanable());
        assert!(!for_category(ScanCategory::RecycleBin).is_cleanable());
    }

    #[test]
    fn as_cinco_categorias_do_epico_sao_limpaveis() {
        let limpaveis = cleanable_categories();

        assert_eq!(limpaveis.len(), 5);
        for esperada in [
            ScanCategory::UserTemp,
            ScanCategory::WindowsTemp,
            ScanCategory::Thumbnails,
            ScanCategory::Logs,
            ScanCategory::BrowserCache,
        ] {
            assert!(
                limpaveis.contains(&esperada),
                "{esperada:?} deveria ser limpável"
            );
        }
    }

    #[test]
    fn a_lixeira_nao_expoe_raiz_para_caminhada() {
        // Se um dia alguém devolver uma raiz aqui, a Engine passaria a percorrer
        // `$Recycle.Bin` à mão — exatamente o que docs/05 §2 proíbe.
        assert!(RecycleBin.roots().is_empty());
    }

    #[test]
    fn toda_raiz_de_categoria_limpavel_e_absoluta() {
        for category in cleanable_categories() {
            for root in for_category(category).roots() {
                assert!(
                    root.path.is_absolute(),
                    "{category:?} devolveu raiz relativa: {}",
                    root.path.display()
                );
            }
        }
    }
}
