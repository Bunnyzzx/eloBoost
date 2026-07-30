//! Comandos da análise do computador.
//!
//! **Somente leitura.** Nenhum comando aqui remove, move, renomeia ou altera
//! qualquer arquivo. Os dois comandos são nomeados e não recebem caminho algum
//! da interface — o frontend pede "analise o computador", e o backend decide
//! quais áreas conhece (docs/05 §3).

use elo_core::AppResult;
use tauri::Emitter as _;

use crate::models::scan_result::CategoryScan;
use crate::models::scan_summary::ScanSummary;
use crate::services::scanner_service::{self, ScanObserver, CATEGORY_EVENT, FINISHED_EVENT};

/// Publica cada categoria concluída como evento da janela.
///
/// É a ponte entre o serviço — que não conhece o Tauri — e a interface. Uma
/// falha de emissão é registrada e ignorada: perder um evento de progresso
/// atrasa um card, mas o resumo final chega pelo retorno do comando de qualquer
/// forma.
struct WindowObserver<'a> {
    app: &'a tauri::AppHandle,
}

impl ScanObserver for WindowObserver<'_> {
    fn category_finished(&self, scan: &CategoryScan) {
        if let Err(error) = self.app.emit(CATEGORY_EVENT, scan) {
            tracing::warn!(
                categoria = scan.category.id(),
                erro = %error,
                "não foi possível publicar o progresso da análise"
            );
        }
    }
}

/// Analisa o computador e devolve o resumo completo.
///
/// Enquanto roda, emite `scanner://category` a cada área concluída, para que a
/// interface preencha os cards conforme chegam em vez de esperar o fim. O valor
/// de retorno é o relatório completo e é a fonte de verdade — os eventos são
/// progresso, não resultado.
///
/// # Errors
/// Não falha: uma área que não pôde ser analisada vira uma linha do relatório
/// com o motivo. A assinatura devolve `AppResult` para manter o contrato de
/// erros uniforme com os demais comandos.
#[allow(
    clippy::needless_pass_by_value,
    reason = "`tauri::AppHandle` é sempre injetado por valor pelo macro de comando"
)]
#[tauri::command]
pub async fn scanner_scan_all(app: tauri::AppHandle) -> AppResult<ScanSummary> {
    let observer = WindowObserver { app: &app };
    let summary = scanner_service::scan_all(&observer).await;

    if let Err(error) = app.emit(FINISHED_EVENT, &summary) {
        tracing::warn!(erro = %error, "não foi possível publicar o fim da análise");
    }

    Ok(summary)
}

/// Lista as categorias que o scanner conhece, sem analisar nada.
///
/// A interface desenha os cards a partir daqui, então os nomes e as descrições
/// vivem num lugar só — o backend.
#[must_use]
#[tauri::command]
pub fn scanner_list_categories() -> Vec<CategoryScan> {
    scanner_service::list_categories()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::scan_category::ScanCategory;

    #[test]
    fn o_comando_de_listagem_e_uma_casca_fina_do_servico() {
        let pelo_comando = scanner_list_categories();
        let pelo_servico = scanner_service::list_categories();

        assert_eq!(pelo_comando.len(), pelo_servico.len());
        assert_eq!(pelo_comando.len(), ScanCategory::ALL.len());
    }

    #[test]
    fn os_nomes_dos_eventos_sao_estaveis() {
        // A interface se inscreve nestas strings; mudá-las quebra o progresso
        // sem quebrar a compilação, então o teste as fixa.
        assert_eq!(CATEGORY_EVENT, "scanner://category");
        assert_eq!(FINISHED_EVENT, "scanner://finished");
    }
}
