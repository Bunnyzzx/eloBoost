//! Acesso de baixo nível ao sistema operacional.
//!
//! A fronteira com o Win32 vive em [`ffi`], o único módulo do projeto onde
//! `unsafe` é permitido. Os serviços consomem apenas as funções seguras que ele
//! expõe, e nunca o Win32 diretamente.

pub mod ffi;
