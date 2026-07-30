//! Fontes de análise — uma por categoria.
//!
//! Cada módulo é independente: expõe `scan() -> CategoryScan` e resolve as
//! próprias raízes. Nenhuma fonte conhece as outras, e o
//! [`crate::services::scanner_service`] apenas as coordena. Acrescentar uma
//! categoria é acrescentar um arquivo aqui e uma variante em
//! [`crate::models::scan_category::ScanCategory`] — a caminhada, a contagem, a
//! classificação de erros e o resumo não mudam.

pub mod browser_cache;
pub mod downloads;
pub mod logs;
pub mod recycle_bin;
pub mod thumbnails;
pub mod user_temp;
pub mod windows_temp;
