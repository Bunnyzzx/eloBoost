//! Resumo de uma análise completa do computador.
//!
//! Agrega os resultados por categoria em números que a interface exibe sem
//! precisar somar nada — a regra de negócio de "o que conta como recuperável"
//! vive aqui, no backend, e não na tela.

use serde::Serialize;

use crate::models::scan_category::RemovalPolicy;
use crate::models::scan_result::CategoryScan;

/// O retrato completo de uma análise.
///
/// **Nada foi removido para produzir estes números.** O scanner abre diretórios
/// para leitura e consulta tamanhos; não existe caminho de código no Épico 2 que
/// escreva, renomeie ou apague qualquer coisa.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    /// Identificador desta análise, correlacionável com o log técnico.
    pub scan_id: String,
    /// Resultado de cada categoria, na ordem de exibição.
    pub categories: Vec<CategoryScan>,
    /// Espaço que **poderia** ser liberado numa limpeza futura.
    ///
    /// Exclui Downloads de propósito: é uma pasta pessoal, medida apenas para
    /// informar. Somá-la aqui prometeria um espaço que o eloBoost não vai
    /// oferecer para apagar em lote (docs/05 §2).
    pub reclaimable_bytes: u64,
    /// Soma de tudo o que foi medido, incluindo Downloads.
    pub measured_bytes: u64,
    /// Arquivos encontrados em todas as categorias.
    pub total_files: u64,
    /// Pastas percorridas em todas as categorias.
    pub total_folders: u64,
    /// Quanto tempo a análise inteira levou.
    pub duration_ms: u64,
    /// Quantas categorias produziram medição.
    pub measured_categories: u32,
    /// Quando a análise terminou, em ISO-8601 UTC.
    pub finished_at: String,
}

impl ScanSummary {
    /// Monta o resumo a partir dos resultados das categorias.
    ///
    /// Só entram no total as categorias que efetivamente mediram algo: uma
    /// pasta inexistente contribui com zero, e uma que falhou não é somada nem
    /// tratada como zero — a diferença aparece em `measured_categories`.
    #[must_use]
    pub fn from_categories(
        scan_id: String,
        categories: Vec<CategoryScan>,
        duration_ms: u64,
    ) -> Self {
        let measured = categories
            .iter()
            .filter(|scan| scan.status.has_measurement());

        let mut reclaimable_bytes = 0_u64;
        let mut measured_bytes = 0_u64;
        let mut total_files = 0_u64;
        let mut total_folders = 0_u64;
        let mut measured_categories = 0_u32;

        for scan in measured {
            measured_bytes = measured_bytes.saturating_add(scan.size_bytes);
            total_files = total_files.saturating_add(scan.file_count);
            total_folders = total_folders.saturating_add(scan.folder_count);
            measured_categories += 1;

            if matches!(scan.removal_policy, RemovalPolicy::Cleanable) {
                reclaimable_bytes = reclaimable_bytes.saturating_add(scan.size_bytes);
            }
        }

        Self {
            scan_id,
            categories,
            reclaimable_bytes,
            measured_bytes,
            total_files,
            total_folders,
            duration_ms,
            measured_categories,
            finished_at: elo_core::now_iso8601(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_category::ScanCategory;
    use crate::models::scan_result::{ScanStatus, SkippedItems};

    fn medida(category: ScanCategory, size_bytes: u64, file_count: u64) -> CategoryScan {
        CategoryScan {
            category,
            name: category.name(),
            description: category.description(),
            removal_policy: category.removal_policy(),
            file_count,
            folder_count: 1,
            size_bytes,
            duration_ms: 5,
            status: ScanStatus::Completed,
            message: None,
            skipped: SkippedItems::default(),
        }
    }

    #[test]
    fn soma_arquivos_pastas_e_tamanho_das_categorias_medidas() {
        let resumo = ScanSummary::from_categories(
            "scan-1".into(),
            vec![
                medida(ScanCategory::UserTemp, 1_000, 10),
                medida(ScanCategory::Thumbnails, 500, 4),
            ],
            42,
        );

        assert_eq!(resumo.measured_bytes, 1_500);
        assert_eq!(resumo.total_files, 14);
        assert_eq!(resumo.total_folders, 2);
        assert_eq!(resumo.measured_categories, 2);
        assert_eq!(resumo.duration_ms, 42);
    }

    #[test]
    fn downloads_e_medido_mas_nao_entra_no_espaco_recuperavel() {
        // O ponto do campo: o número grande na tela não pode incluir uma pasta
        // pessoal que o eloBoost jamais vai apagar em lote.
        let resumo = ScanSummary::from_categories(
            "scan-2".into(),
            vec![
                medida(ScanCategory::UserTemp, 1_000, 1),
                medida(ScanCategory::Downloads, 9_000, 1),
            ],
            1,
        );

        assert_eq!(resumo.measured_bytes, 10_000);
        assert_eq!(resumo.reclaimable_bytes, 1_000);
    }

    #[test]
    fn categoria_que_falhou_nao_conta_como_zero() {
        let resumo = ScanSummary::from_categories(
            "scan-3".into(),
            vec![
                medida(ScanCategory::UserTemp, 700, 3),
                CategoryScan::failed(ScanCategory::Logs, "Sem permissão."),
                CategoryScan::not_supported(ScanCategory::RecycleBin, "Somente no Windows."),
            ],
            9,
        );

        // Três categorias no relatório, uma só medida — a interface consegue
        // dizer "1 de 3 áreas analisadas" sem inventar zeros.
        assert_eq!(resumo.categories.len(), 3);
        assert_eq!(resumo.measured_categories, 1);
        assert_eq!(resumo.measured_bytes, 700);
    }

    #[test]
    fn uma_analise_sem_nada_encontrado_e_valida() {
        let resumo = ScanSummary::from_categories("scan-4".into(), Vec::new(), 0);

        assert_eq!(resumo.measured_bytes, 0);
        assert_eq!(resumo.reclaimable_bytes, 0);
        assert_eq!(resumo.measured_categories, 0);
        assert!(!resumo.finished_at.is_empty());
    }

    #[test]
    fn o_resumo_serializa_em_camel_case_para_a_interface() {
        let resumo = ScanSummary::from_categories(
            "scan-5".into(),
            vec![medida(ScanCategory::UserTemp, 1, 1)],
            3,
        );
        let json = serde_json::to_value(&resumo).expect("serialização");

        assert!(json["reclaimableBytes"].is_number());
        assert!(json["totalFiles"].is_number());
        assert!(json["measuredCategories"].is_number());
        assert_eq!(json["categories"][0]["category"], "user_temp");
    }
}
