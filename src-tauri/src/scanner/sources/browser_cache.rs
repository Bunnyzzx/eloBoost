//! Cache dos navegadores instalados: Chrome, Edge e Firefox.
//!
//! Uma categoria, várias raízes. Os navegadores baseados em Chromium (Chrome e
//! Edge) guardam o cache dentro de cada **perfil**, e uma instalação comum tem
//! vários — `Default`, `Profile 1`, `Profile 2`. O Firefox faz o mesmo em
//! `Profiles\<aleatório>.<nome>`. Por isso os perfis são enumerados a partir do
//! diretório de dados do navegador, em vez de assumir apenas o perfil padrão:
//! medir só o `Default` daria um número menor que o real em qualquer máquina com
//! mais de uma conta no navegador.
//!
//! Só entram subpastas de cache **conhecidas**. O diretório de perfil também
//! contém histórico, favoritos, senhas e cookies — nada disso é percorrido, e o
//! scanner não abre nenhum arquivo: apenas lê o tamanho registrado no diretório.
//!
//! Um navegador não instalado simplesmente não contribui: a raiz não existe, e o
//! walker a ignora sem erro.

use std::path::{Path, PathBuf};

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::scanner::{self, locations, ScanRoot};

const CATEGORY: ScanCategory = ScanCategory::BrowserCache;

/// Subpastas de cache dentro de um perfil Chromium.
const CHROMIUM_CACHE_DIRS: &[&str] = &[
    "Cache",
    "Code Cache",
    "GPUCache",
    "Service Worker/CacheStorage",
];

/// Subpastas de cache dentro de um perfil Firefox.
const FIREFOX_CACHE_DIRS: &[&str] = &["cache2", "startupCache", "thumbnails"];

/// Diretórios de dados dos navegadores Chromium instalados.
///
/// No Windows, sob `%LOCALAPPDATA%`. Fora dele os mesmos navegadores existem em
/// locais diferentes, e mapeá-los permite exercitar esta fonte de verdade
/// durante o desenvolvimento, em vez de testá-la só com dados simulados.
fn chromium_data_dirs() -> Vec<PathBuf> {
    if let Some(local) = locations::local_app_data() {
        return vec![
            local.join("Google").join("Chrome").join("User Data"),
            local.join("Microsoft").join("Edge").join("User Data"),
            local.join("Chromium").join("User Data"),
        ];
    }

    let Some(config) = locations::unix_config_home() else {
        return Vec::new();
    };

    vec![
        config.join("google-chrome"),
        config.join("microsoft-edge"),
        config.join("chromium"),
    ]
}

/// Diretórios que contêm os perfis do Firefox.
fn firefox_profile_dirs() -> Vec<PathBuf> {
    if let Some(roaming) = locations::roaming_app_data() {
        return vec![roaming.join("Mozilla").join("Firefox").join("Profiles")];
    }

    let mut dirs = Vec::new();
    if let Some(home) = locations::user_profile() {
        dirs.push(home.join(".mozilla").join("firefox"));
    }
    if let Some(cache) = locations::unix_cache_home() {
        // No Linux o cache do Firefox mora fora do perfil, em ~/.cache.
        dirs.push(cache.join("mozilla").join("firefox"));
    }
    dirs
}

/// Lista as subpastas diretas de um diretório, sem seguir links.
///
/// Somente leitura: `read_dir` mais os metadados da própria entrada. Uma pasta
/// inexistente devolve lista vazia — é o caso de um navegador não instalado.
fn child_directories(parent: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(parent) else {
        return Vec::new();
    };

    entries
        .filter_map(Result::ok)
        .filter(|entry| {
            entry
                .metadata()
                .is_ok_and(|metadata| metadata.is_dir() && !metadata.is_symlink())
        })
        .map(|entry| entry.path())
        .collect()
}

/// Monta as raízes de cache a partir dos perfis encontrados.
fn cache_roots(profiles: &[PathBuf], cache_dirs: &[&str]) -> Vec<ScanRoot> {
    profiles
        .iter()
        .flat_map(|profile| {
            cache_dirs
                .iter()
                .map(move |relative| ScanRoot::recursive(profile.join(relative)))
        })
        .collect()
}

/// Raízes desta categoria neste computador.
#[must_use]
pub fn roots() -> Vec<ScanRoot> {
    let mut roots = Vec::new();

    for data_dir in chromium_data_dirs() {
        // Cada subpasta do diretório de dados é um perfil em potencial. As que
        // não tiverem pasta de cache simplesmente não contribuem.
        let profiles = child_directories(&data_dir);
        roots.extend(cache_roots(&profiles, CHROMIUM_CACHE_DIRS));
    }

    for profiles_dir in firefox_profile_dirs() {
        let profiles = child_directories(&profiles_dir);
        roots.extend(cache_roots(&profiles, FIREFOX_CACHE_DIRS));
    }

    roots
}

/// Analisa a categoria. Somente leitura — nenhum arquivo do navegador é aberto.
#[must_use]
pub fn scan() -> CategoryScan {
    let roots = roots();
    if roots.is_empty() {
        return CategoryScan::not_found(
            CATEGORY,
            "Nenhum navegador com cache foi encontrado neste computador.",
        );
    }
    scanner::scan_roots(CATEGORY, &roots)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nenhuma_raiz_aponta_para_dados_pessoais_do_navegador() {
        // Histórico, senhas, cookies e favoritos vivem no mesmo perfil. Se uma
        // raiz de cache passasse a apontar para eles, este teste quebra.
        const PROIBIDOS: [&str; 6] = [
            "History",
            "Cookies",
            "Login Data",
            "Bookmarks",
            "Web Data",
            "places.sqlite",
        ];

        for root in roots() {
            let caminho = root.path.to_string_lossy().to_string();
            for proibido in PROIBIDOS {
                assert!(
                    !caminho.contains(proibido),
                    "raiz tocaria dados pessoais: {caminho}"
                );
            }
        }
    }

    #[test]
    fn toda_raiz_termina_numa_pasta_de_cache_conhecida() {
        for root in roots() {
            let caminho = root.path.to_string_lossy().replace('\\', "/");
            let conhecida = CHROMIUM_CACHE_DIRS
                .iter()
                .chain(FIREFOX_CACHE_DIRS.iter())
                .any(|dir| caminho.ends_with(&dir.replace('\\', "/")));

            assert!(conhecida, "raiz fora da lista conhecida: {caminho}");
        }
    }

    #[test]
    fn pasta_inexistente_nao_produz_perfis() {
        let inexistente = Path::new("/eloboost-navegador-que-nao-existe");
        assert!(child_directories(inexistente).is_empty());
    }

    #[test]
    fn cada_perfil_gera_uma_raiz_por_pasta_de_cache() {
        let perfis = vec![
            PathBuf::from("/perfis/Default"),
            PathBuf::from("/perfis/P1"),
        ];
        let roots = cache_roots(&perfis, CHROMIUM_CACHE_DIRS);

        // O ponto: uma instalação com dois perfis mede os dois.
        assert_eq!(roots.len(), perfis.len() * CHROMIUM_CACHE_DIRS.len());
        assert!(roots.iter().all(|root| root.recursive));
    }

    #[test]
    fn sem_navegador_instalado_a_categoria_reporta_ausencia_sem_erro() {
        let scan = scan();

        // Em qualquer máquina o resultado é legítimo: ou mede algo, ou diz que
        // não encontrou navegador. O que não pode é falhar.
        assert!(
            matches!(
                scan.status,
                crate::models::scan_result::ScanStatus::Completed
                    | crate::models::scan_result::ScanStatus::CompletedWithWarnings
                    | crate::models::scan_result::ScanStatus::NotFound
            ),
            "status inesperado: {:?}",
            scan.status
        );
    }
}
