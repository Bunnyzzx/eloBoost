//! Adaptadores gráficos.

use crate::models::availability::Availability;
use crate::models::system::GpuInfo;
use crate::system::ffi;

/// Coleta os adaptadores gráficos via DXGI.
///
/// A ordem do DXGI já coloca o adaptador principal primeiro, então a interface
/// pode simplesmente exibir o primeiro item como "GPU principal".
///
/// Fora do Windows não há fonte equivalente sem adicionar dependências pesadas,
/// então o campo inteiro vem indisponível com motivo — a interface exibe a frase
/// padrão em vez de um nome genérico.
#[must_use]
pub fn collect() -> Availability<Vec<GpuInfo>> {
    let Some(adapters) = ffi::graphics_adapters() else {
        return Availability::not_supported();
    };

    let mut gpus: Vec<GpuInfo> = adapters
        .into_iter()
        .map(|adapter| GpuInfo {
            name: adapter.name,
            // Zero de memória dedicada é o normal em GPU integrada: é um fato,
            // não uma falha de leitura.
            dedicated_memory_bytes: Availability::available(adapter.dedicated_video_memory),
            shared_memory_bytes: Availability::available(adapter.shared_system_memory),
            is_software: adapter.is_software,
        })
        .collect();

    if gpus.is_empty() {
        return Availability::read_failed();
    }

    // Adaptadores de software (ex.: Microsoft Basic Render Driver) vão para o
    // fim: existem em toda máquina e não representam o hardware do usuário.
    gpus.sort_by_key(|gpu| gpu.is_software);

    Availability::available(gpus)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nunca_entra_em_panico_na_plataforma_atual() {
        let _ = collect();
    }

    #[cfg(not(windows))]
    #[test]
    fn fora_do_windows_a_gpu_e_declarada_indisponivel() {
        // Sem inventar "Placa de vídeo genérica".
        assert!(!collect().is_available());
    }

    #[cfg(windows)]
    #[test]
    fn no_windows_ha_gpu_com_nome_preenchido() {
        let gpus = collect();
        let list = gpus.value().expect("DXGI deve enumerar adaptadores");
        assert!(!list.is_empty());
        assert!(list.iter().all(|gpu| !gpu.name.trim().is_empty()));
    }

    #[cfg(windows)]
    #[test]
    fn adaptadores_de_software_ficam_no_fim_da_lista() {
        let gpus = collect();
        if let Some(list) = gpus.value() {
            let primeiro_software = list.iter().position(|gpu| gpu.is_software);
            let ultimo_hardware = list.iter().rposition(|gpu| !gpu.is_software);
            if let (Some(software), Some(hardware)) = (primeiro_software, ultimo_hardware) {
                assert!(software > hardware);
            }
        }
    }
}
