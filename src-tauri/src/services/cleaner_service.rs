//! Orquestração da limpeza: prévia → confirmação → execução → histórico.
//!
//! O serviço guarda **uma** autorização pendente por vez. É o que torna
//! impossível executar sem ter visto a prévia: `execute` exige o par
//! `preview_id` + `token` que só `preview` emite, e consome a autorização ao
//! usá-la — um duplo clique não roda a limpeza duas vezes.

use std::sync::Mutex;
use std::time::{Instant, SystemTime};

use crate::cleaner::{preview, registry, CleanObserver};
use crate::models::clean_job::{ConfirmationCheck, PendingClean};
use crate::models::clean_preview::CleanPreview;
use crate::models::clean_report::CleanReport;
use crate::models::clean_result::CategoryCleanResult;
use crate::models::scan_category::ScanCategory;
use crate::scanner;

/// Guarda a autorização entre a prévia e a execução.
#[derive(Default)]
pub struct CleanerState {
    pending: Mutex<Option<PendingClean>>,
}

impl CleanerState {
    /// Cria o estado vazio.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Guarda a autorização recém-emitida, descartando a anterior.
    ///
    /// Uma prévia nova invalida a antiga de propósito: se o usuário reanalisou,
    /// os números mudaram, e a confirmação antiga descreve um disco que já não
    /// existe.
    fn store(&self, pending: PendingClean) {
        if let Ok(mut slot) = self.pending.lock() {
            *slot = Some(pending);
        }
    }

    /// Consome a autorização, se ela conferir.
    ///
    /// Devolve as categorias autorizadas junto do veredito. A autorização é
    /// removida em qualquer desfecho que não seja `Mismatch`: uma expirada não
    /// deve ficar ocupando o lugar, e uma usada não pode ser reaproveitada.
    fn consume(
        &self,
        preview_id: &str,
        token: &str,
        now: SystemTime,
    ) -> (ConfirmationCheck, Vec<ScanCategory>) {
        let Ok(mut slot) = self.pending.lock() else {
            return (ConfirmationCheck::Missing, Vec::new());
        };

        let Some(pending) = slot.as_ref() else {
            return (ConfirmationCheck::Missing, Vec::new());
        };

        if !pending.matches(preview_id, token) {
            return (ConfirmationCheck::Mismatch, Vec::new());
        }
        if !pending.is_valid_at(now) {
            *slot = None;
            return (ConfirmationCheck::Expired, Vec::new());
        }

        let categories = pending.categories.clone();
        *slot = None;
        (ConfirmationCheck::Authorized, categories)
    }
}

/// Monta a prévia e emite a autorização correspondente.
///
/// **Somente leitura.** Nada é removido aqui.
pub async fn build_preview(state: &CleanerState) -> CleanPreview {
    let preview_id = elo_core::new_operation_id();
    let token = elo_core::new_operation_id();

    let preview = preview::build(preview_id.clone(), token.clone()).await;

    state.store(PendingClean {
        preview_id,
        token,
        categories: preview.selectable(),
        created_at: SystemTime::now(),
    });

    preview
}

/// Motivo pelo qual uma execução foi recusada.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExecutionRefusal {
    /// Não há prévia pendente, ou a confirmação não confere.
    NotConfirmed,
    /// A confirmação expirou.
    Expired,
}

impl ExecutionRefusal {
    /// Mensagem exibida ao usuário.
    #[must_use]
    pub const fn message(self) -> &'static str {
        match self {
            Self::NotConfirmed => {
                "Esta limpeza não foi confirmada. Analise novamente antes de continuar."
            }
            Self::Expired => {
                "A confirmação expirou. Analise novamente para atualizar os resultados."
            }
        }
    }
}

/// Executa a limpeza das categorias selecionadas.
///
/// A seleção do usuário é **intersectada** com a autorização emitida na prévia:
/// mesmo que a interface envie uma categoria a mais, ela não é limpa. A
/// interface propõe; o backend decide.
///
/// # Errors
/// Devolve o motivo quando a confirmação não confere ou expirou. Falhas de
/// remoção **não** são erro: viram contadores no relatório.
#[allow(
    clippy::unused_async,
    reason = "chamado de um comando Tauri assíncrono; `block_in_place` exige runtime multithread"
)]
pub async fn execute(
    state: &CleanerState,
    preview_id: &str,
    token: &str,
    selected: &[ScanCategory],
    observer: &dyn CleanObserver,
) -> Result<CleanReport, ExecutionRefusal> {
    let (check, authorized) = state.consume(preview_id, token, SystemTime::now());

    match check {
        ConfirmationCheck::Authorized => {}
        ConfirmationCheck::Expired => return Err(ExecutionRefusal::Expired),
        ConfirmationCheck::Missing | ConfirmationCheck::Mismatch => {
            return Err(ExecutionRefusal::NotConfirmed)
        }
    }

    let operation_id = elo_core::new_operation_id();
    let started = Instant::now();

    // Só entra o que o usuário marcou **e** a prévia autorizou.
    let to_clean: Vec<ScanCategory> = ScanCategory::ALL
        .into_iter()
        .filter(|category| selected.contains(category) && authorized.contains(category))
        .collect();

    tracing::info!(
        operation_id = %operation_id,
        categorias = to_clean.len(),
        "limpeza autorizada iniciada"
    );

    let mut results: Vec<CategoryCleanResult> = Vec::with_capacity(ScanCategory::ALL.len());

    // Sequencial de propósito: limpar várias áreas em paralelo disputaria o
    // mesmo disco, e o progresso ficaria impossível de acompanhar na tela. A
    // ordem é a de exibição, então os cards concluem de cima para baixo.
    for category in ScanCategory::ALL {
        if !to_clean.contains(&category) {
            let skipped = CategoryCleanResult::skipped(category);
            observer.category_finished(&skipped);
            results.push(skipped);
            continue;
        }

        let source = registry::for_category(category);
        let result = tokio::task::block_in_place(|| source.clean(observer));

        observer.category_finished(&result);
        results.push(result);
    }

    let report = CleanReport::from_categories(operation_id, results, scanner::elapsed_ms(started));

    tracing::info!(
        operation_id = %report.operation_id,
        bytes = report.freed_bytes,
        arquivos = report.removed_files,
        resultado = report.history_result(),
        "limpeza concluída"
    );

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cleaner::SilentObserver;
    use crate::models::clean_job::CONFIRMATION_TTL;
    use crate::models::clean_report::CleanOutcome;

    use std::time::Duration;

    fn autorizacao(categories: Vec<ScanCategory>, created_at: SystemTime) -> PendingClean {
        PendingClean {
            preview_id: "prev".into(),
            token: "tok".into(),
            categories,
            created_at,
        }
    }

    #[test]
    fn sem_previa_nenhuma_execucao_e_autorizada() {
        let state = CleanerState::new();
        let (check, _) = state.consume("prev", "tok", SystemTime::now());

        assert_eq!(check, ConfirmationCheck::Missing);
    }

    #[test]
    fn a_autorizacao_e_de_uso_unico() {
        let state = CleanerState::new();
        state.store(autorizacao(vec![ScanCategory::UserTemp], SystemTime::now()));

        let (primeira, _) = state.consume("prev", "tok", SystemTime::now());
        let (segunda, _) = state.consume("prev", "tok", SystemTime::now());

        // O duplo clique é o cenário real: a segunda chamada não pode limpar.
        assert_eq!(primeira, ConfirmationCheck::Authorized);
        assert_eq!(segunda, ConfirmationCheck::Missing);
    }

    #[test]
    fn um_token_errado_nao_consome_a_autorizacao() {
        let state = CleanerState::new();
        state.store(autorizacao(vec![ScanCategory::UserTemp], SystemTime::now()));

        let (errado, _) = state.consume("prev", "outro-token", SystemTime::now());
        let (certo, _) = state.consume("prev", "tok", SystemTime::now());

        assert_eq!(errado, ConfirmationCheck::Mismatch);
        assert_eq!(
            certo,
            ConfirmationCheck::Authorized,
            "uma tentativa inválida não pode invalidar a confirmação legítima"
        );
    }

    #[test]
    fn uma_confirmacao_expirada_e_recusada_e_descartada() {
        let state = CleanerState::new();
        let velha = SystemTime::now() - CONFIRMATION_TTL - Duration::from_secs(1);
        state.store(autorizacao(vec![ScanCategory::UserTemp], velha));

        let (expirada, _) = state.consume("prev", "tok", SystemTime::now());
        let (depois, _) = state.consume("prev", "tok", SystemTime::now());

        assert_eq!(expirada, ConfirmationCheck::Expired);
        assert_eq!(depois, ConfirmationCheck::Missing);
    }

    #[test]
    fn uma_previa_nova_invalida_a_anterior() {
        let state = CleanerState::new();
        state.store(autorizacao(vec![ScanCategory::UserTemp], SystemTime::now()));

        state.store(PendingClean {
            preview_id: "prev-2".into(),
            token: "tok-2".into(),
            categories: vec![ScanCategory::Logs],
            created_at: SystemTime::now(),
        });

        let (antiga, _) = state.consume("prev", "tok", SystemTime::now());
        assert_eq!(antiga, ConfirmationCheck::Mismatch);
    }

    #[tokio::test]
    async fn executar_sem_confirmacao_e_recusado() {
        let state = CleanerState::new();

        let erro = execute(
            &state,
            "inventado",
            "inventado",
            &[ScanCategory::UserTemp],
            &SilentObserver,
        )
        .await
        .expect_err("deveria recusar");

        assert_eq!(erro, ExecutionRefusal::NotConfirmed);
    }

    #[tokio::test]
    async fn a_selecao_da_interface_e_intersectada_com_a_autorizacao() {
        // O cenário que o desenho precisa cobrir: a interface pede para limpar
        // Downloads, que a prévia nunca autorizou.
        let state = CleanerState::new();
        state.store(autorizacao(Vec::new(), SystemTime::now()));

        let report = execute(
            &state,
            "prev",
            "tok",
            &[ScanCategory::Downloads, ScanCategory::UserTemp],
            &SilentObserver,
        )
        .await
        .expect("autorizada");

        // Nada foi executado: a autorização estava vazia.
        assert_eq!(report.executed_categories, 0);
        assert_eq!(report.freed_bytes, 0);
        assert_eq!(report.outcome, CleanOutcome::Success);
        assert!(report.categories.iter().all(|result| matches!(
            result.status,
            crate::models::clean_result::CleanStatus::Skipped
        )));
    }

    #[tokio::test]
    async fn o_relatorio_tem_uma_linha_por_categoria_conhecida() {
        let state = CleanerState::new();
        state.store(autorizacao(Vec::new(), SystemTime::now()));

        let report = execute(&state, "prev", "tok", &[], &SilentObserver)
            .await
            .expect("autorizada");

        assert_eq!(report.categories.len(), ScanCategory::ALL.len());
    }

    #[tokio::test]
    async fn a_previa_emite_uma_autorizacao_utilizavel() {
        let state = CleanerState::new();
        let preview = build_preview(&state).await;

        let (check, categorias) = state.consume(
            &preview.preview_id,
            &preview.confirmation_token,
            SystemTime::now(),
        );

        assert_eq!(check, ConfirmationCheck::Authorized);
        assert_eq!(categorias, preview.selectable());
        // Downloads e Lixeira nunca entram na autorização.
        assert!(!categorias.contains(&ScanCategory::Downloads));
        assert!(!categorias.contains(&ScanCategory::RecycleBin));
    }
}
