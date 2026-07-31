//! Coordenação da análise do computador.
//!
//! O serviço não sabe **como** medir nada: cada fonte em
//! [`crate::scanner::sources`] resolve as próprias raízes e devolve um
//! [`CategoryScan`] pronto. Aqui só existe orquestração — disparar as categorias
//! em paralelo, publicar cada resultado assim que chega e montar o resumo.
//!
//! **Somente leitura.** Nenhum caminho deste módulo altera o sistema.

use std::time::Instant;

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::CategoryScan;
use crate::models::scan_summary::ScanSummary;
use crate::scanner::{self, sources};

/// Nome do evento emitido a cada categoria concluída.
///
/// A interface escuta este evento para exibir os cards conforme chegam, em vez
/// de esperar a análise inteira. O nome é estável e faz parte do contrato com o
/// frontend (`src/services/scannerService.ts`).
pub const CATEGORY_EVENT: &str = "scanner://category";

/// Nome do evento emitido quando a análise inteira termina.
pub const FINISHED_EVENT: &str = "scanner://finished";

/// Executa a análise de uma categoria.
///
/// O `match` é exaustivo de propósito: acrescentar uma variante em
/// [`ScanCategory`] sem escrever a fonte correspondente não compila.
#[must_use]
pub fn scan_category(category: ScanCategory) -> CategoryScan {
    match category {
        ScanCategory::UserTemp => sources::user_temp::scan(),
        ScanCategory::WindowsTemp => sources::windows_temp::scan(),
        ScanCategory::RecycleBin => sources::recycle_bin::scan(),
        ScanCategory::Thumbnails => sources::thumbnails::scan(),
        ScanCategory::Logs => sources::logs::scan(),
        ScanCategory::Downloads => sources::downloads::scan(),
        ScanCategory::BrowserCache => sources::browser_cache::scan(),
    }
}

/// Recebe cada categoria assim que ela termina.
///
/// Existe para que o serviço não dependa do Tauri: os testes usam um coletor em
/// memória, e o comando usa um que emite eventos para a janela. É o mesmo motivo
/// pelo qual `elo-core` não conhece o Tauri.
pub trait ScanObserver: Send + Sync {
    /// Chamado uma vez por categoria concluída, na ordem de conclusão.
    fn category_finished(&self, scan: &CategoryScan);
}

/// Observador que descarta os avisos — usado quando só interessa o resumo.
pub struct SilentObserver;

impl ScanObserver for SilentObserver {
    fn category_finished(&self, _scan: &CategoryScan) {}
}

/// Analisa o computador inteiro.
///
/// Cada categoria roda numa thread de bloqueio própria: são varreduras de disco,
/// e a mais lenta não deve segurar as outras. Os resultados são publicados no
/// observador **na ordem em que terminam**, e só depois reordenados para o
/// resumo — a interface mostra "Lixeira ✓" imediatamente enquanto Downloads
/// ainda está rodando.
///
/// Uma categoria que entre em pânico não derruba a análise: vira um resultado
/// com status `Failed`, e as demais seguem.
pub async fn scan_all(observer: &dyn ScanObserver) -> ScanSummary {
    let scan_id = elo_core::new_operation_id();
    let started = Instant::now();

    tracing::info!(scan_id = %scan_id, "análise do computador iniciada (somente leitura)");

    let mut running = tokio::task::JoinSet::new();
    for category in ScanCategory::ALL {
        running.spawn_blocking(move || (category, scan_category(category)));
    }

    let mut finished: Vec<CategoryScan> = Vec::with_capacity(ScanCategory::ALL.len());

    while let Some(joined) = running.join_next().await {
        let scan = match joined {
            Ok((_, scan)) => scan,
            Err(error) => {
                // O `JoinSet` não diz qual tarefa falhou, então registramos o
                // que sabemos e seguimos: perder uma categoria é muito melhor do
                // que perder a análise inteira.
                tracing::error!(scan_id = %scan_id, erro = %error, "uma categoria falhou durante a análise");
                continue;
            }
        };

        observer.category_finished(&scan);
        finished.push(scan);
    }

    // Completa as categorias cujas tarefas morreram, para que o relatório sempre
    // tenha uma linha por categoria — uma ausência silenciosa seria pior.
    for category in ScanCategory::ALL {
        if !finished.iter().any(|scan| scan.category == category) {
            let scan =
                CategoryScan::failed(category, "A análise desta área não pôde ser concluída.");
            observer.category_finished(&scan);
            finished.push(scan);
        }
    }

    // Ordem de exibição, não de conclusão.
    finished.sort_by_key(|scan| {
        ScanCategory::ALL
            .iter()
            .position(|category| *category == scan.category)
            .unwrap_or(usize::MAX)
    });

    let duration_ms = scanner::elapsed_ms(started);
    let summary = ScanSummary::from_categories(scan_id, finished, duration_ms);

    tracing::info!(
        scan_id = %summary.scan_id,
        duracao_ms = summary.duration_ms,
        categorias_medidas = summary.measured_categories,
        arquivos = summary.total_files,
        "análise concluída — nenhum arquivo foi alterado"
    );

    summary
}

/// Metadados de todas as categorias, sem executar nenhuma análise.
///
/// A interface usa isto para desenhar a lista de cards antes de a varredura
/// começar, em vez de inventar rótulos do lado dela.
#[must_use]
pub fn list_categories() -> Vec<CategoryScan> {
    ScanCategory::ALL
        .into_iter()
        .map(|category| CategoryScan::not_found(category, "Ainda não analisada."))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::sync::Mutex;

    use crate::models::scan_result::ScanStatus;

    /// Coletor em memória — o motivo de [`ScanObserver`] existir.
    #[derive(Default)]
    struct Coletor {
        recebidos: Mutex<Vec<ScanCategory>>,
    }

    impl ScanObserver for Coletor {
        fn category_finished(&self, scan: &CategoryScan) {
            self.recebidos.lock().expect("coletor").push(scan.category);
        }
    }

    #[tokio::test]
    async fn analisa_todas_as_categorias_conhecidas() {
        let resumo = scan_all(&SilentObserver).await;

        assert_eq!(resumo.categories.len(), ScanCategory::ALL.len());
        for category in ScanCategory::ALL {
            assert!(
                resumo
                    .categories
                    .iter()
                    .any(|scan| scan.category == category),
                "{category:?} ausente do relatório"
            );
        }
    }

    #[tokio::test]
    async fn o_relatorio_sai_na_ordem_de_exibicao_e_nao_na_de_conclusao() {
        let resumo = scan_all(&SilentObserver).await;

        let obtida: Vec<ScanCategory> = resumo.categories.iter().map(|s| s.category).collect();
        assert_eq!(obtida, ScanCategory::ALL.to_vec());
    }

    #[tokio::test]
    async fn cada_categoria_e_publicada_assim_que_termina() {
        let coletor = Coletor::default();
        let resumo = scan_all(&coletor).await;

        let recebidos = coletor.recebidos.lock().expect("coletor").clone();

        // Uma notificação por categoria — é o que permite à interface mostrar os
        // cards conforme chegam, sem esperar a análise inteira.
        assert_eq!(recebidos.len(), resumo.categories.len());
        let mut ordenados = recebidos.clone();
        ordenados.sort_unstable();
        ordenados.dedup();
        assert_eq!(ordenados.len(), ScanCategory::ALL.len());
    }

    #[tokio::test]
    async fn uma_categoria_indisponivel_nao_derruba_as_outras() {
        // Fora do Windows, quatro categorias são inerentemente indisponíveis.
        // A análise ainda assim conclui e mede as que existem.
        let resumo = scan_all(&SilentObserver).await;

        let concluidas = resumo
            .categories
            .iter()
            .filter(|scan| scan.status.has_measurement())
            .count();

        assert!(concluidas >= 1, "nenhuma categoria foi medida");
        assert!(resumo
            .categories
            .iter()
            .all(|scan| { scan.status != ScanStatus::Failed || scan.message.is_some() }));
    }

    #[tokio::test]
    async fn a_analise_completa_e_rapida_o_suficiente_para_uma_interface() {
        let resumo = scan_all(&SilentObserver).await;

        // O paralelismo existe para isto. O limite é folgado porque o tamanho
        // real depende da máquina — o que o teste protege é a ordem de grandeza.
        assert!(
            resumo.duration_ms < 120_000,
            "análise levou {} ms",
            resumo.duration_ms
        );
    }

    #[tokio::test]
    async fn o_resumo_nunca_inclui_downloads_no_espaco_recuperavel() {
        let resumo = scan_all(&SilentObserver).await;

        let downloads = resumo
            .categories
            .iter()
            .find(|scan| scan.category == ScanCategory::Downloads)
            .expect("Downloads no relatório");

        if downloads.status.has_measurement() && downloads.size_bytes > 0 {
            assert!(resumo.reclaimable_bytes < resumo.measured_bytes);
        }
    }

    #[test]
    fn a_lista_de_categorias_descreve_todas_sem_analisar_nada() {
        let categorias = list_categories();

        assert_eq!(categorias.len(), ScanCategory::ALL.len());
        assert!(categorias.iter().all(|scan| scan.size_bytes == 0));
        assert!(categorias.iter().all(|scan| !scan.name.is_empty()));
    }

    #[tokio::test]
    async fn a_analise_completa_nao_toca_num_arquivo_da_area_varrida() {
        // A verificação central do Épico 2, no nível do serviço: plantamos uma
        // sentinela dentro da pasta temporária — que a análise realmente
        // percorre — e conferimos conteúdo, tamanho e data depois.
        //
        // Uma sentinela própria em vez de contar a pasta inteira: outros testes
        // criam e removem arquivos ali em paralelo, e a contagem oscilaria por
        // motivos que nada têm a ver com o scanner.
        let sentinela = std::env::temp_dir().join(format!(
            "eloboost-sentinela-{}.tmp",
            elo_core::new_operation_id()
        ));
        std::fs::write(&sentinela, b"conteudo original da sentinela").expect("criar sentinela");

        let metadata_antes = std::fs::metadata(&sentinela).expect("metadados");
        let modificado_antes = metadata_antes.modified().ok();

        let _ = scan_all(&SilentObserver).await;

        let conteudo = std::fs::read(&sentinela).expect("ler sentinela");
        let metadata_depois = std::fs::metadata(&sentinela).expect("metadados");

        let _ = std::fs::remove_file(&sentinela);

        assert_eq!(conteudo, b"conteudo original da sentinela");
        assert_eq!(metadata_antes.len(), metadata_depois.len());
        assert_eq!(modificado_antes, metadata_depois.modified().ok());
    }
}
