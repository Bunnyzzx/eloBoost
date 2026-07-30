//! Categorias analisadas pelo scanner.
//!
//! A lista é **fechada**: cada variante é uma área conhecida do sistema, com
//! nome e descrição escritos para o usuário final. Nenhuma categoria é criada a
//! partir de dados vindos da interface — o frontend recebe identificadores, não
//! os produz (docs/04 §caminhos).

use serde::Serialize;

/// O que o eloBoost poderá fazer com esta categoria numa etapa futura.
///
/// O scanner é somente leitura, mas a política precisa viajar com o resultado:
/// é ela que impede a interface de oferecer "selecionar tudo" sobre uma pasta
/// pessoal. Downloads é a única categoria que toca arquivos do usuário, e o
/// requisito é explícito — nunca marcada por padrão, nunca removida em lote
/// (docs/05 §2).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RemovalPolicy {
    /// Área descartável do sistema: poderá ser oferecida para limpeza.
    Cleanable,
    /// Somente informativa: exige seleção manual item a item, nunca em lote.
    ManualSelectionOnly,
}

/// Uma área conhecida do sistema que o scanner sabe medir.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanCategory {
    /// `%TEMP%` — temporários do usuário atual.
    UserTemp,
    /// `%SystemRoot%\Temp` — temporários do próprio Windows.
    WindowsTemp,
    /// Lixeira, medida pela API oficial do Windows.
    RecycleBin,
    /// Cache de miniaturas e de ícones do Explorador.
    Thumbnails,
    /// Logs e rastreamentos que o Windows mantém em disco.
    Logs,
    /// Pasta Downloads — **apenas medida**.
    Downloads,
    /// Cache dos navegadores instalados (Chrome, Edge, Firefox).
    BrowserCache,
}

impl ScanCategory {
    /// Todas as categorias, na ordem em que aparecem na interface.
    ///
    /// A ordem é intencional: as áreas do sistema primeiro, e Downloads —
    /// a única que envolve arquivos pessoais — perto do fim, junto do cache de
    /// navegadores, que também é do usuário.
    pub const ALL: [Self; 7] = [
        Self::UserTemp,
        Self::WindowsTemp,
        Self::RecycleBin,
        Self::Thumbnails,
        Self::Logs,
        Self::BrowserCache,
        Self::Downloads,
    ];

    /// Identificador estável, usado no IPC e no banco. Nunca traduzido.
    #[must_use]
    pub const fn id(self) -> &'static str {
        match self {
            Self::UserTemp => "user_temp",
            Self::WindowsTemp => "windows_temp",
            Self::RecycleBin => "recycle_bin",
            Self::Thumbnails => "thumbnails",
            Self::Logs => "logs",
            Self::Downloads => "downloads",
            Self::BrowserCache => "browser_cache",
        }
    }

    /// Nome exibido ao usuário.
    #[must_use]
    pub const fn name(self) -> &'static str {
        match self {
            Self::UserTemp => "Arquivos temporários",
            Self::WindowsTemp => "Temporários do Windows",
            Self::RecycleBin => "Lixeira",
            Self::Thumbnails => "Miniaturas e ícones",
            Self::Logs => "Registros do sistema",
            Self::Downloads => "Downloads",
            Self::BrowserCache => "Cache dos navegadores",
        }
    }

    /// Uma frase explicando o que há ali e por que é descartável.
    ///
    /// Escrita para quem não sabe o que é `%TEMP%`: o objetivo é que a pessoa
    /// entenda o que está vendo antes de qualquer limpeza existir.
    #[must_use]
    pub const fn description(self) -> &'static str {
        match self {
            Self::UserTemp => {
                "Sobras que programas criam enquanto funcionam e esquecem de apagar."
            }
            Self::WindowsTemp => {
                "Arquivos de trabalho do próprio Windows, principalmente de atualizações."
            }
            Self::RecycleBin => "O que você já apagou e ainda ocupa espaço no disco.",
            Self::Thumbnails => {
                "Miniaturas de fotos e ícones guardados para abrir pastas mais rápido. O Windows os recria sozinho."
            }
            Self::Logs => "Anotações técnicas que o Windows guarda sobre o próprio funcionamento.",
            Self::Downloads => {
                "Sua pasta de downloads. O eloBoost apenas mede o tamanho — aqui estão arquivos seus."
            }
            Self::BrowserCache => {
                "Páginas e imagens que os navegadores guardam para carregar sites mais rápido."
            }
        }
    }

    /// O que poderá ser feito com esta categoria numa etapa futura.
    #[must_use]
    pub const fn removal_policy(self) -> RemovalPolicy {
        match self {
            Self::Downloads => RemovalPolicy::ManualSelectionOnly,
            Self::UserTemp
            | Self::WindowsTemp
            | Self::RecycleBin
            | Self::Thumbnails
            | Self::Logs
            | Self::BrowserCache => RemovalPolicy::Cleanable,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn todas_as_categorias_tem_identificador_unico() {
        let mut ids: Vec<&str> = ScanCategory::ALL.iter().map(|c| c.id()).collect();
        ids.sort_unstable();
        let total = ids.len();
        ids.dedup();

        assert_eq!(ids.len(), total, "há identificadores repetidos");
    }

    #[test]
    fn todo_texto_exibido_esta_preenchido_e_e_uma_frase() {
        for category in ScanCategory::ALL {
            assert!(!category.name().is_empty(), "{category:?} sem nome");
            assert!(
                category.description().ends_with('.'),
                "{category:?} sem frase completa"
            );
        }
    }

    #[test]
    fn downloads_e_a_unica_categoria_de_selecao_manual() {
        // Este teste é uma trava de produto: se alguém marcar outra pasta
        // pessoal como limpável em lote, o teste quebra antes do código chegar
        // perto de uma remoção (docs/05 §2).
        for category in ScanCategory::ALL {
            let esperado = if matches!(category, ScanCategory::Downloads) {
                RemovalPolicy::ManualSelectionOnly
            } else {
                RemovalPolicy::Cleanable
            };
            assert_eq!(category.removal_policy(), esperado, "{category:?}");
        }
    }

    #[test]
    fn o_identificador_serializa_em_snake_case() {
        let json = serde_json::to_value(ScanCategory::BrowserCache).expect("serialização");
        assert_eq!(json, "browser_cache");
        assert_eq!(json.as_str(), Some(ScanCategory::BrowserCache.id()));
    }
}
