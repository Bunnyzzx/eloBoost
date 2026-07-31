//! O resultado da limpeza de uma categoria.
//!
//! Distingue três desfechos que um utilitário honesto não pode confundir:
//! removido, **ignorado** (o eloBoost decidiu não mexer) e **falhou** (tentou e
//! não conseguiu). Juntar os dois últimos num "erro" esconderia justamente o
//! caso em que o produto agiu com cautela de propósito.

use serde::Serialize;

use crate::models::scan_category::ScanCategory;

/// Como terminou a limpeza de uma categoria.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanStatus {
    /// Ainda não começou.
    Pending,
    /// Em andamento.
    Running,
    /// Removeu tudo o que a prévia listou.
    Completed,
    /// Removeu parte: houve itens ignorados ou falhas.
    PartiallyCompleted,
    /// Não removeu nada por falha.
    Failed,
    /// A categoria não foi selecionada.
    Skipped,
}

impl CleanStatus {
    /// `true` quando a categoria terminou, de qualquer forma.
    #[must_use]
    pub const fn is_final(self) -> bool {
        !matches!(self, Self::Pending | Self::Running)
    }

    /// `true` quando algo foi de fato removido.
    #[must_use]
    pub const fn removed_something(self) -> bool {
        matches!(self, Self::Completed | Self::PartiallyCompleted)
    }
}

/// Por que um item não foi removido.
///
/// Contadores, nunca caminhos — a mesma regra de privacidade do scanner.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanSkips {
    /// O Windows negou acesso.
    pub access_denied: u64,
    /// Arquivo bloqueado por outro processo.
    pub in_use: u64,
    /// Caminho longo demais para o sistema de arquivos.
    pub path_too_long: u64,
    /// O arquivo já não existia quando a remoção chegou nele.
    pub already_gone: u64,
    /// Link, junction ou reparse point — **nunca seguido nem removido**.
    pub links: u64,
    /// O validador recusou o caminho.
    pub rejected_by_guard: u64,
    /// Outras falhas de remoção.
    pub other_failures: u64,
}

impl CleanSkips {
    /// Total de itens que ficaram para trás.
    #[must_use]
    pub const fn total(&self) -> u64 {
        self.access_denied
            + self.in_use
            + self.path_too_long
            + self.already_gone
            + self.links
            + self.rejected_by_guard
            + self.other_failures
    }

    /// `true` quando nada ficou para trás.
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        self.total() == 0
    }

    /// Soma dois diagnósticos.
    #[must_use]
    pub const fn merged(self, other: Self) -> Self {
        Self {
            access_denied: self.access_denied + other.access_denied,
            in_use: self.in_use + other.in_use,
            path_too_long: self.path_too_long + other.path_too_long,
            already_gone: self.already_gone + other.already_gone,
            links: self.links + other.links,
            rejected_by_guard: self.rejected_by_guard + other.rejected_by_guard,
            other_failures: self.other_failures + other.other_failures,
        }
    }
}

/// O que a limpeza de uma categoria conseguiu fazer.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCleanResult {
    /// Identificador estável.
    pub category: ScanCategory,
    /// Nome exibido.
    pub name: &'static str,
    /// Como terminou.
    pub status: CleanStatus,
    /// Arquivos efetivamente removidos.
    pub removed_files: u64,
    /// Pastas vazias removidas depois dos arquivos.
    pub removed_folders: u64,
    /// Espaço liberado, somando só o que saiu do disco.
    pub freed_bytes: u64,
    /// O que ficou para trás, por motivo.
    pub skipped: CleanSkips,
    /// Quanto tempo esta categoria levou.
    pub duration_ms: u64,
    /// Explicação, quando o status pede uma.
    pub message: Option<String>,
}

impl CategoryCleanResult {
    /// Estado inicial de uma categoria selecionada, antes de começar.
    #[must_use]
    pub fn pending(category: ScanCategory) -> Self {
        Self::empty(category, CleanStatus::Pending, None)
    }

    /// Categoria que o usuário não selecionou.
    #[must_use]
    pub fn skipped(category: ScanCategory) -> Self {
        Self::empty(category, CleanStatus::Skipped, None)
    }

    /// Categoria que falhou por inteiro.
    #[must_use]
    pub fn failed(category: ScanCategory, message: impl Into<String>) -> Self {
        Self::empty(category, CleanStatus::Failed, Some(message.into()))
    }

    fn empty(category: ScanCategory, status: CleanStatus, message: Option<String>) -> Self {
        Self {
            category,
            name: category.name(),
            status,
            removed_files: 0,
            removed_folders: 0,
            freed_bytes: 0,
            skipped: CleanSkips::default(),
            duration_ms: 0,
            message,
        }
    }

    /// Deriva o status final a partir do que aconteceu.
    ///
    /// A regra é conservadora de propósito: qualquer item deixado para trás
    /// rebaixa o resultado para parcial, mesmo que 99,9% tenha saído. O usuário
    /// merece saber que o número não é a história inteira.
    #[must_use]
    pub fn finish(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self.status = if self.skipped.is_empty() {
            CleanStatus::Completed
        } else if self.removed_files > 0 || self.removed_folders > 0 {
            CleanStatus::PartiallyCompleted
        } else {
            CleanStatus::Failed
        };

        if !self.skipped.is_empty() {
            self.message = Some(describe_skips(&self.skipped));
        }
        self
    }
}

/// Explica em uma frase o que ficou para trás.
fn describe_skips(skips: &CleanSkips) -> String {
    let mut reasons: Vec<String> = Vec::new();

    let mut push = |count: u64, singular: &str, plural: &str| {
        if count > 0 {
            reasons.push(format!(
                "{count} {}",
                if count == 1 { singular } else { plural }
            ));
        }
    };

    push(skips.in_use, "arquivo em uso", "arquivos em uso");
    push(
        skips.access_denied,
        "arquivo sem permissão",
        "arquivos sem permissão",
    );
    push(skips.links, "atalho preservado", "atalhos preservados");
    push(
        skips.path_too_long,
        "caminho longo demais",
        "caminhos longos demais",
    );
    push(
        skips.rejected_by_guard,
        "item fora da área permitida",
        "itens fora da área permitida",
    );
    push(
        skips.already_gone,
        "arquivo que já não existia",
        "arquivos que já não existiam",
    );
    push(
        skips.other_failures,
        "falha de remoção",
        "falhas de remoção",
    );

    format!("{} — nada além disso foi tocado.", reasons.join(", "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tudo_removido_conclui_por_inteiro() {
        let resultado = CategoryCleanResult {
            removed_files: 10,
            freed_bytes: 1_000,
            ..CategoryCleanResult::pending(ScanCategory::UserTemp)
        }
        .finish(30);

        assert_eq!(resultado.status, CleanStatus::Completed);
        assert!(resultado.message.is_none());
        assert_eq!(resultado.duration_ms, 30);
    }

    #[test]
    fn um_unico_arquivo_em_uso_rebaixa_para_parcial() {
        // Conservador de propósito: 999 de 1000 removidos ainda é "parcial".
        let resultado = CategoryCleanResult {
            removed_files: 999,
            freed_bytes: 999_000,
            skipped: CleanSkips {
                in_use: 1,
                ..CleanSkips::default()
            },
            ..CategoryCleanResult::pending(ScanCategory::UserTemp)
        }
        .finish(50);

        assert_eq!(resultado.status, CleanStatus::PartiallyCompleted);
        assert!(resultado
            .message
            .as_deref()
            .is_some_and(|m| m.contains("1 arquivo em uso")));
    }

    #[test]
    fn nada_removido_com_falhas_e_falha() {
        let resultado = CategoryCleanResult {
            skipped: CleanSkips {
                access_denied: 4,
                ..CleanSkips::default()
            },
            ..CategoryCleanResult::pending(ScanCategory::WindowsTemp)
        }
        .finish(10);

        assert_eq!(resultado.status, CleanStatus::Failed);
        assert!(resultado
            .message
            .as_deref()
            .is_some_and(|m| m.contains("4 arquivos sem permissão")));
    }

    #[test]
    fn uma_area_vazia_conclui_sem_ressalvas() {
        let resultado = CategoryCleanResult::pending(ScanCategory::Thumbnails).finish(1);

        assert_eq!(resultado.status, CleanStatus::Completed);
        assert_eq!(resultado.freed_bytes, 0);
    }

    #[test]
    fn os_estados_intermediarios_nao_sao_finais() {
        assert!(!CleanStatus::Pending.is_final());
        assert!(!CleanStatus::Running.is_final());
        assert!(CleanStatus::Completed.is_final());
        assert!(CleanStatus::Failed.is_final());
        assert!(CleanStatus::Skipped.is_final());
    }

    #[test]
    fn so_conta_como_removido_o_que_saiu_do_disco() {
        assert!(CleanStatus::Completed.removed_something());
        assert!(CleanStatus::PartiallyCompleted.removed_something());
        assert!(!CleanStatus::Failed.removed_something());
        assert!(!CleanStatus::Skipped.removed_something());
    }

    #[test]
    fn o_diagnostico_nunca_carrega_caminhos() {
        let json = serde_json::to_value(CleanSkips {
            in_use: 2,
            ..CleanSkips::default()
        })
        .expect("serialização");

        let objeto = json.as_object().expect("objeto");
        assert!(
            objeto.values().all(serde_json::Value::is_number),
            "o diagnóstico deve conter apenas contadores: {json}"
        );
    }
}
