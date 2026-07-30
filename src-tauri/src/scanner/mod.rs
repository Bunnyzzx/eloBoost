//! Motor de varredura do eloBoost — **somente leitura**.
//!
//! Este módulo percorre diretórios e soma tamanhos. Ele não abre arquivo para
//! escrita, não remove, não renomeia e não move nada. As únicas chamadas ao
//! sistema de arquivos que existem aqui são [`std::fs::read_dir`] e a leitura de
//! metadados da entrada de diretório.
//!
//! Há um teste em `scanner::tests` que lê o código-fonte deste diretório e falha
//! se qualquer API de escrita aparecer — a garantia "100% read only" não depende
//! de disciplina de revisão.
//!
//! # Decisões de segurança (docs/05 §2)
//!
//! - **Links nunca são seguidos.** Cada entrada é inspecionada com metadados que
//!   não atravessam o link (`DirEntry::metadata`, equivalente a `lstat`), e no
//!   Windows também pelo atributo de *reparse point*, que cobre *junctions* —
//!   estas não são reportadas como symlink pela biblioteca padrão.
//! - **A varredura nunca sai da raiz da categoria.** Só descemos em entradas
//!   lidas do próprio diretório; nenhum caminho vem da interface.
//! - **Nenhum erro interrompe a análise.** Acesso negado, caminho longo demais,
//!   arquivo em uso e falhas de leitura viram contadores de diagnóstico.
//! - **Profundidade limitada**, para que uma estrutura patológica não transforme
//!   a análise numa espera indefinida.

pub mod locations;
pub mod sources;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::models::scan_category::ScanCategory;
use crate::models::scan_result::{CategoryScan, ScanStatus, SkippedItems};

/// Profundidade máxima de pastas aninhadas.
///
/// O Windows aceita caminhos bem mais profundos, mas nenhuma das áreas que o
/// scanner conhece se aproxima disso: 64 níveis é generoso e ainda protege
/// contra uma estrutura circular criada por um link que escapou às verificações.
pub const MAX_DEPTH: usize = 64;

/// Quais arquivos de uma raiz entram na conta.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileFilter {
    /// Todos os arquivos.
    All,
    /// Apenas nomes que começam com um dos prefixos (comparação sem acentuação
    /// de maiúsculas, como o próprio Windows faz).
    NamePrefix(&'static [&'static str]),
    /// Apenas as extensões listadas, sem o ponto.
    Extension(&'static [&'static str]),
}

impl FileFilter {
    /// Decide se um arquivo entra na medição.
    #[must_use]
    pub fn accepts(self, file_name: &str) -> bool {
        match self {
            Self::All => true,
            Self::NamePrefix(prefixes) => {
                let lower = file_name.to_ascii_lowercase();
                prefixes
                    .iter()
                    .any(|prefix| lower.starts_with(&prefix.to_ascii_lowercase()))
            }
            Self::Extension(extensions) => Path::new(file_name)
                .extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| {
                    let lower = ext.to_ascii_lowercase();
                    extensions
                        .iter()
                        .any(|allowed| allowed.eq_ignore_ascii_case(&lower))
                }),
        }
    }
}

/// Uma pasta a analisar, com a política de leitura daquela área.
#[derive(Debug, Clone)]
pub struct ScanRoot {
    /// Pasta raiz. Sempre resolvida no backend, nunca recebida da interface.
    pub path: PathBuf,
    /// Quais arquivos contam.
    pub filter: FileFilter,
    /// Se a varredura entra nas subpastas.
    pub recursive: bool,
}

impl ScanRoot {
    /// Raiz recursiva, contando todos os arquivos — o caso comum.
    #[must_use]
    pub const fn recursive(path: PathBuf) -> Self {
        Self {
            path,
            filter: FileFilter::All,
            recursive: true,
        }
    }

    /// Raiz de um único nível.
    #[must_use]
    pub const fn shallow(path: PathBuf) -> Self {
        Self {
            path,
            filter: FileFilter::All,
            recursive: false,
        }
    }

    /// Restringe quais arquivos entram na conta.
    #[must_use]
    pub const fn filtered(mut self, filter: FileFilter) -> Self {
        self.filter = filter;
        self
    }
}

/// O que a caminhada encontrou.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WalkOutcome {
    /// Arquivos que passaram pelo filtro.
    pub file_count: u64,
    /// Pastas efetivamente percorridas.
    pub folder_count: u64,
    /// Soma dos tamanhos dos arquivos contados.
    pub size_bytes: u64,
    /// O que foi ignorado, por motivo.
    pub skipped: SkippedItems,
    /// Quantas raízes existiam de fato no disco.
    pub roots_visited: u32,
}

impl WalkOutcome {
    /// Junta o resultado de duas raízes da mesma categoria.
    #[must_use]
    fn merged(self, other: Self) -> Self {
        Self {
            file_count: self.file_count.saturating_add(other.file_count),
            folder_count: self.folder_count.saturating_add(other.folder_count),
            size_bytes: self.size_bytes.saturating_add(other.size_bytes),
            skipped: self.skipped.merged(other.skipped),
            roots_visited: self.roots_visited + other.roots_visited,
        }
    }
}

/// Classifica uma falha de E/S num dos motivos de diagnóstico.
///
/// Os códigos numéricos são do Windows: 32 e 33 indicam arquivo bloqueado por
/// outro processo, 206 indica caminho longo demais. Em outras plataformas o
/// `ErrorKind` já basta.
fn record_io_error(error: &std::io::Error, skipped: &mut SkippedItems) {
    use std::io::ErrorKind;

    match error.kind() {
        ErrorKind::PermissionDenied => skipped.access_denied += 1,
        ErrorKind::InvalidFilename => skipped.path_too_long += 1,
        _ => match error.raw_os_error() {
            Some(32 | 33) if cfg!(windows) => skipped.in_use += 1,
            Some(206) if cfg!(windows) => skipped.path_too_long += 1,
            // ENAMETOOLONG
            Some(36) if cfg!(unix) => skipped.path_too_long += 1,
            _ => skipped.read_errors += 1,
        },
    }
}

/// `true` se a entrada é um link que não devemos atravessar.
///
/// No Windows, `is_symlink` não cobre *junctions*: elas são reparse points de
/// outro tipo. Testamos o atributo diretamente, porque uma junction para
/// `C:\Users` dentro de `%TEMP%` faria a análise medir a pasta pessoal inteira.
fn is_link(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt as _;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.is_symlink() || metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }

    #[cfg(not(windows))]
    {
        metadata.is_symlink()
    }
}

/// Percorre uma raiz somando arquivos, pastas e bytes.
///
/// A pilha guarda apenas os diretórios pendentes — nunca a lista de arquivos.
/// O tamanho é somado durante a caminhada, então a memória usada cresce com a
/// profundidade da árvore, não com a quantidade de arquivos. Uma pasta com
/// centenas de milhares de arquivos custa o mesmo que uma com dez.
#[must_use]
pub fn walk_root(root: &ScanRoot) -> WalkOutcome {
    let mut outcome = WalkOutcome::default();

    let Ok(root_metadata) = fs::symlink_metadata(&root.path) else {
        // A pasta não existe nesta máquina. Não é erro: nem toda instalação do
        // Windows tem todas as áreas, e nem todo navegador está instalado.
        return outcome;
    };

    if is_link(&root_metadata) || !root_metadata.is_dir() {
        outcome.skipped.links += u64::from(is_link(&root_metadata));
        return outcome;
    }

    outcome.roots_visited = 1;

    let mut pending: Vec<(PathBuf, usize)> = vec![(root.path.clone(), 0)];

    while let Some((directory, depth)) = pending.pop() {
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(error) => {
                record_io_error(&error, &mut outcome.skipped);
                tracing::trace!(
                    pasta = %elo_core::paths::mask_path(&directory),
                    erro = %error,
                    "pasta ignorada durante a análise"
                );
                continue;
            }
        };

        outcome.folder_count += 1;

        for entry in entries {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    record_io_error(&error, &mut outcome.skipped);
                    continue;
                }
            };

            // `DirEntry::metadata` não atravessa links — é o `lstat` da entrada.
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(error) => {
                    record_io_error(&error, &mut outcome.skipped);
                    continue;
                }
            };

            if is_link(&metadata) {
                outcome.skipped.links += 1;
                continue;
            }

            if metadata.is_dir() {
                if !root.recursive {
                    continue;
                }
                if depth + 1 >= MAX_DEPTH {
                    outcome.skipped.depth_exceeded += 1;
                    continue;
                }
                pending.push((entry.path(), depth + 1));
                continue;
            }

            // Só resta arquivo comum. O nome é usado apenas para o filtro e
            // nunca sai desta função.
            let file_name = entry.file_name();
            if !root.filter.accepts(&file_name.to_string_lossy()) {
                continue;
            }

            outcome.file_count += 1;
            outcome.size_bytes = outcome.size_bytes.saturating_add(metadata.len());
        }
    }

    outcome
}

/// Analisa uma categoria a partir de suas raízes, medindo o tempo.
///
/// É o caminho que todas as fontes de diretório usam. Uma fonte nova precisa
/// apenas informar suas raízes; nada de caminhada, contagem ou classificação de
/// erro é reescrito por categoria.
#[must_use]
pub fn scan_roots(category: ScanCategory, roots: &[ScanRoot]) -> CategoryScan {
    let started = Instant::now();

    let outcome = roots
        .iter()
        .map(walk_root)
        .fold(WalkOutcome::default(), WalkOutcome::merged);

    let elapsed_ms = elapsed_ms(started);

    if outcome.roots_visited == 0 {
        return CategoryScan::not_found(
            category,
            "Esta área não existe neste computador — nada a analisar.",
        )
        .with_duration_ms(elapsed_ms);
    }

    finish(category, outcome, elapsed_ms)
}

/// Monta o resultado final de uma categoria já percorrida.
#[must_use]
pub fn finish(category: ScanCategory, outcome: WalkOutcome, duration_ms: u64) -> CategoryScan {
    let (status, message) = if outcome.skipped.is_empty() {
        (ScanStatus::Completed, None)
    } else {
        (
            ScanStatus::CompletedWithWarnings,
            Some(describe_skipped(&outcome.skipped)),
        )
    };

    CategoryScan {
        category,
        name: category.name(),
        description: category.description(),
        removal_policy: category.removal_policy(),
        file_count: outcome.file_count,
        folder_count: outcome.folder_count,
        size_bytes: outcome.size_bytes,
        duration_ms,
        status,
        message,
        skipped: outcome.skipped,
    }
}

/// Explica em uma frase o que ficou de fora, e por quê.
fn describe_skipped(skipped: &SkippedItems) -> String {
    let mut reasons: Vec<String> = Vec::new();

    let mut push = |count: u64, singular: &str, plural: &str| {
        if count > 0 {
            reasons.push(format!(
                "{count} {}",
                if count == 1 { singular } else { plural }
            ));
        }
    };

    push(
        skipped.access_denied,
        "item sem permissão de leitura",
        "itens sem permissão de leitura",
    );
    push(skipped.in_use, "item em uso", "itens em uso");
    push(
        skipped.links,
        "atalho de pasta não seguido",
        "atalhos de pasta não seguidos",
    );
    push(
        skipped.path_too_long,
        "caminho longo demais",
        "caminhos longos demais",
    );
    push(
        skipped.depth_exceeded,
        "pasta profunda demais",
        "pastas profundas demais",
    );
    push(skipped.read_errors, "item ilegível", "itens ilegíveis");

    format!(
        "Analisada com {}. O tamanho real pode ser um pouco maior.",
        reasons.join(", ")
    )
}

/// Milissegundos decorridos, saturando em vez de estourar.
#[must_use]
pub fn elapsed_ms(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs::File;
    use std::io::Write as _;

    /// Nome, tamanho e data de modificação de cada item de uma árvore.
    ///
    /// Serve para provar que a análise não alterou nada: se um único byte, um
    /// tamanho ou um carimbo de tempo mudar, a comparação falha.
    fn manifesto(raiz: &Path) -> Vec<(PathBuf, u64, Option<std::time::SystemTime>)> {
        let mut itens = Vec::new();
        let mut pendentes = vec![raiz.to_path_buf()];

        while let Some(atual) = pendentes.pop() {
            for entry in fs::read_dir(&atual).expect("ler manifesto") {
                let entry = entry.expect("entrada");
                let metadata = entry.metadata().expect("metadados");
                if metadata.is_dir() {
                    pendentes.push(entry.path());
                }
                itens.push((entry.path(), metadata.len(), metadata.modified().ok()));
            }
        }

        itens.sort_by(|a, b| a.0.cmp(&b.0));
        itens
    }

    /// Cria uma pasta temporária isolada para os testes.
    ///
    /// Os testes do scanner **nunca** tocam pastas reais do sistema: cada um
    /// monta a sua própria árvore e a remove no fim.
    struct TempTree(PathBuf);

    impl TempTree {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "eloboost-scanner-{name}-{}",
                elo_core::new_operation_id()
            ));
            fs::create_dir_all(&path).expect("criar árvore de teste");
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }

        fn write(&self, relative: &str, bytes: usize) -> PathBuf {
            let path = self.0.join(relative);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).expect("criar subpasta");
            }
            let mut file = File::create(&path).expect("criar arquivo");
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
    fn pasta_inexistente_nao_e_erro_e_nao_conta_raiz() {
        let root = ScanRoot::recursive(PathBuf::from("/eloboost-nao-existe-em-lugar-nenhum"));
        let outcome = walk_root(&root);

        assert_eq!(outcome.roots_visited, 0);
        assert_eq!(outcome.file_count, 0);
        assert_eq!(outcome.size_bytes, 0);
        assert!(outcome.skipped.is_empty());
    }

    #[test]
    fn categoria_sem_nenhuma_raiz_no_disco_reporta_not_found() {
        let roots = [ScanRoot::recursive(PathBuf::from(
            "/eloboost-tambem-nao-existe",
        ))];
        let scan = scan_roots(ScanCategory::WindowsTemp, &roots);

        assert_eq!(scan.status, ScanStatus::NotFound);
        assert_eq!(scan.size_bytes, 0);
        assert!(scan.message.is_some());
    }

    #[test]
    fn pasta_vazia_conclui_com_zero_arquivos() {
        let tree = TempTree::new("vazia");
        let scan = scan_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
        );

        assert_eq!(scan.status, ScanStatus::Completed);
        assert_eq!(scan.file_count, 0);
        assert_eq!(scan.folder_count, 1);
        assert_eq!(scan.size_bytes, 0);
    }

    #[test]
    fn soma_tamanho_e_conta_arquivos_e_pastas_recursivamente() {
        let tree = TempTree::new("recursiva");
        tree.write("a.tmp", 100);
        tree.write("sub/b.tmp", 250);
        tree.write("sub/mais/c.tmp", 650);

        let scan = scan_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
        );

        assert_eq!(scan.file_count, 3);
        assert_eq!(scan.size_bytes, 1_000);
        // raiz + sub + sub/mais
        assert_eq!(scan.folder_count, 3);
        assert_eq!(scan.status, ScanStatus::Completed);
    }

    #[test]
    fn raiz_rasa_ignora_subpastas() {
        let tree = TempTree::new("rasa");
        tree.write("topo.tmp", 10);
        tree.write("sub/escondido.tmp", 9_999);

        let outcome = walk_root(&ScanRoot::shallow(tree.path().to_path_buf()));

        assert_eq!(outcome.file_count, 1);
        assert_eq!(outcome.size_bytes, 10);
        assert_eq!(outcome.folder_count, 1);
    }

    #[test]
    fn o_filtro_de_prefixo_seleciona_apenas_os_arquivos_da_categoria() {
        let tree = TempTree::new("prefixo");
        tree.write("thumbcache_256.db", 300);
        tree.write("iconcache_32.db", 200);
        tree.write("documento-do-usuario.docx", 5_000);

        let root = ScanRoot::shallow(tree.path().to_path_buf())
            .filtered(FileFilter::NamePrefix(&["thumbcache_", "iconcache_"]));
        let outcome = walk_root(&root);

        // O ponto: um arquivo pessoal na mesma pasta não é medido nem contado.
        assert_eq!(outcome.file_count, 2);
        assert_eq!(outcome.size_bytes, 500);
    }

    #[test]
    fn o_filtro_de_extensao_ignora_maiusculas() {
        let tree = TempTree::new("extensao");
        tree.write("sistema.LOG", 40);
        tree.write("rastreio.etl", 60);
        tree.write("config.ini", 1_000);

        let root = ScanRoot::recursive(tree.path().to_path_buf())
            .filtered(FileFilter::Extension(&["log", "etl"]));
        let outcome = walk_root(&root);

        assert_eq!(outcome.file_count, 2);
        assert_eq!(outcome.size_bytes, 100);
    }

    #[test]
    fn uma_arvore_grande_e_percorrida_sem_guardar_a_lista_de_arquivos() {
        let tree = TempTree::new("grande");
        for index in 0..2_000 {
            tree.write(&format!("lote{}/arquivo-{index}.tmp", index % 20), 16);
        }

        let scan = scan_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
        );

        assert_eq!(scan.file_count, 2_000);
        assert_eq!(scan.size_bytes, 32_000);
        assert_eq!(scan.folder_count, 21);
        // Se a caminhada acumulasse caminhos, 2.000 arquivos já apareceriam no
        // tempo. O limite é folgado de propósito: o teste roda em CI lenta.
        assert!(scan.duration_ms < 10_000, "levou {} ms", scan.duration_ms);
    }

    #[cfg(unix)]
    #[test]
    fn links_simbolicos_nunca_sao_seguidos() {
        let tree = TempTree::new("links");
        tree.write("real/dentro.tmp", 128);
        let alvo = TempTree::new("links-alvo");
        alvo.write("gigante.bin", 500_000);

        std::os::unix::fs::symlink(alvo.path(), tree.path().join("atalho"))
            .expect("criar link simbólico");

        let scan = scan_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
        );

        // Se o link fosse seguido, o tamanho passaria de 128 bytes.
        assert_eq!(scan.size_bytes, 128);
        assert_eq!(scan.skipped.links, 1);
        assert_eq!(scan.status, ScanStatus::CompletedWithWarnings);
        assert!(scan
            .message
            .as_deref()
            .is_some_and(|m| m.contains("atalho")));
    }

    #[cfg(unix)]
    #[test]
    fn pasta_sem_permissao_e_ignorada_sem_interromper_a_analise() {
        use std::os::unix::fs::PermissionsExt as _;

        let tree = TempTree::new("permissao");
        tree.write("visivel.tmp", 64);
        let bloqueada = tree.path().join("bloqueada");
        fs::create_dir_all(&bloqueada).expect("criar pasta");
        fs::write(bloqueada.join("dentro.tmp"), b"segredo").expect("criar arquivo");
        fs::set_permissions(&bloqueada, fs::Permissions::from_mode(0o000)).expect("remover acesso");

        let scan = scan_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
        );

        // `root` ignora permissões de arquivo, então em algumas máquinas de CI a
        // pasta continua legível e o cenário simplesmente não existe. Medimos a
        // precondição em vez de supô-la; a classificação do erro está coberta,
        // sem depender de privilégio, em
        // `erros_de_leitura_sao_classificados_por_motivo`.
        let bloqueio_efetivo = fs::read_dir(&bloqueada).is_err();

        // Devolve o acesso antes de sair, senão o TempTree não consegue limpar.
        let _ = fs::set_permissions(&bloqueada, fs::Permissions::from_mode(0o755));

        if bloqueio_efetivo {
            // O arquivo visível continua medido: um erro não derruba a categoria.
            assert_eq!(scan.file_count, 1);
            assert_eq!(scan.size_bytes, 64);
            assert_eq!(scan.skipped.access_denied, 1);
            assert_eq!(scan.status, ScanStatus::CompletedWithWarnings);
            assert!(scan
                .message
                .as_deref()
                .is_some_and(|m| m.contains("permissão")));
        } else {
            // Sem bloqueio efetivo, o que se verifica é o essencial: a análise
            // concluiu e mediu o conteúdo, em vez de abortar.
            assert!(scan.file_count >= 1);
            assert!(matches!(
                scan.status,
                ScanStatus::Completed | ScanStatus::CompletedWithWarnings
            ));
        }
    }

    #[test]
    fn varias_raizes_sao_somadas_numa_categoria_so() {
        let primeira = TempTree::new("multi-1");
        let segunda = TempTree::new("multi-2");
        primeira.write("a.tmp", 100);
        segunda.write("b.tmp", 400);

        let scan = scan_roots(
            ScanCategory::BrowserCache,
            &[
                ScanRoot::recursive(primeira.path().to_path_buf()),
                ScanRoot::recursive(segunda.path().to_path_buf()),
                // Uma raiz ausente entre as presentes não invalida a categoria.
                ScanRoot::recursive(PathBuf::from("/eloboost-navegador-nao-instalado")),
            ],
        );

        assert_eq!(scan.file_count, 2);
        assert_eq!(scan.size_bytes, 500);
        assert_eq!(scan.status, ScanStatus::Completed);
    }

    #[test]
    fn erros_de_leitura_sao_classificados_por_motivo() {
        use std::io::{Error, ErrorKind};

        let classificar = |erro: Error| {
            let mut skipped = SkippedItems::default();
            record_io_error(&erro, &mut skipped);
            skipped
        };

        assert_eq!(
            classificar(Error::new(ErrorKind::PermissionDenied, "negado")).access_denied,
            1
        );
        assert_eq!(
            classificar(Error::new(ErrorKind::InvalidFilename, "nome inválido")).path_too_long,
            1
        );
        // Um motivo desconhecido nunca é descartado: vira erro de leitura, para
        // que a soma dos ignorados continue batendo com a realidade.
        assert_eq!(classificar(Error::other("algo inesperado")).read_errors, 1);

        #[cfg(windows)]
        {
            // 32 = ERROR_SHARING_VIOLATION: o arquivo está aberto por outro
            // processo, o caso mais comum numa pasta de temporários viva.
            assert_eq!(classificar(Error::from_raw_os_error(32)).in_use, 1);
            assert_eq!(classificar(Error::from_raw_os_error(206)).path_too_long, 1);
        }

        #[cfg(unix)]
        {
            // ENAMETOOLONG
            assert_eq!(classificar(Error::from_raw_os_error(36)).path_too_long, 1);
        }
    }

    #[test]
    fn a_analise_nao_altera_nada_no_disco() {
        // A verificação central do Épico 2. Em vez de contar arquivos numa pasta
        // compartilhada — que outros testes mexem em paralelo —, montamos uma
        // árvore própria e comparamos um manifesto completo: nome, tamanho e
        // data de modificação de cada item, antes e depois.
        let tree = TempTree::new("somente-leitura");
        tree.write("a.tmp", 10);
        tree.write("sub/b.tmp", 20);
        tree.write("sub/mais/c.tmp", 30);

        let antes = manifesto(tree.path());
        let scan = scan_roots(
            ScanCategory::UserTemp,
            &[ScanRoot::recursive(tree.path().to_path_buf())],
        );
        let depois = manifesto(tree.path());

        assert_eq!(scan.file_count, 3);
        assert_eq!(
            antes, depois,
            "a análise alterou o conteúdo, o tamanho ou a data de algum item"
        );
    }

    #[test]
    fn a_mensagem_de_diagnostico_usa_singular_e_plural_corretos() {
        let um = describe_skipped(&SkippedItems {
            access_denied: 1,
            ..SkippedItems::default()
        });
        assert!(um.contains("1 item sem permissão"), "{um}");

        let varios = describe_skipped(&SkippedItems {
            in_use: 3,
            ..SkippedItems::default()
        });
        assert!(varios.contains("3 itens em uso"), "{varios}");
    }

    #[test]
    fn nenhum_codigo_do_scanner_usa_api_de_escrita() {
        // Esta é a garantia real de "somente leitura": em vez de confiar na
        // revisão, lemos o próprio código-fonte do módulo e falhamos se
        // qualquer API que modifica o disco aparecer fora dos testes.
        const PROIBIDAS: [&str; 9] = [
            "fs::remove_file",
            "fs::remove_dir",
            "fs::rename",
            "fs::copy",
            "fs::write",
            "fs::set_permissions",
            "File::create",
            "OpenOptions",
            "fs::hard_link",
        ];

        let raiz = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/scanner");
        let mut pendentes = vec![raiz];
        let mut analisados = 0_u32;

        while let Some(atual) = pendentes.pop() {
            for entry in fs::read_dir(&atual).expect("ler o código do scanner") {
                let entry = entry.expect("entrada");
                let caminho = entry.path();

                if caminho.is_dir() {
                    pendentes.push(caminho);
                    continue;
                }
                if caminho.extension().and_then(|e| e.to_str()) != Some("rs") {
                    continue;
                }

                let fonte = fs::read_to_string(&caminho).expect("ler fonte");
                // Os testes montam árvores próprias e precisam escrever; o
                // corte remove o bloco `#[cfg(test)]` do fim de cada arquivo.
                let producao = fonte.split("#[cfg(test)]").next().unwrap_or_default();

                for proibida in PROIBIDAS {
                    assert!(
                        !producao.contains(proibida),
                        "{} usa `{proibida}` — o scanner é somente leitura",
                        caminho.display()
                    );
                }
                analisados += 1;
            }
        }

        assert!(analisados >= 8, "esperava mais arquivos no scanner");
    }
}
