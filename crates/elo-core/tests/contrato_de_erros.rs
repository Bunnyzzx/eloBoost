//! Verifica que o contrato de erros do backend é exatamente o que a interface
//! espera.
//!
//! A validação Zod em `src/schemas/index.ts` só protege se o formato produzido
//! aqui bater com o declarado lá. Estes testes travam esse acordo: se alguém
//! renomear um campo ou mudar a serialização de um código, o build quebra aqui
//! em vez de virar um erro silencioso na tela do usuário.

use elo_core::errors::{AppError, ErrorCode, OperationError};

/// Códigos declarados em `src/types/errors.ts` (`ERROR_CODES`).
const CODIGOS_ESPERADOS_PELA_INTERFACE: &[&str] = &[
    "PERMISSION_DENIED",
    "PATH_NOT_ALLOWED",
    "FILE_IN_USE",
    "BROWSER_RUNNING",
    "OPERATION_CANCELLED",
    "RESTORE_POINT_FAILED",
    "REGISTRY_ACCESS_FAILED",
    "UNSUPPORTED_SYSTEM",
    "INSUFFICIENT_DISK_SPACE",
    "INVALID_CONFIGURATION",
    "BACKUP_FAILED",
    "CLEANUP_PARTIALLY_COMPLETED",
    "SERVICE_UNAVAILABLE",
    "CONFIRMATION_REQUIRED",
    "CONFIRMATION_EXPIRED",
    "PROTECTED_RESOURCE",
    "PROCESS_IDENTITY_MISMATCH",
    "ELEVATION_CANCELLED",
    "DATABASE_ERROR",
    "CONTRACT_MISMATCH",
    "BACKEND_UNAVAILABLE",
    "UNKNOWN",
];

/// Todos os códigos do backend, para varrer o enum por inteiro.
const TODOS_OS_CODIGOS: &[ErrorCode] = &[
    ErrorCode::PermissionDenied,
    ErrorCode::PathNotAllowed,
    ErrorCode::FileInUse,
    ErrorCode::BrowserRunning,
    ErrorCode::OperationCancelled,
    ErrorCode::RestorePointFailed,
    ErrorCode::RegistryAccessFailed,
    ErrorCode::UnsupportedSystem,
    ErrorCode::InsufficientDiskSpace,
    ErrorCode::InvalidConfiguration,
    ErrorCode::BackupFailed,
    ErrorCode::CleanupPartiallyCompleted,
    ErrorCode::ServiceUnavailable,
    ErrorCode::ConfirmationRequired,
    ErrorCode::ConfirmationExpired,
    ErrorCode::ProtectedResource,
    ErrorCode::ProcessIdentityMismatch,
    ErrorCode::ElevationCancelled,
    ErrorCode::DatabaseError,
    ErrorCode::ContractMismatch,
    ErrorCode::BackendUnavailable,
    ErrorCode::Unknown,
];

fn serializar(code: ErrorCode) -> String {
    serde_json::to_value(code)
        .expect("serialização")
        .as_str()
        .expect("string")
        .to_owned()
}

#[test]
fn cada_codigo_serializa_no_formato_que_a_interface_valida() {
    for code in TODOS_OS_CODIGOS {
        let serializado = serializar(*code);
        assert!(
            CODIGOS_ESPERADOS_PELA_INTERFACE.contains(&serializado.as_str()),
            "o código {serializado} não existe em src/types/errors.ts"
        );
    }
}

#[test]
fn a_interface_nao_declara_codigos_que_o_backend_nao_produz() {
    let produzidos: Vec<String> = TODOS_OS_CODIGOS.iter().map(|c| serializar(*c)).collect();

    for esperado in CODIGOS_ESPERADOS_PELA_INTERFACE {
        assert!(
            produzidos.iter().any(|p| p == esperado),
            "src/types/errors.ts declara {esperado}, que o backend não produz"
        );
    }
}

#[test]
fn todo_erro_carrega_os_campos_obrigatorios_do_contrato() {
    for code in TODOS_OS_CODIGOS {
        let json = serde_json::to_value(AppError::new(*code)).expect("serialização");

        for campo in [
            "code",
            "message",
            "technicalDetails",
            "suggestion",
            "retryable",
            "diagnosticId",
        ] {
            assert!(
                json.get(campo).is_some(),
                "campo {campo} ausente para {code:?}"
            );
        }

        assert!(
            json["message"].as_str().is_some_and(|m| !m.is_empty()),
            "{code:?} precisa de mensagem amigável"
        );
        assert!(
            json["diagnosticId"].as_str().is_some_and(|d| !d.is_empty()),
            "{code:?} precisa de ID de diagnóstico"
        );
    }
}

#[test]
fn nenhuma_mensagem_ao_usuario_contem_jargao_tecnico() {
    // Mensagens ao usuário comum não podem carregar termos de implementação.
    let proibidos = [
        "panic", "unwrap", "Err(", "None", "stack", "trace", "rusqlite", "0x",
    ];

    for code in TODOS_OS_CODIGOS {
        let mensagem = code.default_message();
        for termo in proibidos {
            assert!(
                !mensagem.contains(termo),
                "a mensagem de {code:?} contém jargão técnico: {termo:?}"
            );
        }
        assert!(
            mensagem.ends_with('.'),
            "a mensagem de {code:?} deveria ser uma frase completa"
        );
    }
}

#[test]
fn detalhes_tecnicos_nunca_vazam_para_a_mensagem_amigavel() {
    let segredo = "rusqlite::Error na linha 412 do módulo interno";
    let json = serde_json::to_value(AppError::new(ErrorCode::DatabaseError).with_details(segredo))
        .expect("serialização");

    assert!(!json["message"].as_str().expect("string").contains(segredo));
    assert!(json["technicalDetails"]
        .as_str()
        .expect("string")
        .contains(segredo));
}

#[test]
fn erro_do_backend_e_desserializavel_no_formato_do_contrato() {
    // Simula o caminho completo: backend serializa, interface desserializa.
    let origem = AppError::new(ErrorCode::FileInUse)
        .with_details("ERROR_SHARING_VIOLATION (32)")
        .with_context("categoria", "user_temp");

    let json = serde_json::to_string(&origem).expect("serialização");
    let recebido: OperationError = serde_json::from_str(&json).expect("desserialização");

    assert_eq!(recebido.code, ErrorCode::FileInUse);
    assert!(recebido.retryable);
    assert!(recebido.suggestion.is_some());
    assert_eq!(
        recebido
            .context
            .expect("contexto")
            .get("categoria")
            .map(String::as_str),
        Some("user_temp")
    );
}

#[test]
fn erros_irrecuperaveis_nao_oferecem_nova_tentativa() {
    // Oferecer "Tentar novamente" onde nada muda é enganar o usuário.
    for code in [
        ErrorCode::PathNotAllowed,
        ErrorCode::ProtectedResource,
        ErrorCode::UnsupportedSystem,
    ] {
        let json = serde_json::to_value(AppError::new(code)).expect("serialização");
        assert_eq!(
            json["retryable"], false,
            "{code:?} não deveria ser retentável"
        );
    }
}
