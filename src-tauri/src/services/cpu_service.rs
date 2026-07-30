//! Informações do processador.

use sysinfo::System;

use crate::models::availability::{Availability, UnavailableReason};
use crate::models::system::CpuInfo;
use crate::util::text::sanitize;

/// Coleta marca, fabricante, contagem de núcleos e frequência atual.
///
/// Recebe o `System` já atualizado pelo orquestrador — criar uma instância nova
/// aqui devolveria frequência zerada, porque `sysinfo` precisa de duas leituras
/// para calcular valores dependentes de tempo.
#[must_use]
pub fn collect(system: &System) -> CpuInfo {
    let cpus = system.cpus();
    let first = cpus.first();

    let brand = first.and_then(|cpu| sanitize(cpu.brand())).map_or_else(
        || Availability::unavailable(UnavailableReason::ReadFailed),
        Availability::available,
    );

    let vendor = first.and_then(|cpu| sanitize(cpu.vendor_id())).map_or_else(
        || Availability::unavailable(UnavailableReason::NotSupported),
        Availability::available,
    );

    // Núcleos lógicos: um item por processador lógico na lista do `sysinfo`.
    let logical_cores = u32::try_from(cpus.len()).unwrap_or(0);

    let physical_cores = System::physical_core_count()
        .and_then(|count| u32::try_from(count).ok())
        .map_or_else(
            // Em algumas máquinas virtuais o dado não é exposto. Reportar
            // indisponível é mais honesto que assumir "metade dos lógicos".
            || Availability::unavailable(UnavailableReason::NotSupported),
            Availability::available,
        );

    let current_frequency_mhz = first
        .map(sysinfo::Cpu::frequency)
        .filter(|frequency| *frequency > 0)
        .map_or_else(
            || Availability::unavailable(UnavailableReason::NotSupported),
            Availability::available,
        );

    CpuInfo {
        brand,
        vendor,
        physical_cores,
        logical_cores,
        current_frequency_mhz,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sysinfo::{CpuRefreshKind, RefreshKind};

    fn system_atualizado() -> System {
        System::new_with_specifics(RefreshKind::nothing().with_cpu(CpuRefreshKind::everything()))
    }

    #[test]
    fn reporta_ao_menos_um_nucleo_logico_real() {
        let cpu = collect(&system_atualizado());
        assert!(
            cpu.logical_cores >= 1,
            "toda máquina tem ao menos um núcleo"
        );
    }

    #[test]
    fn nucleos_fisicos_nunca_excedem_os_logicos() {
        let cpu = collect(&system_atualizado());
        if let Some(physical) = cpu.physical_cores.value() {
            assert!(*physical <= cpu.logical_cores);
            assert!(*physical >= 1);
        }
    }

    #[test]
    fn marca_do_processador_e_lida_ou_marcada_indisponivel() {
        let cpu = collect(&system_atualizado());
        match cpu.brand {
            Availability::Available { value } => assert!(!value.trim().is_empty()),
            Availability::Unavailable { .. } => {}
        }
    }

    #[test]
    fn frequencia_zero_e_tratada_como_indisponivel() {
        // Um `System` sem refresh de CPU não tem frequência: o serviço precisa
        // reportar indisponível em vez de exibir "0 MHz" como se fosse real.
        let vazio = System::new();
        let cpu = collect(&vazio);
        if let Availability::Available { value } = cpu.current_frequency_mhz {
            assert!(value > 0, "frequência disponível nunca pode ser zero");
        }
    }
}
