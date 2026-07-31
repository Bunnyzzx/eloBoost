//! Monta a prévia: o que aconteceria se o usuário confirmasse.
//!
//! **Somente leitura.** É a mesma varredura do Épico 2 — mesmo motor, mesmas
//! regras — com a política de limpeza aplicada por cima. Nenhum arquivo é
//! aberto, movido ou removido para produzir estes números.

use std::time::Instant;

use crate::cleaner::registry;
use crate::models::clean_preview::{CategoryPreview, CleanPreview};
use crate::models::scan_category::ScanCategory;
use crate::scanner;

/// Produz a prévia de todas as categorias conhecidas.
///
/// Cada categoria roda numa thread de bloqueio própria, como no scanner: são
/// varreduras de disco, e a mais lenta não deve segurar as outras.
///
/// As categorias **não selecionáveis também aparecem** — Downloads com o seu
/// tamanho real, áreas ausentes com o motivo. Esconder o que não pode ser limpo
/// deixaria o usuário sem entender por que o total não bate com o do scanner.
pub async fn build(preview_id: String, confirmation_token: String) -> CleanPreview {
    let started = Instant::now();

    let mut running = tokio::task::JoinSet::new();
    for category in ScanCategory::ALL {
        running.spawn_blocking(move || {
            let source = registry::for_category(category);
            (category, source.preview())
        });
    }

    let mut previews: Vec<CategoryPreview> = Vec::with_capacity(ScanCategory::ALL.len());

    while let Some(joined) = running.join_next().await {
        match joined {
            Ok((_, preview)) => previews.push(preview),
            Err(error) => {
                tracing::error!(erro = %error, "uma categoria falhou ao montar a prévia");
            }
        }
    }

    // Completa o que faltar, para que a tela sempre tenha uma linha por
    // categoria. Uma ausência silenciosa seria pior que um aviso.
    for category in ScanCategory::ALL {
        if !previews.iter().any(|preview| preview.category == category) {
            let scan = crate::models::scan_result::CategoryScan::failed(
                category,
                "Esta área não pôde ser analisada.",
            );
            previews.push(CategoryPreview::from_scan(&scan, false));
        }
    }

    // Ordem de exibição, não de conclusão.
    previews.sort_by_key(|preview| {
        ScanCategory::ALL
            .iter()
            .position(|category| *category == preview.category)
            .unwrap_or(usize::MAX)
    });

    let preview = CleanPreview::new(
        preview_id,
        confirmation_token,
        previews,
        scanner::elapsed_ms(started),
    );

    tracing::info!(
        preview_id = %preview.preview_id,
        selecionaveis = preview.selectable_categories,
        bytes = preview.removable_bytes,
        "prévia de limpeza montada — nenhum arquivo foi removido"
    );

    preview
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::clean_preview::CleanEligibility;

    #[tokio::test]
    async fn a_previa_cobre_todas_as_categorias_conhecidas() {
        let preview = build("prev".into(), "tok".into()).await;

        assert_eq!(preview.categories.len(), ScanCategory::ALL.len());
        for category in ScanCategory::ALL {
            assert!(
                preview.categories.iter().any(|p| p.category == category),
                "{category:?} ausente da prévia"
            );
        }
    }

    #[tokio::test]
    async fn a_previa_sai_na_ordem_de_exibicao() {
        let preview = build("prev".into(), "tok".into()).await;

        let obtida: Vec<ScanCategory> = preview.categories.iter().map(|p| p.category).collect();
        assert_eq!(obtida, ScanCategory::ALL.to_vec());
    }

    #[tokio::test]
    async fn downloads_aparece_na_previa_mas_nunca_selecionavel() {
        let preview = build("prev".into(), "tok".into()).await;

        let downloads = preview
            .categories
            .iter()
            .find(|p| p.category == ScanCategory::Downloads)
            .expect("Downloads na prévia");

        assert_eq!(downloads.eligibility, CleanEligibility::ReadOnlyArea);
        assert!(!preview.selectable().contains(&ScanCategory::Downloads));
    }

    #[tokio::test]
    async fn a_lixeira_aparece_medida_e_nao_selecionavel() {
        let preview = build("prev".into(), "tok".into()).await;

        let lixeira = preview
            .categories
            .iter()
            .find(|p| p.category == ScanCategory::RecycleBin)
            .expect("Lixeira na prévia");

        assert!(!lixeira.eligibility.is_selectable());
    }

    #[tokio::test]
    async fn montar_a_previa_nao_altera_a_pasta_temporaria() {
        // A prévia percorre %TEMP% de verdade. Uma sentinela prova que a
        // travessia continua somente leitura.
        let sentinela = std::env::temp_dir().join(format!(
            "eloboost-previa-sentinela-{}.tmp",
            elo_core::new_operation_id()
        ));
        std::fs::write(&sentinela, b"conteudo da sentinela").expect("criar sentinela");
        let antes = std::fs::metadata(&sentinela).expect("metadados").len();

        let _ = build("prev".into(), "tok".into()).await;

        let conteudo = std::fs::read(&sentinela).expect("a sentinela deve continuar existindo");
        let depois = std::fs::metadata(&sentinela).expect("metadados").len();
        let _ = std::fs::remove_file(&sentinela);

        assert_eq!(conteudo, b"conteudo da sentinela");
        assert_eq!(antes, depois);
    }

    #[tokio::test]
    async fn o_total_da_previa_conta_apenas_o_selecionavel() {
        let preview = build("prev".into(), "tok".into()).await;

        let soma_selecionavel: u64 = preview
            .categories
            .iter()
            .filter(|p| p.eligibility.is_selectable())
            .map(|p| p.size_bytes)
            .sum();

        assert_eq!(preview.removable_bytes, soma_selecionavel);
    }
}
