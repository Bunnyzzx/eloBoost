//! A prévia: exatamente o que aconteceria se o usuário confirmasse.
//!
//! Produzida por uma varredura **somente leitura**. Nenhum arquivo é aberto,
//! movido ou removido para montá-la — é o mesmo motor do Épico 2, com a política
//! de limpeza aplicada por cima.

use serde::Serialize;

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::{CategoryScan, SkippedItems};

/// O que o eloBoost pode fazer com uma categoria nesta máquina.
///
/// Separado de `RemovalPolicy` de propósito: aquela descreve a **regra de
/// produto** (Downloads nunca em lote), esta descreve a **situação concreta**
/// (a área existe? dá para ler?). Uma categoria limpável cuja pasta não existe
/// neste computador não é selecionável, e o motivo precisa aparecer na tela.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanEligibility {
    /// Pode ser selecionada e limpa.
    Selectable,
    /// Área pessoal: medida, nunca limpa em lote.
    ReadOnlyArea,
    /// Não há nada a remover.
    Empty,
    /// A área não existe ou não pôde ser analisada nesta máquina.
    Unavailable,
}

impl CleanEligibility {
    /// `true` quando a categoria pode entrar numa limpeza.
    #[must_use]
    pub const fn is_selectable(self) -> bool {
        matches!(self, Self::Selectable)
    }
}

/// A prévia de uma categoria.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryPreview {
    /// Identificador estável.
    pub category: ScanCategory,
    /// Nome exibido.
    pub name: &'static str,
    /// Explicação para o usuário.
    pub description: &'static str,
    /// Se pode ser selecionada, e por que não quando não pode.
    pub eligibility: CleanEligibility,
    /// Frase curta explicando a elegibilidade, quando ela não é óbvia.
    pub note: Option<String>,
    /// Arquivos que seriam removidos.
    pub file_count: u64,
    /// Pastas percorridas.
    pub folder_count: u64,
    /// Espaço que seria liberado.
    pub size_bytes: u64,
    /// O que a varredura da prévia já não conseguiu ler.
    pub skipped: SkippedItems,
}

impl CategoryPreview {
    /// Monta a prévia a partir de uma varredura e da política da categoria.
    ///
    /// A regra de elegibilidade vive aqui, no backend, e não na tela: a
    /// interface renderiza a decisão, não a toma.
    #[must_use]
    pub fn from_scan(scan: &CategoryScan, cleanable: bool) -> Self {
        let (eligibility, note) = if !cleanable {
            (
                CleanEligibility::ReadOnlyArea,
                Some(String::from(
                    "Área pessoal: o eloBoost mede o espaço, mas nunca remove nada daqui em lote.",
                )),
            )
        } else if !scan.status.has_measurement() {
            (
                CleanEligibility::Unavailable,
                scan.message.clone().or_else(|| {
                    Some(String::from(
                        "Esta área não pôde ser analisada neste computador.",
                    ))
                }),
            )
        } else if scan.file_count == 0 {
            (
                CleanEligibility::Empty,
                Some(String::from("Nada a remover — esta área já está limpa.")),
            )
        } else {
            (CleanEligibility::Selectable, scan.message.clone())
        };

        Self {
            category: scan.category,
            name: scan.name,
            description: scan.description,
            eligibility,
            note,
            file_count: scan.file_count,
            folder_count: scan.folder_count,
            size_bytes: scan.size_bytes,
            skipped: scan.skipped,
        }
    }
}

/// A prévia completa de uma limpeza.
///
/// **Nada foi removido para produzir estes números.**
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanPreview {
    /// Identifica esta prévia; precisa voltar na execução.
    pub preview_id: String,
    /// Token de confirmação de uso único.
    pub confirmation_token: String,
    /// Todas as categorias conhecidas, selecionáveis ou não.
    pub categories: Vec<CategoryPreview>,
    /// Soma do que seria removido nas categorias **selecionáveis**.
    pub removable_bytes: u64,
    /// Arquivos que seriam removidos nas categorias selecionáveis.
    pub removable_files: u64,
    /// Quantas categorias podem ser selecionadas.
    pub selectable_categories: u32,
    /// Quanto tempo a prévia levou.
    pub duration_ms: u64,
    /// Quando a prévia foi produzida, em ISO-8601 UTC.
    pub created_at: String,
}

impl CleanPreview {
    /// Monta a prévia completa, somando apenas o que é de fato selecionável.
    #[must_use]
    pub fn new(
        preview_id: String,
        confirmation_token: String,
        categories: Vec<CategoryPreview>,
        duration_ms: u64,
    ) -> Self {
        let mut removable_bytes = 0_u64;
        let mut removable_files = 0_u64;
        let mut selectable_categories = 0_u32;

        for preview in &categories {
            if !preview.eligibility.is_selectable() {
                continue;
            }
            removable_bytes = removable_bytes.saturating_add(preview.size_bytes);
            removable_files = removable_files.saturating_add(preview.file_count);
            selectable_categories += 1;
        }

        Self {
            preview_id,
            confirmation_token,
            categories,
            removable_bytes,
            removable_files,
            selectable_categories,
            duration_ms,
            created_at: elo_core::now_iso8601(),
        }
    }

    /// Categorias que o usuário pode marcar.
    #[must_use]
    pub fn selectable(&self) -> Vec<ScanCategory> {
        self.categories
            .iter()
            .filter(|preview| preview.eligibility.is_selectable())
            .map(|preview| preview.category)
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_result::ScanStatus;

    fn varredura(
        category: ScanCategory,
        status: ScanStatus,
        file_count: u64,
        size_bytes: u64,
    ) -> CategoryScan {
        CategoryScan {
            category,
            name: category.name(),
            description: category.description(),
            removal_policy: category.removal_policy(),
            file_count,
            folder_count: 2,
            size_bytes,
            duration_ms: 4,
            status,
            message: None,
            skipped: SkippedItems::default(),
        }
    }

    #[test]
    fn uma_area_com_conteudo_e_selecionavel() {
        let preview = CategoryPreview::from_scan(
            &varredura(ScanCategory::UserTemp, ScanStatus::Completed, 10, 5_000),
            true,
        );

        assert_eq!(preview.eligibility, CleanEligibility::Selectable);
        assert!(preview.eligibility.is_selectable());
    }

    #[test]
    fn downloads_nunca_e_selecionavel_mesmo_cheia() {
        // A trava de produto mais importante da prévia: uma pasta pessoal com
        // 10 GB continua não selecionável.
        let preview = CategoryPreview::from_scan(
            &varredura(
                ScanCategory::Downloads,
                ScanStatus::Completed,
                500,
                10_000_000_000,
            ),
            false,
        );

        assert_eq!(preview.eligibility, CleanEligibility::ReadOnlyArea);
        assert!(!preview.eligibility.is_selectable());
        assert!(preview
            .note
            .as_deref()
            .is_some_and(|n| n.contains("nunca remove")));
    }

    #[test]
    fn uma_area_vazia_nao_e_selecionavel_e_diz_por_que() {
        let preview = CategoryPreview::from_scan(
            &varredura(ScanCategory::Thumbnails, ScanStatus::Completed, 0, 0),
            true,
        );

        assert_eq!(preview.eligibility, CleanEligibility::Empty);
        assert!(preview
            .note
            .as_deref()
            .is_some_and(|n| n.contains("já está limpa")));
    }

    #[test]
    fn uma_area_indisponivel_nao_e_selecionavel() {
        let preview = CategoryPreview::from_scan(
            &varredura(ScanCategory::WindowsTemp, ScanStatus::NotSupported, 0, 0),
            true,
        );

        assert_eq!(preview.eligibility, CleanEligibility::Unavailable);
        assert!(preview.note.is_some());
    }

    #[test]
    fn o_total_da_previa_ignora_o_que_nao_pode_ser_selecionado() {
        let preview = CleanPreview::new(
            "prev".into(),
            "tok".into(),
            vec![
                CategoryPreview::from_scan(
                    &varredura(ScanCategory::UserTemp, ScanStatus::Completed, 10, 1_000),
                    true,
                ),
                CategoryPreview::from_scan(
                    &varredura(ScanCategory::Downloads, ScanStatus::Completed, 5, 9_000),
                    false,
                ),
                CategoryPreview::from_scan(
                    &varredura(ScanCategory::Logs, ScanStatus::NotSupported, 0, 0),
                    true,
                ),
            ],
            12,
        );

        // O número que a tela mostra é só o que seria de fato removido.
        assert_eq!(preview.removable_bytes, 1_000);
        assert_eq!(preview.removable_files, 10);
        assert_eq!(preview.selectable_categories, 1);
        assert_eq!(preview.selectable(), vec![ScanCategory::UserTemp]);
    }

    #[test]
    fn a_previa_serializa_em_camel_case_para_a_interface() {
        let preview = CleanPreview::new("prev".into(), "tok".into(), Vec::new(), 1);
        let json = serde_json::to_value(&preview).expect("serialização");

        assert!(json["removableBytes"].is_number());
        assert!(json["confirmationToken"].is_string());
        assert!(json["previewId"].is_string());
    }
}
