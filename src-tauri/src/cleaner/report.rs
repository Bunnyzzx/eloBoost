//! Agrega o relatório final e o registra no histórico.
//!
//! O histórico do Épico 3 é **informativo**: guarda o que aconteceu, sem
//! qualquer mecanismo de desfazer. Os campos `undo_ref` e `undo_kind` da tabela
//! existem desde o Épico 0 e ficam deliberadamente vazios — preenchê-los aqui
//! sugeriria uma reversão que não existe.

use elo_core::db::activity::ActivityRecord;
use elo_core::db::Database;
use elo_core::AppResult;

use crate::models::clean_report::{CleanReport, HistoryEntry};

/// Frase que o histórico exibe para uma limpeza.
///
/// Montada no backend porque é o backend que conhece a regra do que conta como
/// liberado. A tela apenas exibe.
#[must_use]
fn describe(report: &CleanReport) -> String {
    if report.executed_categories == 0 {
        return String::from("Limpeza sem categorias selecionadas.");
    }

    let areas = if report.executed_categories == 1 {
        String::from("1 área")
    } else {
        format!("{} áreas", report.executed_categories)
    };

    format!("Limpeza de {areas}")
}

/// Detalhe adicional do registro — contadores, nunca caminhos.
///
/// Lista apenas os motivos que de fato ocorreram, com a concordância correta.
/// Enumerar zeros ("0 em uso, 0 sem permissão, 1 atalhos") polui a frase e ainda
/// erra o plural — e o histórico é justamente onde o usuário vai reler o que
/// aconteceu, meses depois.
#[must_use]
fn details(report: &CleanReport) -> Option<String> {
    if report.skipped.is_empty() {
        return None;
    }

    let mut reasons: Vec<String> = Vec::new();
    let mut push = |count: u64, singular: &str, plural: &str| {
        if count > 0 {
            reasons.push(format!(
                "{count} {}",
                if count == 1 { singular } else { plural }
            ));
        }
    };

    push(report.skipped.in_use, "arquivo em uso", "arquivos em uso");
    push(
        report.skipped.access_denied,
        "arquivo sem permissão",
        "arquivos sem permissão",
    );
    push(
        report.skipped.links,
        "atalho preservado",
        "atalhos preservados",
    );
    push(
        report.skipped.path_too_long,
        "caminho longo demais",
        "caminhos longos demais",
    );
    push(
        report.skipped.already_gone,
        "arquivo que já não existia",
        "arquivos que já não existiam",
    );
    push(
        report.skipped.rejected_by_guard,
        "item fora da área permitida",
        "itens fora da área permitida",
    );
    push(
        report.skipped.other_failures,
        "falha de remoção",
        "falhas de remoção",
    );

    let total = report.skipped.total();
    Some(format!(
        "{total} {} — {}",
        if total == 1 {
            "item mantido"
        } else {
            "itens mantidos"
        },
        reasons.join(", ")
    ))
}

/// Registra a limpeza no histórico local.
///
/// Uma falha aqui **não** invalida a limpeza: os arquivos já saíram do disco, e
/// devolver erro faria a interface dizer que nada aconteceu. O problema vai para
/// o log técnico e a operação segue como bem-sucedida.
///
/// # Errors
/// Devolve `DatabaseError` se a escrita falhar. O chamador decide se propaga.
pub fn record(database: &Database, report: &CleanReport) -> AppResult<()> {
    database.record_activity(&ActivityRecord {
        operation_id: report.operation_id.clone(),
        action_type: String::from("cleanup"),
        message: describe(report),
        level: String::from(if report.skipped.is_empty() {
            "info"
        } else {
            "warning"
        }),
        result: String::from(report.history_result()),
        affected_count: report.removed_files,
        released_bytes: report.freed_bytes,
        details: details(report),
        created_at: report.finished_at.clone(),
    })
}

/// Lê as entradas mais recentes do histórico.
///
/// # Errors
/// Devolve `DatabaseError` se a consulta falhar.
pub fn recent(database: &Database, limit: u32) -> AppResult<Vec<HistoryEntry>> {
    Ok(database
        .recent_activities(limit)?
        .into_iter()
        .map(|entry| HistoryEntry {
            id: entry.id,
            operation_id: entry.operation_id,
            action_type: entry.action_type,
            message: entry.message,
            result: entry.result,
            affected_count: entry.affected_count,
            released_bytes: entry.released_bytes,
            created_at: entry.created_at,
            details: entry.details,
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::clean_result::{CategoryCleanResult, CleanSkips};
    use crate::models::scan_category::ScanCategory;

    fn relatorio_limpo() -> CleanReport {
        CleanReport::from_categories(
            elo_core::new_operation_id(),
            vec![CategoryCleanResult {
                removed_files: 120,
                freed_bytes: 2_048_000,
                ..CategoryCleanResult::pending(ScanCategory::UserTemp)
            }
            .finish(40)],
            55,
        )
    }

    #[test]
    fn a_frase_do_historico_descreve_quantas_areas_foram_limpas() {
        assert!(describe(&relatorio_limpo()).contains("1 área"));

        let duas = CleanReport::from_categories(
            "op".into(),
            vec![
                CategoryCleanResult::pending(ScanCategory::UserTemp).finish(1),
                CategoryCleanResult::pending(ScanCategory::Logs).finish(1),
            ],
            2,
        );
        assert!(describe(&duas).contains("2 áreas"));
    }

    #[test]
    fn uma_limpeza_sem_categorias_tem_frase_propria() {
        let vazia = CleanReport::from_categories("op".into(), Vec::new(), 0);
        assert!(describe(&vazia).contains("sem categorias"));
    }

    #[test]
    fn um_unico_item_mantido_usa_o_singular() {
        let report = CleanReport::from_categories(
            "op".into(),
            vec![CategoryCleanResult {
                removed_files: 10,
                skipped: CleanSkips {
                    links: 1,
                    ..CleanSkips::default()
                },
                ..CategoryCleanResult::pending(ScanCategory::UserTemp)
            }
            .finish(1)],
            1,
        );

        let detalhe = details(&report).expect("detalhe");
        assert_eq!(detalhe, "1 item mantido — 1 atalho preservado");
    }

    #[test]
    fn uma_limpeza_sem_ressalvas_nao_gera_detalhe() {
        assert!(details(&relatorio_limpo()).is_none());
    }

    #[test]
    fn o_detalhe_do_historico_nunca_contem_caminho() {
        let report = CleanReport::from_categories(
            "op".into(),
            vec![CategoryCleanResult {
                removed_files: 1,
                skipped: CleanSkips {
                    access_denied: 3,
                    in_use: 1,
                    ..CleanSkips::default()
                },
                ..CategoryCleanResult::pending(ScanCategory::Logs)
            }
            .finish(1)],
            1,
        );

        let detalhe = details(&report).expect("detalhe");
        assert!(!detalhe.contains('\\'));
        assert!(!detalhe.contains('/'));
        assert!(detalhe.contains("3 arquivos sem permissão"));
        assert!(
            detalhe.contains("1 arquivo em uso"),
            "concordância errada: {detalhe}"
        );
        assert!(detalhe.starts_with("4 itens mantidos"), "obtido: {detalhe}");
    }
}
