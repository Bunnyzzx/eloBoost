//! Resultado da análise de uma categoria.
//!
//! O scanner é **somente leitura**: estes tipos descrevem o que foi encontrado
//! e medido, nunca uma ação. Nenhum campo aqui representa arquivo removido,
//! renomeado ou alterado — porque nada disso acontece no Épico 2.

use serde::Serialize;

use crate::models::scan_category::{RemovalPolicy, ScanCategory};

/// Como terminou a análise de uma categoria.
///
/// Deliberadamente separado de `Availability`: uma varredura pode **concluir
/// com sucesso e ainda assim ter ignorado itens** — uma pasta protegida no meio
/// do caminho não invalida os 4 GB já medidos. `Availability` só sabe dizer
/// "tenho" ou "não tenho", e perderia essa nuance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanStatus {
    /// Percorreu tudo o que existia, sem nada ignorado.
    Completed,
    /// Percorreu, mas ignorou itens (sem permissão, em uso, caminho longo).
    CompletedWithWarnings,
    /// A área não existe nesta máquina — nada a medir, e isso não é um erro.
    NotFound,
    /// A categoria não existe nesta plataforma (áreas exclusivas do Windows).
    NotSupported,
    /// Não foi possível analisar.
    Failed,
}

impl ScanStatus {
    /// `true` quando os números do resultado podem ser somados ao total.
    #[must_use]
    pub const fn has_measurement(self) -> bool {
        matches!(self, Self::Completed | Self::CompletedWithWarnings)
    }
}

/// Contagem do que a varredura encontrou pelo caminho e decidiu ignorar.
///
/// São **contadores, não listas**: registrar caminhos aqui significaria levar
/// nomes de arquivos do usuário até a interface e o log, o que o produto não
/// faz (docs/05). O diagnóstico responde "quantos e por quê", que é o
/// suficiente para explicar uma diferença de tamanho.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedItems {
    /// O Windows negou acesso.
    pub access_denied: u64,
    /// Caminho acima do limite do sistema de arquivos.
    pub path_too_long: u64,
    /// Arquivo bloqueado por outro processo.
    pub in_use: u64,
    /// Link simbólico, junction ou reparse point — **nunca seguido**.
    pub links: u64,
    /// Profundidade máxima de pastas atingida.
    pub depth_exceeded: u64,
    /// Outras falhas de leitura.
    pub read_errors: u64,
}

impl SkippedItems {
    /// Total de itens ignorados por qualquer motivo.
    #[must_use]
    pub const fn total(&self) -> u64 {
        self.access_denied
            + self.path_too_long
            + self.in_use
            + self.links
            + self.depth_exceeded
            + self.read_errors
    }

    /// `true` quando nada foi ignorado.
    #[must_use]
    pub const fn is_empty(&self) -> bool {
        self.total() == 0
    }

    /// Soma dois diagnósticos — usado ao agregar várias raízes numa categoria.
    #[must_use]
    pub const fn merged(self, other: Self) -> Self {
        Self {
            access_denied: self.access_denied + other.access_denied,
            path_too_long: self.path_too_long + other.path_too_long,
            in_use: self.in_use + other.in_use,
            links: self.links + other.links,
            depth_exceeded: self.depth_exceeded + other.depth_exceeded,
            read_errors: self.read_errors + other.read_errors,
        }
    }
}

/// O que a análise de uma categoria encontrou.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryScan {
    /// Identificador estável da categoria.
    pub category: ScanCategory,
    /// Nome exibido.
    pub name: &'static str,
    /// Explicação para o usuário.
    pub description: &'static str,
    /// O que poderá ser feito com esta área numa etapa futura.
    pub removal_policy: RemovalPolicy,
    /// Arquivos encontrados.
    pub file_count: u64,
    /// Pastas percorridas.
    pub folder_count: u64,
    /// Espaço ocupado, em bytes.
    pub size_bytes: u64,
    /// Quanto tempo esta categoria levou.
    pub duration_ms: u64,
    /// Como terminou.
    pub status: ScanStatus,
    /// Explicação, quando o status pede uma.
    pub message: Option<String>,
    /// O que foi ignorado pelo caminho.
    pub skipped: SkippedItems,
}

impl CategoryScan {
    /// Resultado de uma categoria que não existe nesta plataforma.
    #[must_use]
    pub fn not_supported(category: ScanCategory, message: impl Into<String>) -> Self {
        Self::empty(category, ScanStatus::NotSupported, Some(message.into()))
    }

    /// Resultado de uma categoria cujas pastas não existem nesta máquina.
    #[must_use]
    pub fn not_found(category: ScanCategory, message: impl Into<String>) -> Self {
        Self::empty(category, ScanStatus::NotFound, Some(message.into()))
    }

    /// Resultado de uma categoria que não pôde ser analisada.
    #[must_use]
    pub fn failed(category: ScanCategory, message: impl Into<String>) -> Self {
        Self::empty(category, ScanStatus::Failed, Some(message.into()))
    }

    /// Base zerada com o status informado.
    fn empty(category: ScanCategory, status: ScanStatus, message: Option<String>) -> Self {
        Self {
            category,
            name: category.name(),
            description: category.description(),
            removal_policy: category.removal_policy(),
            file_count: 0,
            folder_count: 0,
            size_bytes: 0,
            duration_ms: 0,
            status,
            message,
            skipped: SkippedItems::default(),
        }
    }

    /// Registra quanto tempo a análise levou.
    #[must_use]
    pub const fn with_duration_ms(mut self, duration_ms: u64) -> Self {
        self.duration_ms = duration_ms;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resultado_sem_medicao_nao_entra_no_total() {
        assert!(!ScanStatus::NotFound.has_measurement());
        assert!(!ScanStatus::NotSupported.has_measurement());
        assert!(!ScanStatus::Failed.has_measurement());
        assert!(ScanStatus::Completed.has_measurement());
        assert!(ScanStatus::CompletedWithWarnings.has_measurement());
    }

    #[test]
    fn categoria_ausente_nasce_zerada_e_com_explicacao() {
        let scan = CategoryScan::not_found(ScanCategory::WindowsTemp, "A pasta não existe aqui.");

        assert_eq!(scan.size_bytes, 0);
        assert_eq!(scan.file_count, 0);
        assert_eq!(scan.folder_count, 0);
        assert!(scan.message.is_some());
        assert!(scan.skipped.is_empty());
    }

    #[test]
    fn o_resultado_carrega_o_texto_da_categoria() {
        let scan = CategoryScan::not_supported(ScanCategory::RecycleBin, "Somente no Windows.");

        // A interface não precisa de uma segunda tabela para traduzir o id.
        assert_eq!(scan.name, ScanCategory::RecycleBin.name());
        assert_eq!(scan.description, ScanCategory::RecycleBin.description());
    }

    #[test]
    fn o_diagnostico_soma_por_motivo() {
        let primeiro = SkippedItems {
            access_denied: 2,
            links: 1,
            ..SkippedItems::default()
        };
        let segundo = SkippedItems {
            access_denied: 3,
            in_use: 5,
            ..SkippedItems::default()
        };

        let total = primeiro.merged(segundo);

        assert_eq!(total.access_denied, 5);
        assert_eq!(total.in_use, 5);
        assert_eq!(total.links, 1);
        assert_eq!(total.total(), 11);
    }

    #[test]
    fn o_diagnostico_nunca_carrega_caminhos() {
        // Trava de privacidade: se alguém acrescentar um campo com nome de
        // arquivo, a serialização deixa de ser só de números e o teste quebra.
        let json = serde_json::to_value(SkippedItems {
            access_denied: 1,
            ..SkippedItems::default()
        })
        .expect("serialização");

        let objeto = json.as_object().expect("objeto");
        assert!(
            objeto.values().all(serde_json::Value::is_number),
            "o diagnóstico deve conter apenas contadores: {json}"
        );
    }
}
