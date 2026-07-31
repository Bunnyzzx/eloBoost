//! O relatório final de uma limpeza.
//!
//! É o que a tela mostra no fim e o que vai para o histórico. O princípio é o
//! mesmo do Épico 2: nenhum número aqui é estimado. `freed_bytes` soma o tamanho
//! dos arquivos que **saíram do disco**, não o que a prévia prometia.

use serde::Serialize;

use crate::models::clean_result::{CategoryCleanResult, CleanSkips, CleanStatus};

/// Como terminou a limpeza inteira.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanOutcome {
    /// Todas as categorias selecionadas concluíram sem ressalvas.
    Success,
    /// Alguma categoria terminou parcialmente ou falhou.
    Partial,
    /// Nenhuma categoria conseguiu remover nada.
    Failed,
}

/// O relatório completo.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanReport {
    /// Identificador desta limpeza, correlacionável com o log e o histórico.
    pub operation_id: String,
    /// Como terminou.
    pub outcome: CleanOutcome,
    /// Uma linha por categoria selecionada, na ordem de exibição.
    pub categories: Vec<CategoryCleanResult>,
    /// Espaço realmente liberado.
    pub freed_bytes: u64,
    /// Arquivos realmente removidos.
    pub removed_files: u64,
    /// Pastas vazias removidas.
    pub removed_folders: u64,
    /// Tudo o que ficou para trás, somado por motivo.
    pub skipped: CleanSkips,
    /// Quantas categorias foram executadas.
    pub executed_categories: u32,
    /// Duração total.
    pub duration_ms: u64,
    /// Quando terminou, em ISO-8601 UTC.
    pub finished_at: String,
}

impl CleanReport {
    /// Agrega os resultados por categoria.
    #[must_use]
    pub fn from_categories(
        operation_id: String,
        categories: Vec<CategoryCleanResult>,
        duration_ms: u64,
    ) -> Self {
        let mut freed_bytes = 0_u64;
        let mut removed_files = 0_u64;
        let mut removed_folders = 0_u64;
        let mut skipped = CleanSkips::default();
        let mut executed_categories = 0_u32;
        let mut any_removed = false;
        let mut all_clean = true;

        for result in &categories {
            if matches!(result.status, CleanStatus::Skipped) {
                continue;
            }

            executed_categories += 1;
            freed_bytes = freed_bytes.saturating_add(result.freed_bytes);
            removed_files = removed_files.saturating_add(result.removed_files);
            removed_folders = removed_folders.saturating_add(result.removed_folders);
            skipped = skipped.merged(result.skipped);

            any_removed |= result.status.removed_something();
            all_clean &= matches!(result.status, CleanStatus::Completed);
        }

        let outcome = if executed_categories == 0 || all_clean {
            CleanOutcome::Success
        } else if any_removed {
            CleanOutcome::Partial
        } else {
            CleanOutcome::Failed
        };

        Self {
            operation_id,
            outcome,
            categories,
            freed_bytes,
            removed_files,
            removed_folders,
            skipped,
            executed_categories,
            duration_ms,
            finished_at: elo_core::now_iso8601(),
        }
    }

    /// Como o resultado é registrado no histórico (`activity_logs.result`).
    #[must_use]
    pub const fn history_result(&self) -> &'static str {
        match self.outcome {
            CleanOutcome::Success => "success",
            CleanOutcome::Partial => "partial",
            CleanOutcome::Failed => "failed",
        }
    }
}

/// Uma entrada do histórico, como a tela de Histórico a exibe.
///
/// Informativa apenas: o Épico 3 não implementa restauração, e nenhum campo
/// aqui sugere que ela exista.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    /// Identificador do registro.
    pub id: String,
    /// Operação correlacionada no log técnico.
    pub operation_id: String,
    /// Tipo da ação — `cleanup` neste Épico.
    pub action_type: String,
    /// Frase pronta para exibição.
    pub message: String,
    /// `success`, `partial`, `failed` ou `cancelled`.
    pub result: String,
    /// Arquivos afetados.
    pub affected_count: u64,
    /// Espaço liberado.
    pub released_bytes: u64,
    /// Quando aconteceu, em ISO-8601 UTC.
    pub created_at: String,
    /// Detalhe adicional já redigido — nunca caminhos.
    pub details: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_category::ScanCategory;

    fn concluida(category: ScanCategory, files: u64, bytes: u64) -> CategoryCleanResult {
        CategoryCleanResult {
            removed_files: files,
            freed_bytes: bytes,
            ..CategoryCleanResult::pending(category)
        }
        .finish(5)
    }

    #[test]
    fn soma_apenas_o_que_saiu_do_disco() {
        let report = CleanReport::from_categories(
            "op-1".into(),
            vec![
                concluida(ScanCategory::UserTemp, 100, 2_000),
                concluida(ScanCategory::Thumbnails, 20, 500),
            ],
            80,
        );

        assert_eq!(report.freed_bytes, 2_500);
        assert_eq!(report.removed_files, 120);
        assert_eq!(report.executed_categories, 2);
        assert_eq!(report.outcome, CleanOutcome::Success);
    }

    #[test]
    fn categoria_nao_selecionada_nao_entra_na_conta() {
        let report = CleanReport::from_categories(
            "op-2".into(),
            vec![
                concluida(ScanCategory::UserTemp, 10, 100),
                CategoryCleanResult::skipped(ScanCategory::Logs),
            ],
            10,
        );

        assert_eq!(report.executed_categories, 1);
        assert_eq!(report.freed_bytes, 100);
    }

    #[test]
    fn qualquer_ressalva_torna_o_resultado_parcial() {
        let parcial = CategoryCleanResult {
            removed_files: 9,
            freed_bytes: 900,
            skipped: CleanSkips {
                in_use: 1,
                ..CleanSkips::default()
            },
            ..CategoryCleanResult::pending(ScanCategory::UserTemp)
        }
        .finish(5);

        let report = CleanReport::from_categories("op-3".into(), vec![parcial], 5);

        assert_eq!(report.outcome, CleanOutcome::Partial);
        assert_eq!(report.history_result(), "partial");
        assert_eq!(report.skipped.in_use, 1);
    }

    #[test]
    fn nada_removido_em_lugar_nenhum_e_falha() {
        let report = CleanReport::from_categories(
            "op-4".into(),
            vec![CategoryCleanResult::failed(
                ScanCategory::WindowsTemp,
                "Sem permissão.",
            )],
            3,
        );

        assert_eq!(report.outcome, CleanOutcome::Failed);
        assert_eq!(report.freed_bytes, 0);
    }

    #[test]
    fn uma_limpeza_sem_categorias_selecionadas_nao_e_falha() {
        // O usuário desmarcou tudo e confirmou: nada aconteceu, e isso não é um
        // erro a reportar em vermelho.
        let report = CleanReport::from_categories("op-5".into(), Vec::new(), 0);

        assert_eq!(report.outcome, CleanOutcome::Success);
        assert_eq!(report.executed_categories, 0);
    }

    #[test]
    fn o_relatorio_serializa_em_camel_case_para_a_interface() {
        let report = CleanReport::from_categories(
            "op-6".into(),
            vec![concluida(ScanCategory::UserTemp, 1, 1)],
            2,
        );
        let json = serde_json::to_value(&report).expect("serialização");

        assert!(json["freedBytes"].is_number());
        assert!(json["removedFiles"].is_number());
        assert!(json["executedCategories"].is_number());
        assert_eq!(json["categories"][0]["category"], "user_temp");
    }
}
