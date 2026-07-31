//! Comandos da Engine de Limpeza.
//!
//! Três comandos nomeados, nenhum genérico, **nenhum recebendo caminho**
//! (docs/05 §3). A interface envia identificadores de categoria e o par
//! prévia + token; o backend decide o resto.
//!
//! A separação entre `cleaner_preview` e `cleaner_execute` não é organização de
//! código: é a garantia estrutural de que nada é removido sem o usuário ter
//! visto o que seria removido.

use elo_core::{AppError, AppResult, ErrorCode};
use tauri::Emitter as _;

use crate::cleaner::{report, CleanObserver};
use crate::models::clean_preview::CleanPreview;
use crate::models::clean_report::{CleanReport, HistoryEntry};
use crate::models::clean_result::CategoryCleanResult;
use crate::models::scan_category::ScanCategory;
use crate::services::cleaner_service::{self, ExecutionRefusal};
use crate::state::AppState;

/// Evento com o resultado final de uma categoria.
pub const CATEGORY_EVENT: &str = "cleaner://category";
/// Evento de avanço dentro de uma categoria.
pub const PROGRESS_EVENT: &str = "cleaner://progress";

/// Avanço parcial publicado para a interface.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    category: ScanCategory,
    removed_files: u64,
    freed_bytes: u64,
}

/// Publica o progresso da limpeza como eventos da janela.
///
/// Uma falha de emissão é registrada e ignorada: perder um evento atrasa a
/// atualização de um card, mas o relatório final chega pelo retorno do comando.
struct WindowObserver<'a> {
    app: &'a tauri::AppHandle,
}

impl CleanObserver for WindowObserver<'_> {
    fn category_started(&self, category: ScanCategory) {
        let started = CategoryCleanResult {
            status: crate::models::clean_result::CleanStatus::Running,
            ..CategoryCleanResult::pending(category)
        };
        self.emit(CATEGORY_EVENT, &started);
    }

    fn category_progress(&self, category: ScanCategory, removed_files: u64, freed_bytes: u64) {
        self.emit(
            PROGRESS_EVENT,
            &ProgressPayload {
                category,
                removed_files,
                freed_bytes,
            },
        );
    }

    fn category_finished(&self, result: &CategoryCleanResult) {
        self.emit(CATEGORY_EVENT, result);
    }
}

impl WindowObserver<'_> {
    fn emit<T: serde::Serialize + Clone>(&self, event: &str, payload: &T) {
        if let Err(error) = self.app.emit(event, payload) {
            tracing::warn!(evento = event, erro = %error, "não foi possível publicar o progresso da limpeza");
        }
    }
}

/// Monta a prévia da limpeza. **Somente leitura.**
///
/// Devolve, junto dos números, o identificador da prévia e o token que
/// `cleaner_execute` vai exigir. Sem passar por aqui não existe execução.
///
/// # Errors
/// Não falha: uma área que não pôde ser analisada vira uma linha da prévia com
/// o motivo. A assinatura mantém o contrato de erros uniforme.
#[allow(
    clippy::needless_pass_by_value,
    reason = "`tauri::State` é sempre injetado por valor pelo macro de comando"
)]
#[tauri::command]
pub async fn cleaner_preview(state: tauri::State<'_, AppState>) -> AppResult<CleanPreview> {
    Ok(cleaner_service::build_preview(&state.cleaner).await)
}

/// Executa a limpeza das categorias confirmadas.
///
/// Exige o par `previewId` + `confirmationToken` emitido por `cleaner_preview`.
/// O token é de uso único e expira em cinco minutos.
///
/// # Errors
/// Devolve `ConfirmationRequired` quando não há confirmação válida e
/// `ConfirmationExpired` quando ela passou do prazo. Falhas de remoção não são
/// erro: viram contadores no relatório.
#[allow(
    clippy::needless_pass_by_value,
    reason = "`tauri::State` e `AppHandle` são sempre injetados por valor"
)]
#[tauri::command]
pub async fn cleaner_execute(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    preview_id: String,
    confirmation_token: String,
    categories: Vec<ScanCategory>,
) -> AppResult<CleanReport> {
    let observer = WindowObserver { app: &app };

    let result = cleaner_service::execute(
        &state.cleaner,
        &preview_id,
        &confirmation_token,
        &categories,
        &observer,
    )
    .await;

    let report = result.map_err(|refusal| {
        let code = match refusal {
            ExecutionRefusal::NotConfirmed => ErrorCode::ConfirmationRequired,
            ExecutionRefusal::Expired => ErrorCode::ConfirmationExpired,
        };
        AppError::new(code).with_message(refusal.message())
    })?;

    // O histórico é diagnóstico: se a escrita falhar, os arquivos já saíram do
    // disco e dizer que a limpeza falhou seria mentira.
    if let Err(error) = report::record(&state.database, &report) {
        tracing::error!(erro = %error, "não foi possível registrar a limpeza no histórico");
    }

    Ok(report)
}

/// Lista as operações mais recentes do histórico.
///
/// Informativo apenas — o Épico 3 não implementa restauração.
///
/// # Errors
/// Devolve `DatabaseError` se a consulta falhar.
#[allow(
    clippy::needless_pass_by_value,
    reason = "`tauri::State` é sempre injetado por valor pelo macro de comando"
)]
#[tauri::command]
pub fn history_list_recent(
    state: tauri::State<'_, AppState>,
    limit: Option<u32>,
) -> AppResult<Vec<HistoryEntry>> {
    // Teto fixo: um `limit` vindo da interface não pode pedir a tabela inteira.
    let limit = limit.unwrap_or(50).min(200);
    report::recent(&state.database, limit)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn os_nomes_dos_eventos_sao_estaveis() {
        // A interface se inscreve nestas strings: mudá-las quebraria o
        // progresso sem quebrar a compilação.
        assert_eq!(CATEGORY_EVENT, "cleaner://category");
        assert_eq!(PROGRESS_EVENT, "cleaner://progress");
    }

    #[test]
    fn cada_recusa_tem_mensagem_para_o_usuario() {
        for refusal in [ExecutionRefusal::NotConfirmed, ExecutionRefusal::Expired] {
            let message = refusal.message();
            assert!(!message.is_empty());
            assert!(message.ends_with('.'), "mensagem incompleta: {message}");
        }
    }

    #[test]
    fn o_avanco_serializa_em_camel_case() {
        let json = serde_json::to_value(ProgressPayload {
            category: ScanCategory::UserTemp,
            removed_files: 10,
            freed_bytes: 2_048,
        })
        .expect("serialização");

        assert_eq!(json["category"], "user_temp");
        assert!(json["removedFiles"].is_number());
        assert!(json["freedBytes"].is_number());
    }
}
