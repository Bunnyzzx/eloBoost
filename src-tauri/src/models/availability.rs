//! Disponibilidade de uma informação do sistema.
//!
//! Este tipo existe para tornar **impossível** apresentar um dado que não foi
//! realmente lido. Requisito de produto (docs/00 §5 e docs/08 §5): quando uma
//! métrica não pode ser obtida no dispositivo, a interface exibe o motivo — nunca
//! um zero, uma estimativa ou um valor plausível inventado.
//!
//! `Option<T>` não bastaria: um `None` obriga a interface a decidir o que
//! mostrar, e o motivo da ausência se perde. Aqui o motivo viaja junto.

use serde::Serialize;

/// Motivo pelo qual uma informação não está disponível.
///
/// A lista é fechada e cada variante gera uma frase específica na interface.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UnavailableReason {
    /// O sensor ou a API não existe neste hardware ou nesta plataforma.
    NotSupported,
    /// Existe, mas exigiria privilégio de administrador para ser lido.
    RequiresElevation,
    /// A leitura falhou (API retornou erro, valor inconsistente).
    ReadFailed,
    /// Não implementado nesta versão do eloBoost.
    NotImplemented,
}

impl UnavailableReason {
    /// Frase exibida ao usuário. Sempre honesta sobre o que aconteceu.
    #[must_use]
    pub const fn message(self) -> &'static str {
        match self {
            Self::NotSupported => "Informação não suportada neste dispositivo.",
            Self::RequiresElevation => "Requer permissão de administrador para ser lida.",
            Self::ReadFailed => "Não foi possível ler esta informação.",
            Self::NotImplemented => "Ainda não disponível nesta versão.",
        }
    }
}

/// Uma informação que pode ou não estar disponível.
///
/// Serializa como união discriminada, que o TypeScript consome com `switch` no
/// campo `status` — o compilador do frontend obriga a tratar os dois casos.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Availability<T> {
    /// O valor foi lido de fato.
    Available {
        /// O valor.
        value: T,
    },
    /// O valor não pôde ser lido.
    Unavailable {
        /// Por quê.
        reason: UnavailableReason,
        /// Frase pronta para exibição.
        message: &'static str,
    },
}

impl<T> Availability<T> {
    /// Envolve um valor lido com sucesso.
    #[must_use]
    pub const fn available(value: T) -> Self {
        Self::Available { value }
    }

    /// Marca como indisponível, com o motivo.
    #[must_use]
    pub const fn unavailable(reason: UnavailableReason) -> Self {
        Self::Unavailable {
            reason,
            message: reason.message(),
        }
    }

    /// Não suportado neste dispositivo ou nesta plataforma.
    #[must_use]
    pub const fn not_supported() -> Self {
        Self::unavailable(UnavailableReason::NotSupported)
    }

    /// A leitura falhou.
    #[must_use]
    pub const fn read_failed() -> Self {
        Self::unavailable(UnavailableReason::ReadFailed)
    }

    /// Converte de `Option`, atribuindo o motivo quando ausente.
    #[must_use]
    pub fn from_option(value: Option<T>, reason: UnavailableReason) -> Self {
        match value {
            Some(value) => Self::available(value),
            None => Self::unavailable(reason),
        }
    }

    /// `true` quando há valor.
    #[must_use]
    pub const fn is_available(&self) -> bool {
        matches!(self, Self::Available { .. })
    }

    /// Referência ao valor, quando existe.
    #[must_use]
    pub const fn value(&self) -> Option<&T> {
        match self {
            Self::Available { value } => Some(value),
            Self::Unavailable { .. } => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valor_disponivel_serializa_com_status_e_valor() {
        let json = serde_json::to_value(Availability::available(42_u32)).expect("serialização");

        assert_eq!(json["status"], "available");
        assert_eq!(json["value"], 42);
    }

    #[test]
    fn indisponivel_serializa_motivo_e_mensagem_pronta() {
        let json =
            serde_json::to_value(Availability::<u32>::not_supported()).expect("serialização");

        assert_eq!(json["status"], "unavailable");
        assert_eq!(json["reason"], "not_supported");
        assert_eq!(
            json["message"],
            "Informação não suportada neste dispositivo."
        );
    }

    #[test]
    fn indisponivel_nunca_carrega_um_valor() {
        let json = serde_json::to_value(Availability::<u64>::read_failed()).expect("serialização");

        // O ponto central deste tipo: não existe caminho em que a interface
        // receba um número quando a leitura falhou.
        assert!(json.get("value").is_none());
    }

    #[test]
    fn cada_motivo_tem_mensagem_propria_e_completa() {
        for reason in [
            UnavailableReason::NotSupported,
            UnavailableReason::RequiresElevation,
            UnavailableReason::ReadFailed,
            UnavailableReason::NotImplemented,
        ] {
            let message = reason.message();
            assert!(!message.is_empty());
            assert!(
                message.ends_with('.'),
                "motivo {reason:?} sem frase completa"
            );
        }
    }

    #[test]
    fn conversao_de_option_preserva_o_motivo() {
        let ausente = Availability::from_option(None::<u8>, UnavailableReason::RequiresElevation);
        assert!(!ausente.is_available());

        let presente = Availability::from_option(Some(7_u8), UnavailableReason::ReadFailed);
        assert_eq!(presente.value(), Some(&7));
    }
}
