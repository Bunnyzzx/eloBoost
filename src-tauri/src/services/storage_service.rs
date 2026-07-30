//! Volumes de armazenamento.

use sysinfo::{DiskKind, Disks};

use crate::models::availability::{Availability, UnavailableReason};
use crate::models::system::{DiskInfo, DiskMediaType, MemoryInfo};
use crate::util::text::sanitize;

/// Coleta capacidade, uso e tipo de mídia de cada volume.
///
/// Filtra volumes de capacidade zero: pseudo-sistemas de arquivos do Linux e
/// leitores de cartão vazios no Windows aparecem na enumeração, e exibi-los
/// como "disco 0 B / 0%" só polui o dashboard.
///
/// A ordenação coloca o volume do sistema primeiro — é o que o usuário procura.
#[must_use]
pub fn collect() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();

    let mut result: Vec<DiskInfo> = disks
        .list()
        .iter()
        .filter(|disk| disk.total_space() > 0)
        .map(describe)
        .collect();

    result.sort_by(|a, b| {
        b.is_system
            .cmp(&a.is_system)
            .then_with(|| a.mount_point.cmp(&b.mount_point))
    });

    result
}

/// Converte um volume do `sysinfo` no contrato da interface.
fn describe(disk: &sysinfo::Disk) -> DiskInfo {
    let mount_point = disk.mount_point().to_string_lossy().to_string();
    let total_bytes = disk.total_space();
    let available_bytes = disk.available_space();

    // `used` é derivado: `sysinfo` expõe total e disponível. A saturação evita
    // estouro se a API devolver disponível maior que o total (já observado em
    // sistemas de arquivos de rede).
    let used_bytes = total_bytes.saturating_sub(available_bytes);

    let name = sanitize(&disk.name().to_string_lossy()).map_or_else(
        || Availability::unavailable(UnavailableReason::NotSupported),
        Availability::available,
    );

    let file_system = sanitize(&disk.file_system().to_string_lossy()).map_or_else(
        || Availability::unavailable(UnavailableReason::NotSupported),
        Availability::available,
    );

    DiskInfo {
        // O ponto de montagem é único por volume e estável entre leituras, o que
        // o torna uma chave adequada para as listas do React.
        id: mount_point.clone(),
        name,
        mount_point: mount_point.clone(),
        file_system,
        total_bytes,
        used_bytes,
        available_bytes,
        used_percent: MemoryInfo::percent(used_bytes, total_bytes),
        media_type: media_type(disk.kind()),
        is_system: is_system_volume(&mount_point),
        is_removable: disk.is_removable(),
    }
}

/// Traduz o tipo de mídia, preservando "desconhecido" quando é o caso.
fn media_type(kind: DiskKind) -> DiskMediaType {
    match kind {
        DiskKind::SSD => DiskMediaType::Ssd,
        DiskKind::HDD => DiskMediaType::Hdd,
        // `Unknown` cobre controladores que não reportam o tipo de mídia —
        // comum em RAID, virtualização e alguns adaptadores USB.
        DiskKind::Unknown(_) => DiskMediaType::Unknown,
    }
}

/// Identifica o volume onde o sistema está instalado.
///
/// No Windows, compara com a unidade de `%SystemDrive%` (normalmente `C:`); em
/// outras plataformas, com a raiz.
fn is_system_volume(mount_point: &str) -> bool {
    if cfg!(windows) {
        let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_owned());
        mount_point
            .trim_end_matches(['\\', '/'])
            .eq_ignore_ascii_case(system_drive.trim_end_matches(['\\', '/']))
    } else {
        mount_point == "/"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enumera_volumes_reais_da_maquina() {
        let disks = collect();
        assert!(!disks.is_empty(), "deve haver ao menos um volume montado");
    }

    #[test]
    fn nenhum_volume_de_capacidade_zero_e_exibido() {
        // Pseudo-sistemas de arquivos poluiriam o dashboard com "0 B / 0%".
        for disk in collect() {
            assert!(
                disk.total_bytes > 0,
                "volume {} tem capacidade zero",
                disk.mount_point
            );
        }
    }

    #[test]
    fn uso_e_livre_somam_no_maximo_o_total() {
        for disk in collect() {
            assert!(
                disk.used_bytes + disk.available_bytes <= disk.total_bytes + 1,
                "volume {} tem contas inconsistentes",
                disk.mount_point
            );
        }
    }

    #[test]
    fn percentual_fica_na_faixa_valida() {
        for disk in collect() {
            assert!(disk.used_percent >= 0.0 && disk.used_percent <= 100.0);
        }
    }

    #[test]
    fn identificadores_sao_unicos_para_uso_como_chave_no_react() {
        let disks = collect();
        let mut ids: Vec<&str> = disks.iter().map(|disk| disk.id.as_str()).collect();
        let total = ids.len();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), total, "identificadores de volume duplicados");
    }

    #[test]
    fn o_volume_do_sistema_vem_primeiro() {
        let disks = collect();
        if let Some(index) = disks.iter().position(|disk| disk.is_system) {
            assert_eq!(index, 0, "o volume do sistema deveria abrir a lista");
        }
    }

    #[test]
    fn tipo_de_midia_desconhecido_e_preservado() {
        // Inventar "SSD" para um controlador que não reporta seria enganoso.
        assert_eq!(media_type(DiskKind::Unknown(-1)), DiskMediaType::Unknown);
        assert_eq!(media_type(DiskKind::SSD), DiskMediaType::Ssd);
        assert_eq!(media_type(DiskKind::HDD), DiskMediaType::Hdd);
    }

    #[cfg(not(windows))]
    #[test]
    fn a_raiz_e_reconhecida_como_volume_do_sistema() {
        assert!(is_system_volume("/"));
        assert!(!is_system_volume("/mnt/dados"));
    }
}
