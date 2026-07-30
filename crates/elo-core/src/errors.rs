//! Contrato de erros do eloBoost.
//!
//! Um único tipo de erro atravessa toda a aplicação e é serializado para a
//! interface como [`OperationError`] — com código estável, mensagem amigável em
//! pt-BR, sugestão de solução e ID de diagnóstico.
//!
//! Regra de produto (docs/04 §5): o usuário comum nunca vê stack trace. Os
//! detalhes técnicos viajam em um campo separado, exibido apenas sob demanda.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

/// Código de erro estável. A lista é fechada e espelha `src/types/errors.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// O Windows negou acesso ao recurso.
    PermissionDenied,
    /// Caminho fora das áreas permitidas, ou tentativa de travessia.
    PathNotAllowed,
    /// Arquivo bloqueado por outro processo.
    FileInUse,
    /// Navegador em execução durante uma limpeza que o afeta.
    BrowserRunning,
    /// Operação cancelada pelo usuário.
    OperationCancelled,
    /// Falha ao criar ponto de restauração do Windows.
    RestorePointFailed,
    /// Falha de leitura ou escrita no registro.
    RegistryAccessFailed,
    /// Versão ou edição do Windows incompatível com o recurso.
    UnsupportedSystem,
    /// Espaço em disco insuficiente para concluir a operação.
    InsufficientDiskSpace,
    /// Entrada ou estado inválido.
    InvalidConfiguration,
    /// Falha ao criar o backup — a alteração não foi aplicada.
    BackupFailed,
    /// A limpeza terminou parcialmente.
    CleanupPartiallyCompleted,
    /// Outra operação em andamento, ou serviço do sistema indisponível.
    ServiceUnavailable,
    /// Operação destrutiva chamada sem token de confirmação.
    ConfirmationRequired,
    /// Token de confirmação expirado ou já utilizado.
    ConfirmationExpired,
    /// Alvo protegido: componente essencial do Windows.
    ProtectedResource,
    /// PID reciclado — o processo alvo não é mais o mesmo.
    ProcessIdentityMismatch,
    /// O usuário negou a elevação no UAC.
    ElevationCancelled,
    /// Falha no banco de dados local.
    DatabaseError,
    /// Divergência entre o contrato do backend e o da interface.
    ContractMismatch,
    /// Núcleo indisponível (interface rodando fora do aplicativo).
    BackendUnavailable,
    /// Falha não classificada.
    Unknown,
}

impl ErrorCode {
    /// Mensagem amigável padrão, exibida ao usuário comum.
    #[must_use]
    pub const fn default_message(self) -> &'static str {
        match self {
            Self::PermissionDenied => "O Windows negou acesso a este recurso.",
            Self::PathNotAllowed => "Este local não pode ser modificado pelo eloBoost.",
            Self::FileInUse => "Alguns arquivos estão em uso e foram ignorados.",
            Self::BrowserRunning => "O navegador está aberto.",
            Self::OperationCancelled => "Operação cancelada.",
            Self::RestorePointFailed => "Não foi possível criar o ponto de restauração.",
            Self::RegistryAccessFailed => {
                "Não foi possível ler ou gravar uma configuração do Windows."
            }
            Self::UnsupportedSystem => "Este recurso não é compatível com a sua versão do Windows.",
            Self::InsufficientDiskSpace => "Espaço em disco insuficiente.",
            Self::InvalidConfiguration => "Configuração inválida.",
            Self::BackupFailed => "Não foi possível criar o backup — a alteração foi cancelada.",
            Self::CleanupPartiallyCompleted => "A limpeza terminou parcialmente.",
            Self::ServiceUnavailable => "Outra operação está em andamento.",
            Self::ConfirmationRequired => "Esta ação precisa de confirmação.",
            Self::ConfirmationExpired => "A confirmação expirou.",
            Self::ProtectedResource => {
                "Este item é essencial para o Windows e não pode ser alterado aqui."
            }
            Self::ProcessIdentityMismatch => "Este processo não existe mais.",
            Self::ElevationCancelled => "Permissão de administrador não concedida.",
            Self::DatabaseError => "Não foi possível acessar os dados locais do eloBoost.",
            Self::ContractMismatch => "A resposta interna do aplicativo não pôde ser interpretada.",
            Self::BackendUnavailable => "O núcleo do eloBoost não está disponível.",
            Self::Unknown => "Ocorreu um erro inesperado.",
        }
    }

    /// Sugestão padrão de solução, quando existe uma ação clara.
    #[must_use]
    pub const fn default_suggestion(self) -> Option<&'static str> {
        match self {
            Self::PermissionDenied | Self::RegistryAccessFailed => {
                Some("Execute a ação com permissão de administrador.")
            }
            Self::PathNotAllowed => {
                Some("Isso protege arquivos importantes. Nenhuma ação é necessária.")
            }
            Self::FileInUse => Some("Feche os programas relacionados e analise novamente."),
            Self::BrowserRunning => Some("Feche o navegador ou ignore-o nesta limpeza."),
            Self::RestorePointFailed => {
                Some("Verifique se a Proteção do Sistema está ativada no disco do Windows.")
            }
            Self::InsufficientDiskSpace => Some("Libere espaço em disco e tente novamente."),
            Self::InvalidConfiguration => Some("Reabra a tela e tente novamente."),
            Self::BackupFailed => Some("A alteração NÃO foi aplicada."),
            Self::CleanupPartiallyCompleted => {
                Some("Veja os detalhes para saber o que foi ignorado.")
            }
            Self::ServiceUnavailable => Some("Aguarde a conclusão e tente novamente."),
            Self::ConfirmationRequired | Self::ConfirmationExpired => {
                Some("Analise novamente para atualizar os resultados.")
            }
            Self::ProcessIdentityMismatch => Some("Atualize a lista de processos."),
            Self::ElevationCancelled => Some("A ação não foi executada."),
            Self::DatabaseError => {
                Some("Reinicie o eloBoost. Se persistir, informe o ID de diagnóstico.")
            }
            Self::ContractMismatch | Self::BackendUnavailable => {
                Some("Atualize o eloBoost para a versão mais recente.")
            }
            Self::Unknown => {
                Some("Tente novamente. Se o problema persistir, informe o ID de diagnóstico.")
            }
            Self::UnsupportedSystem | Self::ProtectedResource | Self::OperationCancelled => None,
        }
    }

    /// Indica se faz sentido oferecer "Tentar novamente" ao usuário.
    #[must_use]
    pub const fn is_retryable(self) -> bool {
        !matches!(
            self,
            Self::PathNotAllowed
                | Self::UnsupportedSystem
                | Self::ProtectedResource
                | Self::ContractMismatch
                | Self::BackendUnavailable
        )
    }
}

impl fmt::Display for ErrorCode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.default_message())
    }
}

/// Erro serializado para a interface.
///
/// É exatamente o formato que `src/types/errors.ts` espera; a divergência entre
/// os dois é detectada pela validação Zod na camada de IPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationError {
    /// Código estável do erro.
    pub code: ErrorCode,
    /// Mensagem amigável, sem jargão técnico.
    pub message: String,
    /// Detalhes técnicos — exibidos apenas sob demanda.
    pub technical_details: Option<String>,
    /// Possível solução.
    pub suggestion: Option<String>,
    /// Se vale a pena oferecer nova tentativa.
    pub retryable: bool,
    /// Correlaciona com o log técnico.
    pub diagnostic_id: String,
    /// Contexto adicional já redigido (sem dados pessoais).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<BTreeMap<String, String>>,
}

/// Erro interno do eloBoost.
///
/// Carrega o código, os detalhes técnicos e um contexto opcional. A conversão
/// para [`OperationError`] acontece na fronteira com a interface.
#[derive(Debug, thiserror::Error)]
pub struct AppError {
    code: ErrorCode,
    message: Option<String>,
    technical_details: Option<String>,
    diagnostic_id: String,
    context: BTreeMap<String, String>,
}

impl AppError {
    /// Cria um erro com o código informado e as mensagens padrão.
    #[must_use]
    pub fn new(code: ErrorCode) -> Self {
        Self {
            code,
            message: None,
            technical_details: None,
            diagnostic_id: crate::new_diagnostic_id(),
            context: BTreeMap::new(),
        }
    }

    /// Substitui a mensagem amigável padrão.
    #[must_use]
    pub fn with_message(mut self, message: impl Into<String>) -> Self {
        self.message = Some(message.into());
        self
    }

    /// Anexa detalhes técnicos (nunca exibidos diretamente ao usuário comum).
    #[must_use]
    pub fn with_details(mut self, details: impl fmt::Display) -> Self {
        self.technical_details = Some(details.to_string());
        self
    }

    /// Anexa um par de contexto já redigido.
    #[must_use]
    pub fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }

    /// Usa um ID de diagnóstico existente — normalmente o `operation_id` em curso,
    /// para que log técnico e mensagem ao usuário apontem para o mesmo registro.
    #[must_use]
    pub fn with_diagnostic_id(mut self, id: impl Into<String>) -> Self {
        self.diagnostic_id = id.into();
        self
    }

    /// Código do erro.
    #[must_use]
    pub const fn code(&self) -> ErrorCode {
        self.code
    }

    /// ID de diagnóstico.
    #[must_use]
    pub fn diagnostic_id(&self) -> &str {
        &self.diagnostic_id
    }

    /// Converte para o formato consumido pela interface.
    #[must_use]
    pub fn to_operation_error(&self) -> OperationError {
        OperationError {
            code: self.code,
            message: self
                .message
                .clone()
                .unwrap_or_else(|| self.code.default_message().to_owned()),
            technical_details: self.technical_details.clone(),
            suggestion: self.code.default_suggestion().map(ToOwned::to_owned),
            retryable: self.code.is_retryable(),
            diagnostic_id: self.diagnostic_id.clone(),
            context: if self.context.is_empty() {
                None
            } else {
                Some(self.context.clone())
            },
        }
    }
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{:?}] {} (diagnóstico: {})",
            self.code,
            self.message
                .as_deref()
                .unwrap_or_else(|| self.code.default_message()),
            self.diagnostic_id
        )
    }
}

impl serde::Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        self.to_operation_error().serialize(serializer)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        Self::new(ErrorCode::DatabaseError).with_details(error)
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        let code = match error.kind() {
            std::io::ErrorKind::PermissionDenied => ErrorCode::PermissionDenied,
            std::io::ErrorKind::NotFound => ErrorCode::InvalidConfiguration,
            _ => ErrorCode::Unknown,
        };
        Self::new(code).with_details(error)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        Self::new(ErrorCode::ContractMismatch).with_details(error)
    }
}

/// Resultado padrão do núcleo.
pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn erro_usa_mensagem_padrao_do_codigo() {
        let error = AppError::new(ErrorCode::FileInUse);
        let operation = error.to_operation_error();

        assert_eq!(operation.code, ErrorCode::FileInUse);
        assert_eq!(operation.message, ErrorCode::FileInUse.default_message());
        assert!(operation.suggestion.is_some());
        assert!(operation.retryable);
    }

    #[test]
    fn mensagem_customizada_substitui_a_padrao() {
        let operation = AppError::new(ErrorCode::PermissionDenied)
            .with_message("Precisamos de administrador para ler os logs do Windows.")
            .to_operation_error();

        assert_eq!(
            operation.message,
            "Precisamos de administrador para ler os logs do Windows."
        );
    }

    #[test]
    fn detalhes_tecnicos_nao_vazam_para_a_mensagem() {
        let operation = AppError::new(ErrorCode::Unknown)
            .with_details("panic em módulo interno linha 42")
            .to_operation_error();

        assert!(!operation.message.contains("linha 42"));
        assert!(operation
            .technical_details
            .as_deref()
            .is_some_and(|details| details.contains("linha 42")));
    }

    #[test]
    fn erros_nao_retentaveis_sao_marcados_corretamente() {
        assert!(!ErrorCode::PathNotAllowed.is_retryable());
        assert!(!ErrorCode::ProtectedResource.is_retryable());
        assert!(!ErrorCode::UnsupportedSystem.is_retryable());
        assert!(ErrorCode::FileInUse.is_retryable());
    }

    #[test]
    fn todo_erro_tem_id_de_diagnostico_unico() {
        let first = AppError::new(ErrorCode::Unknown);
        let second = AppError::new(ErrorCode::Unknown);

        assert!(!first.diagnostic_id().is_empty());
        assert_ne!(first.diagnostic_id(), second.diagnostic_id());
    }

    #[test]
    fn id_de_diagnostico_pode_ser_correlacionado_com_a_operacao() {
        let error = AppError::new(ErrorCode::BackupFailed).with_diagnostic_id("op-123");
        assert_eq!(error.diagnostic_id(), "op-123");
    }

    #[test]
    fn serializa_no_formato_camel_case_esperado_pela_interface() {
        let error = AppError::new(ErrorCode::BackupFailed).with_details("disco cheio");
        let json = serde_json::to_value(&error).expect("serialização");

        assert_eq!(json["code"], "BACKUP_FAILED");
        assert!(json["technicalDetails"].is_string());
        assert!(json["diagnosticId"].is_string());
        assert_eq!(json["retryable"], true);
    }

    #[test]
    fn erro_de_io_de_permissao_vira_permission_denied() {
        let io = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "acesso negado");
        let error: AppError = io.into();
        assert_eq!(error.code(), ErrorCode::PermissionDenied);
    }

    #[test]
    fn contexto_vazio_nao_e_serializado() {
        let json = serde_json::to_value(AppError::new(ErrorCode::Unknown)).expect("serialização");
        assert!(json.get("context").is_none());

        let with_context = AppError::new(ErrorCode::Unknown).with_context("categoria", "user_temp");
        let json = serde_json::to_value(&with_context).expect("serialização");
        assert_eq!(json["context"]["categoria"], "user_temp");
    }
}
