//! Contratos de dados entre o backend e a interface.
//!
//! Estes tipos são a fronteira: cada um espelha uma interface TypeScript
//! validada por Zod em `src/schemas/`. Nenhuma regra de negócio mora aqui —
//! apenas a forma dos dados.

pub mod availability;
pub mod clean_job;
pub mod clean_preview;
pub mod clean_report;
pub mod clean_result;
pub mod scan_category;
pub mod scan_result;
pub mod scan_summary;
pub mod system;
