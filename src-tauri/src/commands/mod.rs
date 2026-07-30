//! Fronteira entre a interface e o núcleo.
//!
//! Cada comando é fino de propósito: desserializa a entrada, valida e delega
//! ao serviço responsável. Nenhuma regra de negócio mora aqui.
//!
//! **Regra inviolável (docs/05 §3):** um comando representa *uma operação
//! específica e nomeada*. Não existe comando genérico que receba um comando de
//! shell, um caminho arbitrário ou uma chave de registro livre vinda do
//! frontend.

pub mod app;
pub mod system;
