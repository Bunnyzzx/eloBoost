//! O coração da limpeza: percorre, valida e remove.
//!
//! A Engine reaproveita a caminhada do scanner ([`crate::scanner::walk_root_with`])
//! em vez de escrever a sua. Todas as regras de travessia — nunca seguir link,
//! limite de profundidade, filtro por raiz, classificação de erro de leitura —
//! existem num lugar só e valem igualmente para analisar e para limpar.
//!
//! O fluxo por arquivo é sempre o mesmo, e é curto de propósito:
//!
//! ```text
//! caminhada → PathGuard::validate → still_matches → remove_file
//! ```
//!
//! Entre validar e remover não acontece mais nada, o que mantém a janela de
//! troca do arquivo no mínimo.

use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::cleaner::executor::{self, RemovalTally};
use crate::cleaner::validator::PathGuard;
use crate::cleaner::CleanObserver;
use crate::models::clean_result::CategoryCleanResult;
use crate::models::scan_category::ScanCategory;
use crate::scanner::{self, ScanRoot, WalkVisitor};

/// Visitante que remove cada arquivo aceito pela caminhada.
///
/// Vive aqui, em `cleaner/`, e não em `scanner/`: o módulo de varredura
/// continua sem nenhuma API de escrita, e o teste que verifica isso continua
/// valendo alguma coisa.
struct RemovingVisitor<'a> {
    guard: &'a PathGuard,
    tally: &'a mut RemovalTally,
    /// Diretórios visitados, para a passagem de remoção de pastas vazias.
    ///
    /// Cresce com a **quantidade de pastas**, não de arquivos — uma área com
    /// meio milhão de arquivos em cem pastas custa cem caminhos.
    directories: Vec<PathBuf>,
    /// Observador de progresso, chamado a cada lote.
    observer: &'a dyn CleanObserver,
    category: ScanCategory,
    /// Arquivos processados desde a última notificação.
    since_last_report: u32,
}

/// A cada quantos arquivos o progresso é publicado.
///
/// Um evento por arquivo inundaria a ponte IPC numa pasta com dezenas de
/// milhares de itens e deixaria a interface mais lenta que a própria limpeza.
/// Duzentos é frequente o bastante para a barra parecer viva.
const REPORT_EVERY: u32 = 200;

impl WalkVisitor for RemovingVisitor<'_> {
    fn on_file(&mut self, path: &Path, _metadata: &std::fs::Metadata) {
        executor::validate_and_remove(self.guard, path, self.tally);

        self.since_last_report += 1;
        if self.since_last_report >= REPORT_EVERY {
            self.since_last_report = 0;
            self.observer.category_progress(
                self.category,
                self.tally.removed_files,
                self.tally.freed_bytes,
            );
        }
    }

    fn on_directory(&mut self, path: &Path, depth: usize) {
        // A raiz (profundidade zero) não entra: ela nunca é removida.
        if depth > 0 {
            self.directories.push(path.to_path_buf());
        }
    }
}

/// Limpa todas as raízes de uma categoria.
///
/// Cada raiz ganha o próprio [`PathGuard`]. Uma raiz sem guarda — inexistente,
/// link, ou dentro de área proibida — é simplesmente ignorada: não há caminho em
/// que a limpeza aconteça sem um guarda ativo.
#[must_use]
pub fn clean_roots(
    category: ScanCategory,
    roots: &[ScanRoot],
    observer: &dyn CleanObserver,
) -> CategoryCleanResult {
    let started = Instant::now();
    let mut tally = RemovalTally::default();
    let mut guarded_roots = 0_u32;

    observer.category_started(category);

    for root in roots {
        let Some(guard) = PathGuard::for_root(&root.path) else {
            // A raiz não existe, é um link ou está numa área proibida.
            continue;
        };
        guarded_roots += 1;

        let mut visitor = RemovingVisitor {
            guard: &guard,
            tally: &mut tally,
            directories: Vec::new(),
            observer,
            category,
            since_last_report: 0,
        };

        let outcome = scanner::walk_root_with(root, &mut visitor);
        let mut directories = visitor.directories;

        // A caminhada ignora links e pastas ilegíveis antes de chegar ao
        // executor, então esses itens nunca apareceriam no relatório se ficassem
        // só no resultado da varredura. O usuário precisa saber que existiam.
        tally.skipped = tally
            .skipped
            .merged(crate::models::clean_result::CleanSkips {
                links: outcome.skipped.links,
                access_denied: outcome.skipped.access_denied,
                path_too_long: outcome.skipped.path_too_long,
                in_use: outcome.skipped.in_use,
                other_failures: outcome.skipped.read_errors + outcome.skipped.depth_exceeded,
                ..crate::models::clean_result::CleanSkips::default()
            });

        executor::remove_empty_directories(&guard, &mut directories, &mut tally);
    }

    if guarded_roots == 0 {
        return CategoryCleanResult::failed(
            category,
            "Não foi possível acessar esta área com segurança — nada foi removido.",
        );
    }

    let elapsed = scanner::elapsed_ms(started);

    tracing::info!(
        categoria = category.id(),
        arquivos = tally.removed_files,
        pastas = tally.removed_folders,
        bytes = tally.freed_bytes,
        ignorados = tally.skipped.total(),
        duracao_ms = elapsed,
        "categoria limpa"
    );

    CategoryCleanResult {
        removed_files: tally.removed_files,
        removed_folders: tally.removed_folders,
        freed_bytes: tally.freed_bytes,
        skipped: tally.skipped,
        ..CategoryCleanResult::pending(category)
    }
    .finish(elapsed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cleaner::SilentObserver;
    use crate::models::clean_result::CleanStatus;
    use crate::scanner::FileFilter;

    use std::fs;
    use std::io::Write as _;
    use std::sync::Mutex;

    struct TempTree(PathBuf);

    impl TempTree {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "eloboost-engine-{name}-{}",
                elo_core::new_operation_id()
            ));
            fs::create_dir_all(&path).expect("criar árvore");
            Self(fs::canonicalize(&path).expect("canonicalizar"))
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn file(&self, relative: &str, bytes: usize) -> PathBuf {
            let path = self.0.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("criar subpasta");
            }
            let mut file = fs::File::create(&path).expect("criar");
            file.write_all(&vec![b'x'; bytes]).expect("escrever");
            path
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn limpa_uma_arvore_inteira_e_conta_o_que_saiu() {
        let tree = TempTree::new("arvore");
        tree.file("a.tmp", 100);
        tree.file("sub/b.tmp", 200);
        tree.file("sub/mais/c.tmp", 700);

        let resultado = clean_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
            &SilentObserver,
        );

        assert_eq!(resultado.status, CleanStatus::Completed);
        assert_eq!(resultado.removed_files, 3);
        assert_eq!(resultado.freed_bytes, 1_000);
        assert_eq!(
            resultado.removed_folders, 2,
            "sub e sub/mais ficaram vazias"
        );
        assert!(tree.path().exists(), "a raiz da categoria é preservada");
    }

    #[test]
    fn o_filtro_da_raiz_protege_o_que_nao_pertence_a_categoria() {
        let tree = TempTree::new("filtro");
        tree.file("thumbcache_1.db", 300);
        let pessoal = tree.file("contrato-do-usuario.docx", 5_000);

        let raiz = ScanRoot::shallow(tree.path().to_path_buf())
            .filtered(FileFilter::NamePrefix(&["thumbcache_"]));

        let resultado = clean_roots(ScanCategory::Thumbnails, &[raiz], &SilentObserver);

        assert_eq!(resultado.removed_files, 1);
        assert_eq!(resultado.freed_bytes, 300);
        assert!(
            pessoal.exists(),
            "um arquivo fora do filtro jamais é removido"
        );
    }

    #[cfg(unix)]
    #[test]
    fn um_link_dentro_da_area_nao_leva_a_limpeza_para_fora() {
        // O pior cenário possível: um atalho de pasta dentro de %TEMP%
        // apontando para os documentos do usuário.
        let tree = TempTree::new("escape");
        tree.file("descartavel.tmp", 10);

        let pessoal = TempTree::new("documentos");
        let importante = pessoal.file("tese.docx", 50_000);
        std::os::unix::fs::symlink(pessoal.path(), tree.path().join("atalho"))
            .expect("criar link de pasta");

        let resultado = clean_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
            &SilentObserver,
        );

        assert!(
            importante.exists(),
            "o arquivo do outro lado do link continua intacto"
        );
        assert_eq!(resultado.removed_files, 1);
        assert_eq!(resultado.freed_bytes, 10);
        assert!(resultado.skipped.links >= 1);
    }

    #[test]
    fn uma_raiz_inexistente_nao_derruba_a_categoria_quando_ha_outra() {
        let tree = TempTree::new("multi");
        tree.file("a.tmp", 42);

        let resultado = clean_roots(
            ScanCategory::BrowserCache,
            &[
                ScanRoot::recursive(PathBuf::from("/eloboost-navegador-ausente")),
                ScanRoot::recursive(tree.path().to_path_buf()),
            ],
            &SilentObserver,
        );

        assert_eq!(resultado.removed_files, 1);
        assert_eq!(resultado.status, CleanStatus::Completed);
    }

    #[test]
    fn sem_nenhuma_raiz_acessivel_a_categoria_falha_sem_remover_nada() {
        let resultado = clean_roots(
            ScanCategory::WindowsTemp,
            &[ScanRoot::recursive(PathBuf::from("/eloboost-nada-aqui"))],
            &SilentObserver,
        );

        assert_eq!(resultado.status, CleanStatus::Failed);
        assert_eq!(resultado.removed_files, 0);
        assert!(resultado.message.is_some());
    }

    #[test]
    fn uma_area_vazia_conclui_sem_remover_nada() {
        let tree = TempTree::new("vazia");

        let resultado = clean_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
            &SilentObserver,
        );

        assert_eq!(resultado.status, CleanStatus::Completed);
        assert_eq!(resultado.removed_files, 0);
        assert_eq!(resultado.freed_bytes, 0);
    }

    #[test]
    fn o_progresso_e_publicado_durante_a_limpeza() {
        #[derive(Default)]
        struct Coletor {
            inicios: Mutex<Vec<ScanCategory>>,
            avancos: Mutex<u32>,
        }

        impl CleanObserver for Coletor {
            fn category_started(&self, category: ScanCategory) {
                self.inicios.lock().expect("coletor").push(category);
            }
            fn category_progress(&self, _c: ScanCategory, _files: u64, _bytes: u64) {
                *self.avancos.lock().expect("coletor") += 1;
            }
        }

        let tree = TempTree::new("progresso");
        // Mais arquivos que o intervalo de notificação, para haver ao menos um
        // evento de avanço além do início.
        for index in 0..(REPORT_EVERY + 50) {
            tree.file(&format!("f{index}.tmp"), 1);
        }

        let coletor = Coletor::default();
        let _ = clean_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
            &coletor,
        );

        assert_eq!(coletor.inicios.lock().expect("coletor").len(), 1);
        assert!(*coletor.avancos.lock().expect("coletor") >= 1);
    }

    #[test]
    fn arquivos_grandes_em_quantidade_sao_removidos_sem_acumular_memoria() {
        let tree = TempTree::new("volume");
        for index in 0..1_000 {
            tree.file(&format!("lote{}/f{index}.tmp", index % 10), 8);
        }

        let resultado = clean_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
            &SilentObserver,
        );

        assert_eq!(resultado.removed_files, 1_000);
        assert_eq!(resultado.freed_bytes, 8_000);
        assert_eq!(resultado.removed_folders, 10);
    }
}
