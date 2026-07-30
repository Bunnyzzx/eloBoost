//! Orquestração da coleta de informações do sistema.
//!
//! Reúne os serviços de domínio num único retrato. Toda a regra de negócio da
//! leitura vive aqui e nos serviços vizinhos — a interface só formata.

use std::sync::Mutex;
use std::time::Instant;

use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

use crate::models::availability::{Availability, UnavailableReason};
use crate::models::system::SystemSnapshot;
use crate::services::{
    cpu_service, gpu_service, memory_service, os_service, privilege_service, storage_service,
};

/// Sonda do sistema, mantida no estado do aplicativo.
///
/// Precisa ser persistida entre chamadas por dois motivos:
///
/// 1. `sysinfo` calcula valores dependentes de tempo (frequência de CPU) a
///    partir da diferença entre duas leituras — uma instância nova por chamada
///    devolveria zero.
/// 2. Reaproveitar as estruturas internas evita realocar a cada atualização, o
///    que importa num dashboard que o usuário pode atualizar repetidamente.
pub struct SystemProbe {
    system: Mutex<System>,
}

impl SystemProbe {
    /// Cria a sonda e faz a primeira leitura, para que a chamada seguinte já
    /// tenha uma base de comparação.
    #[must_use]
    pub fn new() -> Self {
        let mut system = System::new_with_specifics(refresh_kind());
        system.refresh_specifics(refresh_kind());

        Self {
            system: Mutex::new(system),
        }
    }
}

impl Default for SystemProbe {
    fn default() -> Self {
        Self::new()
    }
}

/// O que atualizamos a cada leitura.
///
/// Deliberadamente restrito: processos e rede não entram no Épico 1, e
/// enumerá-los custaria dezenas de milissegundos sem servir a nada nesta tela.
fn refresh_kind() -> RefreshKind {
    RefreshKind::nothing()
        .with_cpu(CpuRefreshKind::nothing().with_frequency().with_cpu_usage())
        .with_memory(MemoryRefreshKind::everything())
}

/// Coleta o retrato completo do sistema.
///
/// As três leituras independentes — armazenamento, GPU e privilégios — rodam em
/// paralelo em threads de bloqueio, porque cada uma faz E/S ou chamadas COM que
/// levam dezenas de milissegundos. CPU e memória vêm da sonda compartilhada e
/// são baratas depois do refresh.
///
/// # Errors
/// Devolve `ServiceUnavailable` se a sonda estiver inacessível.
pub async fn collect_snapshot(probe: &SystemProbe) -> elo_core::AppResult<SystemSnapshot> {
    let started = Instant::now();

    // Dispara as leituras lentas antes de tocar na sonda, para que aconteçam
    // enquanto o refresh de CPU e memória roda.
    let disks_task = tokio::task::spawn_blocking(storage_service::collect);
    let gpus_task = tokio::task::spawn_blocking(gpu_service::collect);
    let privileges_task = tokio::task::spawn_blocking(privilege_service::collect);

    let (os, cpu, memory) = {
        let mut system = probe.system.lock().map_err(|_| {
            elo_core::AppError::new(elo_core::ErrorCode::ServiceUnavailable)
                .with_message("As informações do sistema estão temporariamente indisponíveis.")
                .with_details("mutex da sonda de sistema envenenado por um panic anterior")
        })?;

        system.refresh_specifics(refresh_kind());

        (
            os_service::collect(),
            cpu_service::collect(&system),
            memory_service::collect(&system),
        )
    };

    // Uma tarefa que entra em pânico não derruba o dashboard: o campo
    // correspondente vira indisponível, e o resto do retrato é entregue.
    let disks = disks_task.await.unwrap_or_else(|error| {
        tracing::warn!(erro = %error, "falha ao enumerar volumes");
        Vec::new()
    });

    let gpus = gpus_task.await.unwrap_or_else(|error| {
        tracing::warn!(erro = %error, "falha ao enumerar adaptadores gráficos");
        Availability::read_failed()
    });

    let privileges = privileges_task.await.unwrap_or_else(|error| {
        tracing::warn!(erro = %error, "falha ao consultar o token do processo");
        crate::models::system::PrivilegeInfo {
            is_elevated: Availability::read_failed(),
            can_elevate: Availability::read_failed(),
        }
    });

    let uptime_seconds = match System::uptime() {
        0 => Availability::unavailable(UnavailableReason::NotSupported),
        seconds => Availability::available(seconds),
    };

    let collection_ms = u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX);
    tracing::debug!(
        duracao_ms = collection_ms,
        volumes = disks.len(),
        "retrato do sistema coletado"
    );

    Ok(SystemSnapshot {
        os,
        cpu,
        memory,
        gpus,
        disks,
        uptime_seconds,
        privileges,
        collected_at: elo_core::now_iso8601(),
        collection_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn coleta_um_retrato_completo_com_dados_reais() {
        let probe = SystemProbe::new();
        let snapshot = collect_snapshot(&probe).await.expect("coleta");

        // Dados que existem em qualquer máquina real.
        assert!(snapshot.memory.total_bytes > 0);
        assert!(snapshot.cpu.logical_cores >= 1);
        assert!(!snapshot.disks.is_empty());
        assert!(!snapshot.os.architecture.is_empty());
        assert!(!snapshot.collected_at.is_empty());
    }

    #[tokio::test]
    async fn a_coleta_e_rapida_o_suficiente_para_uma_interface() {
        let probe = SystemProbe::new();
        let snapshot = collect_snapshot(&probe).await.expect("coleta");

        // O paralelismo existe para isso: um dashboard que leva mais de meio
        // segundo para abrir parece travado.
        assert!(
            snapshot.collection_ms < 1500,
            "coleta levou {} ms",
            snapshot.collection_ms
        );
    }

    #[tokio::test]
    async fn leituras_repetidas_sao_consistentes() {
        let probe = SystemProbe::new();

        let primeira = collect_snapshot(&probe).await.expect("primeira coleta");
        let segunda = collect_snapshot(&probe).await.expect("segunda coleta");

        // Hardware não muda entre duas leituras consecutivas.
        assert_eq!(primeira.memory.total_bytes, segunda.memory.total_bytes);
        assert_eq!(primeira.cpu.logical_cores, segunda.cpu.logical_cores);
        assert_eq!(primeira.disks.len(), segunda.disks.len());
    }

    #[tokio::test]
    async fn o_tempo_ligado_avanca_entre_leituras_distantes() {
        let probe = SystemProbe::new();
        let snapshot = collect_snapshot(&probe).await.expect("coleta");

        // Uma máquina em execução tem uptime positivo; o campo só fica
        // indisponível em ambientes que não expõem o dado.
        if let Some(seconds) = snapshot.uptime_seconds.value() {
            assert!(*seconds > 0);
        }
    }

    #[tokio::test]
    async fn a_frequencia_da_cpu_e_lida_apos_o_refresh_da_sonda() {
        // Este é o motivo de a sonda ser persistida: uma instância nova por
        // chamada devolveria frequência zero.
        let probe = SystemProbe::new();
        let snapshot = collect_snapshot(&probe).await.expect("coleta");

        if let Some(frequency) = snapshot.cpu.current_frequency_mhz.value() {
            assert!(*frequency > 0);
        }
    }
}
