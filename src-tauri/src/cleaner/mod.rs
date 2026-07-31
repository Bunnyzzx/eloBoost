//! Engine de Limpeza do eloBoost.
//!
//! Este é o único lugar do projeto que remove arquivos, e o desenho existe para
//! que continue assim. A remoção fica atrás de três portas em série:
//!
//! ```text
//! registry  → quais categorias existem e quais são limpáveis
//! validator → PathGuard: transforma um caminho num `ValidatedPath`
//! executor  → só aceita `ValidatedPath`, nunca `&str` nem `&Path`
//! ```
//!
//! A porta do meio é a que importa: `ValidatedPath` tem campos privados e
//! nenhum construtor público, então **é impossível, pelo sistema de tipos,
//! chamar a remoção com um caminho que não passou pelo guarda** (docs/05 §2).
//!
//! A Engine será reutilizada pelos Épicos seguintes — otimizações,
//! inicialização, aplicativos, restauração. O que muda de um para o outro é a
//! fonte que implementa [`crate::traits::cleanable::Cleanable`]; o motor,
//! a validação e a contabilidade não mudam.

pub mod engine;
pub mod executor;
pub mod preview;
pub mod registry;
pub mod report;
pub mod validator;

use crate::models::scan_category::ScanCategory;

/// Recebe o progresso da limpeza enquanto ela acontece.
///
/// Existe para que a Engine não dependa do Tauri: os testes usam um coletor em
/// memória e o comando usa um que emite eventos para a janela. É o mesmo motivo
/// pelo qual `elo-core` não conhece o Tauri.
pub trait CleanObserver: Send + Sync {
    /// Uma categoria começou a ser limpa.
    fn category_started(&self, category: ScanCategory);

    /// Avanço dentro de uma categoria, em lotes.
    fn category_progress(&self, _category: ScanCategory, _removed_files: u64, _freed_bytes: u64) {}

    /// Uma categoria terminou, com o resultado final.
    fn category_finished(&self, _result: &crate::models::clean_result::CategoryCleanResult) {}
}

/// Observador que descarta o progresso — usado quando só interessa o relatório.
pub struct SilentObserver;

impl CleanObserver for SilentObserver {
    fn category_started(&self, _category: ScanCategory) {}
}
