//! O trabalho de limpeza: o que o usuário escolheu e o que ele confirmou.
//!
//! Um `CleanJob` só existe depois de uma prévia. É por isso que o token de
//! confirmação vive aqui e não num parâmetro solto: **não há caminho de código
//! que remova algo sem antes ter produzido uma prévia e recebido a confirmação
//! daquela prévia específica**.

use std::time::{Duration, SystemTime};

use serde::Deserialize;

use crate::models::scan_category::ScanCategory;

/// Quanto tempo uma confirmação continua válida.
///
/// Cinco minutos: tempo de sobra para ler o resumo e decidir, e curto o
/// bastante para que os números da prévia ainda descrevam o disco de verdade.
/// Uma confirmação velha removeria com base num retrato que já mudou.
pub const CONFIRMATION_TTL: Duration = Duration::from_secs(5 * 60);

/// O que a interface pediu para limpar.
///
/// As categorias chegam como **identificadores**, nunca como caminhos. É o
/// backend que sabe onde cada área vive (docs/04 §caminhos).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanRequest {
    /// Categorias selecionadas pelo usuário.
    pub categories: Vec<ScanCategory>,
}

/// Uma limpeza autorizada, pronta para executar.
///
/// Guardada no estado do aplicativo entre a prévia e a execução. O `token` é de
/// uso único: consumi-lo é o que impede um duplo clique de rodar a limpeza duas
/// vezes.
#[derive(Debug, Clone)]
pub struct PendingClean {
    /// Identificador da prévia que gerou esta autorização.
    pub preview_id: String,
    /// Token que a interface precisa devolver para executar.
    pub token: String,
    /// Categorias efetivamente limpáveis desta prévia.
    pub categories: Vec<ScanCategory>,
    /// Quando a prévia foi produzida.
    pub created_at: SystemTime,
}

impl PendingClean {
    /// `true` quando a confirmação ainda vale.
    #[must_use]
    pub fn is_valid_at(&self, now: SystemTime) -> bool {
        now.duration_since(self.created_at)
            .is_ok_and(|elapsed| elapsed <= CONFIRMATION_TTL)
    }

    /// Confere se a interface devolveu a mesma prévia e o mesmo token.
    ///
    /// A comparação é de igualdade simples porque o token nunca sai da máquina:
    /// não é um segredo contra um atacante remoto, e sim uma prova de que a
    /// execução veio da prévia que o usuário viu.
    #[must_use]
    pub fn matches(&self, preview_id: &str, token: &str) -> bool {
        self.preview_id == preview_id && self.token == token
    }
}

/// Resultado da tentativa de consumir uma confirmação.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfirmationCheck {
    /// Autorizada: pode executar.
    Authorized,
    /// Não existe prévia pendente.
    Missing,
    /// A prévia existe, mas o token ou o identificador não conferem.
    Mismatch,
    /// A confirmação expirou.
    Expired,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pendente(created_at: SystemTime) -> PendingClean {
        PendingClean {
            preview_id: "prev-1".into(),
            token: "tok-1".into(),
            categories: vec![ScanCategory::UserTemp],
            created_at,
        }
    }

    #[test]
    fn uma_confirmacao_recente_e_valida() {
        let agora = SystemTime::now();
        assert!(pendente(agora).is_valid_at(agora));
    }

    #[test]
    fn uma_confirmacao_antiga_expira() {
        let agora = SystemTime::now();
        let velha = agora - CONFIRMATION_TTL - Duration::from_secs(1);
        assert!(!pendente(velha).is_valid_at(agora));
    }

    #[test]
    fn o_token_precisa_corresponder_a_previa() {
        let job = pendente(SystemTime::now());

        assert!(job.matches("prev-1", "tok-1"));
        // Token certo, prévia errada: recusa. Impede executar a prévia atual
        // com a autorização de uma anterior.
        assert!(!job.matches("prev-2", "tok-1"));
        assert!(!job.matches("prev-1", "tok-2"));
    }

    #[test]
    fn o_prazo_de_confirmacao_e_curto_o_bastante_para_os_numeros_valerem() {
        // Trava de produto: se alguém esticar o TTL para horas, a prévia deixa
        // de descrever o disco no momento da remoção.
        assert!(CONFIRMATION_TTL <= Duration::from_secs(15 * 60));
        assert!(CONFIRMATION_TTL >= Duration::from_secs(60));
    }
}
