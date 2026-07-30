//! Único módulo do eloBoost autorizado a usar `unsafe`.
//!
//! Contém exclusivamente chamadas Win32 de **leitura**, cada uma encapsulada
//! numa função segura que devolve `Option`/`Result`. Nada aqui escreve no
//! sistema, no registro ou em arquivos.
//!
//! Política (docs/05 §7):
//!   • todo bloco `unsafe` tem um comentário `// SAFETY:` justificando;
//!   • nenhum ponteiro cru escapa deste módulo;
//!   • toda string do sistema passa por [`crate::util::text::sanitize`];
//!   • falha de API vira `None`, nunca `panic`.
//!
//! Em plataformas que não são Windows, as funções devolvem `None` — o que faz o
//! serviço marcar o campo como indisponível, com motivo, em vez de inventar.

#![allow(
    unsafe_code,
    reason = "fronteira Win32: as chamadas de leitura ficam confinadas aqui"
)]

/// Versão do Windows lida do registro.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowsVersion {
    /// Edição — ex.: "Windows 11 Pro".
    pub product_name: Option<String>,
    /// Versão comercial — ex.: "23H2".
    pub display_version: Option<String>,
    /// Número de build — ex.: 22631.
    pub build: Option<u32>,
}

/// Adaptador gráfico enumerado via DXGI.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphicsAdapter {
    /// Nome do adaptador.
    pub name: String,
    /// Memória dedicada de vídeo, em bytes.
    pub dedicated_video_memory: u64,
    /// Memória compartilhada com o sistema, em bytes.
    pub shared_system_memory: u64,
    /// `true` para adaptadores de software (ex.: Microsoft Basic Render Driver).
    pub is_software: bool,
}

/// Privilégio do processo atual.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProcessPrivileges {
    /// O token atual está elevado.
    pub is_elevated: bool,
    /// A conta pertence ao grupo de administradores.
    pub is_admin_member: bool,
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementação Windows
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(windows)]
mod imp {
    use super::{GraphicsAdapter, ProcessPrivileges, WindowsVersion};
    use crate::util::text::sanitize;

    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, IDXGIAdapter1, IDXGIFactory1, DXGI_ADAPTER_FLAG,
        DXGI_ADAPTER_FLAG_SOFTWARE,
    };
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_LOCAL_MACHINE, KEY_READ,
        REG_VALUE_TYPE,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

    /// Caminho da chave que descreve a versão instalada do Windows.
    const CURRENT_VERSION_KEY: PCWSTR = w!(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion");

    /// Abre uma subchave de `HKEY_LOCAL_MACHINE` apenas para leitura.
    fn open_local_machine_key(path: PCWSTR) -> Option<HKEY> {
        let mut key = HKEY::default();

        // SAFETY: `path` é um literal wide terminado em nulo (`w!`), `key` é uma
        // saída válida e o acesso pedido é somente leitura. O resultado é
        // verificado antes de usar a chave.
        let status =
            unsafe { RegOpenKeyExW(HKEY_LOCAL_MACHINE, path, Some(0), KEY_READ, &mut key) };

        status.is_ok().then_some(key)
    }

    /// Fecha uma chave do registro.
    fn close_key(key: HKEY) {
        // SAFETY: `key` foi obtida de `RegOpenKeyExW` e não é usada depois disto.
        let _ = unsafe { RegCloseKey(key) };
    }

    /// Lê um valor de texto do registro.
    fn read_string_value(key: HKEY, name: PCWSTR) -> Option<String> {
        let mut kind = REG_VALUE_TYPE::default();
        let mut size: u32 = 0;

        // SAFETY: primeira chamada apenas consulta o tamanho necessário —
        // `lpData` nulo é o contrato documentado para isso.
        let status =
            unsafe { RegQueryValueExW(key, name, None, Some(&mut kind), None, Some(&mut size)) };
        if status.is_err() || size == 0 {
            return None;
        }

        // O tamanho vem em bytes; UTF-16 usa dois bytes por unidade.
        let mut buffer = vec![0_u16; (size as usize).div_ceil(2)];

        // SAFETY: `buffer` tem capacidade para `size` bytes, e `size` é passado
        // por referência para que a API respeite esse limite.
        let status = unsafe {
            RegQueryValueExW(
                key,
                name,
                None,
                Some(&mut kind),
                Some(buffer.as_mut_ptr().cast()),
                Some(&mut size),
            )
        };
        if status.is_err() {
            return None;
        }

        let text = String::from_utf16_lossy(&buffer);
        sanitize(&text)
    }

    /// Lê um valor numérico (`REG_DWORD`) do registro.
    fn read_u32_value(key: HKEY, name: PCWSTR) -> Option<u32> {
        let mut value: u32 = 0;
        let mut size = u32::try_from(std::mem::size_of::<u32>()).ok()?;
        let mut kind = REG_VALUE_TYPE::default();

        // SAFETY: `value` é um u32 vivo e `size` descreve exatamente o seu
        // tamanho, então a API não pode escrever além dele.
        let status = unsafe {
            RegQueryValueExW(
                key,
                name,
                None,
                Some(&mut kind),
                Some(std::ptr::from_mut(&mut value).cast()),
                Some(&mut size),
            )
        };

        status.is_ok().then_some(value)
    }

    pub fn windows_version() -> Option<WindowsVersion> {
        let key = open_local_machine_key(CURRENT_VERSION_KEY)?;

        let product_name = read_string_value(key, w!("ProductName"));
        let display_version = read_string_value(key, w!("DisplayVersion"));

        // `CurrentBuildNumber` é texto; `CurrentBuild` existe em builds mais
        // novas. Tentamos o numérico primeiro e caímos no texto.
        let build = read_u32_value(key, w!("CurrentBuildNumber")).or_else(|| {
            read_string_value(key, w!("CurrentBuildNumber"))
                .and_then(|text| text.parse::<u32>().ok())
        });

        close_key(key);

        // A partir do Windows 11, `ProductName` continua dizendo "Windows 10".
        // Corrigir pelo número de build é a prática documentada.
        let product_name = match (product_name, build) {
            (Some(name), Some(build)) if build >= 22_000 => {
                Some(name.replace("Windows 10", "Windows 11"))
            }
            (name, _) => name,
        };

        Some(WindowsVersion {
            product_name,
            display_version,
            build,
        })
    }

    pub fn graphics_adapters() -> Option<Vec<GraphicsAdapter>> {
        // SAFETY: `CreateDXGIFactory1` devolve a interface por ponteiro de saída
        // e o `Result` é propagado; nenhum ponteiro cru é mantido.
        let factory: IDXGIFactory1 = unsafe { CreateDXGIFactory1() }.ok()?;

        let mut adapters = Vec::new();
        for index in 0..16_u32 {
            // SAFETY: `EnumAdapters1` devolve erro quando o índice acaba, o que
            // encerra o laço. O limite de 16 é uma salvaguarda extra.
            let Ok(adapter) = (unsafe { factory.EnumAdapters1(index) }) else {
                break;
            };
            if let Some(info) = describe_adapter(&adapter) {
                adapters.push(info);
            }
        }

        (!adapters.is_empty()).then_some(adapters)
    }

    fn describe_adapter(adapter: &IDXGIAdapter1) -> Option<GraphicsAdapter> {
        // SAFETY: `GetDesc1` preenche a struct passada por referência mutável;
        // ela é inicializada com o padrão antes da chamada.
        let mut desc = Default::default();
        unsafe { adapter.GetDesc1(&mut desc) }.ok()?;

        let name = sanitize(&String::from_utf16_lossy(&desc.Description))?;
        let is_software = DXGI_ADAPTER_FLAG(desc.Flags).0 & DXGI_ADAPTER_FLAG_SOFTWARE.0 != 0;

        Some(GraphicsAdapter {
            name,
            dedicated_video_memory: desc.DedicatedVideoMemory as u64,
            shared_system_memory: desc.SharedSystemMemory as u64,
            is_software,
        })
    }

    pub fn process_privileges() -> Option<ProcessPrivileges> {
        let mut token = HANDLE::default();

        // SAFETY: `GetCurrentProcess` devolve um pseudo-handle sempre válido e
        // não precisa ser fechado; `token` é uma saída válida.
        let opened = unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) };
        if opened.is_err() {
            return None;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut returned: u32 = 0;
        let size = u32::try_from(std::mem::size_of::<TOKEN_ELEVATION>()).ok()?;

        // SAFETY: `elevation` é uma struct viva e `size` descreve exatamente o
        // seu tamanho, então a API não escreve além dele.
        let queried = unsafe {
            GetTokenInformation(
                token,
                TokenElevation,
                Some(std::ptr::from_mut(&mut elevation).cast()),
                size,
                &mut returned,
            )
        };

        // SAFETY: `token` veio de `OpenProcessToken` e não é usado após o fecho.
        let _ = unsafe { CloseHandle(token) };

        if queried.is_err() {
            return None;
        }

        let is_elevated = elevation.TokenIsElevated != 0;

        Some(ProcessPrivileges {
            is_elevated,
            // Um processo elevado é necessariamente membro do grupo. Determinar
            // pertencimento sem elevação exige `CheckTokenMembership` com o SID
            // de administradores, que entra no Épico 7 junto com o broker.
            is_admin_member: is_elevated,
        })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementação para plataformas que não são Windows
//
// Existe para que o crate compile e seja testável no ambiente de
// desenvolvimento. Devolve `None`, o que a camada de serviço traduz em
// "informação não suportada neste dispositivo" — nunca num valor inventado.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(not(windows))]
mod imp {
    use super::{GraphicsAdapter, ProcessPrivileges, WindowsVersion};

    pub fn windows_version() -> Option<WindowsVersion> {
        None
    }

    pub fn graphics_adapters() -> Option<Vec<GraphicsAdapter>> {
        None
    }

    pub fn process_privileges() -> Option<ProcessPrivileges> {
        None
    }
}

/// Edição, versão comercial e build do Windows.
///
/// `None` fora do Windows ou se o registro não pôde ser lido.
#[must_use]
pub fn windows_version() -> Option<WindowsVersion> {
    imp::windows_version()
}

/// Adaptadores gráficos, na ordem em que o DXGI os enumera (principal primeiro).
///
/// `None` fora do Windows ou se o DXGI não estiver disponível.
#[must_use]
pub fn graphics_adapters() -> Option<Vec<GraphicsAdapter>> {
    imp::graphics_adapters()
}

/// Privilégio do processo atual.
///
/// `None` fora do Windows ou se o token não pôde ser consultado.
#[must_use]
pub fn process_privileges() -> Option<ProcessPrivileges> {
    imp::process_privileges()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nenhuma_funcao_entra_em_panico_na_plataforma_atual() {
        // O contrato deste módulo é nunca entrar em pânico: uma API indisponível
        // devolve `None`. Este teste roda em qualquer plataforma.
        let _ = windows_version();
        let _ = graphics_adapters();
        let _ = process_privileges();
    }

    #[cfg(not(windows))]
    #[test]
    fn fora_do_windows_tudo_e_none_em_vez_de_valor_inventado() {
        assert!(windows_version().is_none());
        assert!(graphics_adapters().is_none());
        assert!(process_privileges().is_none());
    }

    #[cfg(windows)]
    #[test]
    fn no_windows_a_versao_traz_pelo_menos_o_numero_de_build() {
        let version = windows_version().expect("registro do Windows deve ser legível");
        assert!(version.build.is_some_and(|build| build > 0));
    }

    #[cfg(windows)]
    #[test]
    fn no_windows_ha_pelo_menos_um_adaptador_grafico() {
        let adapters = graphics_adapters().expect("DXGI deve enumerar adaptadores");
        assert!(!adapters.is_empty());
        assert!(adapters.iter().all(|a| !a.name.is_empty()));
    }
}
