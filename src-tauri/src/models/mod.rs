//! Contratos de dados entre o backend e a interface.
//!
//! Estes tipos são a fronteira: cada um espelha uma interface TypeScript
//! validada por Zod em `src/schemas/`. Nenhuma regra de negócio mora aqui —
//! apenas a forma dos dados.

pub mod availability;
pub mod system;
