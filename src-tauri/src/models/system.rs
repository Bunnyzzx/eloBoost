//! Contratos das informações do sistema.
//!
//! Espelham `src/types/system.ts`, validado por Zod na camada de IPC. Toda
//! informação que pode não existir no dispositivo usa
//! [`Availability`](crate::models::availability::Availability), nunca um valor
//! padrão silencioso.
//!
//! Tamanhos são sempre em **bytes** e frequências em **MHz**; a formatação é
//! responsabilidade da interface.

use serde::Serialize;

use crate::models::availability::Availability;

/// Retrato completo do computador num instante.
///
/// Um único comando devolve tudo, para que a interface não precise orquestrar
/// várias chamadas nem lidar com estados parcialmente carregados.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    /// Sistema operacional e identificação da máquina.
    pub os: OsInfo,
    /// Processador.
    pub cpu: CpuInfo,
    /// Memória física.
    pub memory: MemoryInfo,
    /// Adaptadores gráficos, em ordem de preferência (o principal primeiro).
    pub gpus: Availability<Vec<GpuInfo>>,
    /// Volumes de armazenamento.
    pub disks: Vec<DiskInfo>,
    /// Tempo desde a última inicialização, em segundos.
    pub uptime_seconds: Availability<u64>,
    /// Privilégio com que o eloBoost está rodando.
    pub privileges: PrivilegeInfo,
    /// Quando este retrato foi coletado (ISO-8601 UTC).
    pub collected_at: String,
    /// Quanto tempo a coleta levou — exibido no diagnóstico.
    pub collection_ms: u64,
}

/// Sistema operacional e identificação da máquina.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OsInfo {
    /// Nome do computador.
    pub computer_name: Availability<String>,
    /// Conta do usuário atual.
    pub user_name: Availability<String>,
    /// Nome do sistema — ex.: "Windows".
    pub name: Availability<String>,
    /// Edição — ex.: "Windows 11 Pro". Só disponível no Windows.
    pub edition: Availability<String>,
    /// Versão comercial — ex.: "23H2". Só disponível no Windows.
    pub display_version: Availability<String>,
    /// Número de build — ex.: 22631.
    pub build: Availability<u32>,
    /// Arquitetura do processo — ex.: `x86_64`, `aarch64`.
    pub architecture: String,
    /// Versão do kernel, quando o sistema expõe.
    pub kernel_version: Availability<String>,
}

/// Processador.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuInfo {
    /// Nome comercial — ex.: "AMD Ryzen 5 5600X".
    pub brand: Availability<String>,
    /// Fabricante.
    pub vendor: Availability<String>,
    /// Núcleos físicos.
    pub physical_cores: Availability<u32>,
    /// Processadores lógicos (núcleos × threads por núcleo).
    pub logical_cores: u32,
    /// Frequência no momento da leitura, em MHz.
    pub current_frequency_mhz: Availability<u64>,
}

/// Memória física.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryInfo {
    /// Total instalado, em bytes.
    pub total_bytes: u64,
    /// Em uso, em bytes.
    pub used_bytes: u64,
    /// Livre para uso imediato, em bytes.
    pub available_bytes: u64,
    /// Percentual em uso, 0–100, já calculado no backend.
    pub used_percent: f64,
    /// Arquivo de paginação — total e em uso.
    pub swap_total_bytes: Availability<u64>,
    /// Uso do arquivo de paginação, em bytes.
    pub swap_used_bytes: Availability<u64>,
}

/// Adaptador gráfico.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    /// Nome do adaptador.
    pub name: String,
    /// Memória dedicada, em bytes.
    pub dedicated_memory_bytes: Availability<u64>,
    /// Memória compartilhada com o sistema, em bytes.
    pub shared_memory_bytes: Availability<u64>,
    /// `true` quando é um adaptador de software (ex.: Microsoft Basic Render).
    pub is_software: bool,
}

/// Volume de armazenamento.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    /// Identificador estável para a interface.
    pub id: String,
    /// Rótulo do volume, quando existe.
    pub name: Availability<String>,
    /// Letra da unidade no Windows — ex.: "C:". No Linux, o ponto de montagem.
    pub mount_point: String,
    /// Sistema de arquivos — ex.: "NTFS".
    pub file_system: Availability<String>,
    /// Capacidade total, em bytes.
    pub total_bytes: u64,
    /// Espaço usado, em bytes.
    pub used_bytes: u64,
    /// Espaço livre, em bytes.
    pub available_bytes: u64,
    /// Percentual usado, 0–100.
    pub used_percent: f64,
    /// SSD, HDD ou desconhecido.
    pub media_type: DiskMediaType,
    /// `true` quando é o volume onde o sistema está instalado.
    pub is_system: bool,
    /// `true` quando é mídia removível.
    pub is_removable: bool,
}

/// Tipo de mídia do volume.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DiskMediaType {
    /// Unidade de estado sólido.
    Ssd,
    /// Disco rígido mecânico.
    Hdd,
    /// Não foi possível determinar.
    Unknown,
}

/// Privilégio do processo atual.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrivilegeInfo {
    /// `true` quando o processo tem privilégio de administrador.
    ///
    /// O eloBoost roda **sem** elevação por padrão (docs/06); este campo existe
    /// para a interface informar o estado e desabilitar ações que exigiriam
    /// elevação, em vez de deixá-las falhar depois do clique.
    pub is_elevated: Availability<bool>,
    /// `true` quando a conta pertence ao grupo de administradores, mesmo sem
    /// estar elevada no momento.
    pub can_elevate: Availability<bool>,
}

/// Informações do próprio aplicativo, para o card de diagnóstico.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppRuntimeInfo {
    /// Nome do produto.
    pub name: String,
    /// Versão do `Cargo.toml`.
    pub version: String,
    /// `debug` ou `release`.
    pub build_profile: String,
    /// Alvo de compilação — ex.: `x86_64-pc-windows-msvc`.
    pub target: String,
    /// Sempre `true` quando respondido pelo backend.
    pub running_in_tauri: bool,
}

impl MemoryInfo {
    /// Calcula o percentual em uso protegendo contra divisão por zero.
    #[must_use]
    pub fn percent(used: u64, total: u64) -> f64 {
        if total == 0 {
            return 0.0;
        }
        // A conversão para f64 perde precisão acima de 2^53 bytes (8 PiB), o que
        // não ocorre em memória nem em volumes de uso doméstico. A precisão de
        // duas casas evita ruído visual quando o valor oscila.
        #[allow(
            clippy::cast_precision_loss,
            reason = "valores reais ficam muito abaixo do limite da mantissa de f64"
        )]
        let ratio = used as f64 / total as f64;
        (ratio * 100.0 * 100.0).round() / 100.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percentual_de_uso_e_arredondado_para_duas_casas() {
        assert!((MemoryInfo::percent(1, 3) - 33.33).abs() < f64::EPSILON);
        assert!((MemoryInfo::percent(1, 2) - 50.0).abs() < f64::EPSILON);
    }

    #[test]
    fn total_zero_nao_divide_por_zero() {
        assert!((MemoryInfo::percent(0, 0) - 0.0).abs() < f64::EPSILON);
        assert!(MemoryInfo::percent(10, 0).is_finite());
    }

    #[test]
    fn percentual_fica_na_faixa_esperada() {
        assert!((MemoryInfo::percent(0, 100) - 0.0).abs() < f64::EPSILON);
        assert!((MemoryInfo::percent(100, 100) - 100.0).abs() < f64::EPSILON);
    }

    #[test]
    fn tipo_de_midia_serializa_em_snake_case() {
        let json = serde_json::to_value(DiskMediaType::Ssd).expect("serialização");
        assert_eq!(json, "ssd");
        let json = serde_json::to_value(DiskMediaType::Unknown).expect("serialização");
        assert_eq!(json, "unknown");
    }
}
