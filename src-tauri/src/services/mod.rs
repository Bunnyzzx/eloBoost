//! Regras de negócio do backend.
//!
//! Um arquivo por domínio. Os comandos Tauri são cascas finas que delegam para
//! cá, e a interface não contém nenhuma lógica de leitura ou derivação — apenas
//! formatação (docs/01 §2).

pub mod app_service;
pub mod cpu_service;
pub mod gpu_service;
pub mod memory_service;
pub mod os_service;
pub mod privilege_service;
pub mod scanner_service;
pub mod storage_service;
pub mod system_service;
