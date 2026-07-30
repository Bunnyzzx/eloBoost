//! Núcleo do eloBoost.
//!
//! Este crate concentra tudo o que não depende do Tauri nem do sistema
//! operacional: contrato de erros, banco local, migrations, logging e
//! utilitários de privacidade. Duas consequências práticas:
//!
//! 1. A lógica pode ser testada em qualquer plataforma, sem `WebView`.
//! 2. Quando o broker elevado entrar (Épico 7), ele reutiliza exatamente as
//!    mesmas validações — sem duplicar código entre o processo comum e o
//!    processo privilegiado.
//!
//! **Escopo atual (Épico 0):** apenas infraestrutura. Nenhuma operação de
//! limpeza, otimização, acesso ao registro ou execução de processo existe
//! neste crate.

pub mod db;
pub mod errors;
pub mod logging;
pub mod paths;

pub use errors::{AppError, AppResult, ErrorCode, OperationError};

use time::format_description::well_known::Rfc3339;
use time::OffsetDateTime;

/// Nome do produto, usado em pastas de dados e diagnósticos.
pub const APP_NAME: &str = "eloBoost";

/// Data e hora atual em ISO-8601 UTC — o formato usado em todo o banco.
#[must_use]
pub fn now_iso8601() -> String {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .unwrap_or_else(|_| String::from("1970-01-01T00:00:00Z"))
}

/// Gera um identificador de operação ordenável por tempo (`UUIDv7`).
///
/// O mesmo valor aparece no log técnico, na tabela `activity_logs` e na
/// mensagem de erro exibida ao usuário, permitindo correlacionar os três sem
/// que ele precise enviar o log inteiro.
#[must_use]
pub fn new_operation_id() -> String {
    uuid::Uuid::now_v7().to_string()
}

/// Gera um identificador de diagnóstico para um erro.
#[must_use]
pub fn new_diagnostic_id() -> String {
    format!("elo-{}", uuid::Uuid::now_v7().simple())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn data_atual_esta_em_formato_iso8601() {
        let now = now_iso8601();
        assert!(
            OffsetDateTime::parse(&now, &Rfc3339).is_ok(),
            "obtido: {now}"
        );
    }

    #[test]
    fn ids_de_operacao_sao_unicos_e_ordenaveis() {
        let first = new_operation_id();
        let second = new_operation_id();

        assert_ne!(first, second);
        // UUIDv7 é ordenável por tempo: o gerado depois é lexicograficamente maior.
        assert!(second > first, "{second} deveria vir depois de {first}");
    }

    #[test]
    fn id_de_diagnostico_tem_prefixo_reconhecivel() {
        assert!(new_diagnostic_id().starts_with("elo-"));
    }
}
