//! Memória física e arquivo de paginação.

use sysinfo::System;

use crate::models::availability::{Availability, UnavailableReason};
use crate::models::system::MemoryInfo;

/// Coleta total, em uso e disponível, em bytes.
///
/// `sysinfo` já devolve bytes; nenhuma conversão de unidade acontece aqui — a
/// formatação é responsabilidade da interface.
#[must_use]
pub fn collect(system: &System) -> MemoryInfo {
    let total_bytes = system.total_memory();
    let used_bytes = system.used_memory();
    let available_bytes = system.available_memory();

    let swap_total = system.total_swap();
    let swap_used = system.used_swap();

    MemoryInfo {
        total_bytes,
        used_bytes,
        available_bytes,
        used_percent: MemoryInfo::percent(used_bytes, total_bytes),
        // Um total de zero significa paginação desativada — o que é um estado
        // legítimo, e diferente de "não conseguimos ler".
        swap_total_bytes: if swap_total > 0 {
            Availability::available(swap_total)
        } else {
            Availability::unavailable(UnavailableReason::NotSupported)
        },
        swap_used_bytes: if swap_total > 0 {
            Availability::available(swap_used)
        } else {
            Availability::unavailable(UnavailableReason::NotSupported)
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sysinfo::{MemoryRefreshKind, RefreshKind};

    fn system_atualizado() -> System {
        System::new_with_specifics(
            RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()),
        )
    }

    #[test]
    fn le_memoria_real_da_maquina() {
        let memory = collect(&system_atualizado());

        assert!(memory.total_bytes > 0, "toda máquina tem memória instalada");
        assert!(memory.used_bytes > 0, "o processo atual já consome memória");
    }

    #[test]
    fn uso_nunca_excede_o_total() {
        let memory = collect(&system_atualizado());
        assert!(memory.used_bytes <= memory.total_bytes);
    }

    #[test]
    fn percentual_e_coerente_com_os_bytes() {
        let memory = collect(&system_atualizado());

        assert!(memory.used_percent >= 0.0);
        assert!(memory.used_percent <= 100.0);

        let esperado = MemoryInfo::percent(memory.used_bytes, memory.total_bytes);
        assert!((memory.used_percent - esperado).abs() < 0.01);
    }

    #[test]
    fn paginacao_desativada_e_indisponivel_em_vez_de_zero() {
        let memory = collect(&System::new());
        // Sem refresh de memória, o total de swap é zero: precisa vir como
        // indisponível, nunca como "0 B de paginação em uso".
        if let Availability::Available { value } = memory.swap_total_bytes {
            assert!(value > 0);
        }
    }
}
