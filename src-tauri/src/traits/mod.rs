//! Contratos reutilizáveis do backend.
//!
//! Um trait aqui descreve **o que uma categoria precisa informar** para
//! participar de um mecanismo do eloBoost — nunca como o mecanismo funciona.
//! Toda a implementação padrão vive no próprio trait, para que uma categoria
//! nova não reescreva regra de segurança nenhuma.

pub mod cleanable;
