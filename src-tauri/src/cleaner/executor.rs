//! O **único** módulo do eloBoost que remove algo do disco.
//!
//! Três regras de desenho, todas verificáveis:
//!
//! 1. **A remoção só aceita [`ValidatedPath`]**, que só o validador constrói.
//!    Não existe assinatura neste módulo que receba `&str` ou `&Path` para
//!    apagar.
//! 2. **Nunca `remove_dir_all`.** Arquivos saem um a um; pastas só saem se já
//!    estiverem vazias, via `remove_dir`, que falha por construção se ainda
//!    houver conteúdo. Um defeito aqui perde um arquivo, nunca uma árvore.
//! 3. **Nenhum erro interrompe a limpeza.** Cada falha vira um contador e a
//!    execução segue para o próximo item.

use std::path::Path;

use crate::cleaner::validator::{PathGuard, Rejection, ValidatedPath};
use crate::models::clean_result::CleanSkips;

/// O que aconteceu com um item.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Removal {
    /// Saiu do disco; carrega quantos bytes foram liberados.
    Removed(u64),
    /// Ficou para trás; o motivo já foi contabilizado.
    Skipped,
}

/// Acumula o que a limpeza de uma categoria fez.
#[derive(Debug, Clone, Copy, Default)]
pub struct RemovalTally {
    /// Arquivos removidos.
    pub removed_files: u64,
    /// Pastas vazias removidas.
    pub removed_folders: u64,
    /// Bytes liberados.
    pub freed_bytes: u64,
    /// O que ficou para trás, por motivo.
    pub skipped: CleanSkips,
}

impl RemovalTally {
    /// Registra o motivo de uma recusa do validador.
    fn record_rejection(&mut self, rejection: Rejection) {
        match rejection {
            Rejection::Missing => self.skipped.already_gone += 1,
            Rejection::IsLink => self.skipped.links += 1,
            Rejection::Denylisted | Rejection::OutsideRoot | Rejection::SuspiciousPath => {
                // Chegar aqui significa que a caminhada produziu um caminho que
                // o guarda recusou. Não deveria acontecer — é sinal de defeito
                // ou de alteração do disco durante a limpeza — e por isso vai
                // para o log com nível de aviso.
                self.skipped.rejected_by_guard += 1;
                tracing::warn!(motivo = ?rejection, "caminho recusado pelo PathGuard durante a limpeza");
            }
            Rejection::NotARegularFile | Rejection::Unreadable => self.skipped.other_failures += 1,
        }
    }

    /// Classifica uma falha de E/S na remoção.
    fn record_io_error(&mut self, error: &std::io::Error) {
        use std::io::ErrorKind;

        match error.kind() {
            ErrorKind::NotFound => self.skipped.already_gone += 1,
            ErrorKind::PermissionDenied => self.skipped.access_denied += 1,
            ErrorKind::InvalidFilename => self.skipped.path_too_long += 1,
            _ => match error.raw_os_error() {
                // 32/33: arquivo aberto por outro processo — o caso mais comum
                // numa pasta de temporários viva.
                Some(32 | 33) if cfg!(windows) => self.skipped.in_use += 1,
                Some(206) if cfg!(windows) => self.skipped.path_too_long += 1,
                Some(36) if cfg!(unix) => self.skipped.path_too_long += 1,
                // EBUSY / ETXTBSY
                Some(16 | 26) if cfg!(unix) => self.skipped.in_use += 1,
                _ => self.skipped.other_failures += 1,
            },
        }
    }
}

/// Remove um arquivo já validado.
///
/// A identidade é reconferida imediatamente antes: se o arquivo foi trocado
/// entre a validação e agora, a remoção é abortada. É a defesa possível contra
/// TOCTOU sem remoção por handle (ver [`crate::cleaner::validator`]).
pub fn remove_validated_file(validated: &ValidatedPath, tally: &mut RemovalTally) -> Removal {
    if !validated.still_matches() {
        tally.skipped.rejected_by_guard += 1;
        tracing::warn!(
            arquivo = %elo_core::paths::mask_path(validated.path()),
            "arquivo mudou entre a validação e a remoção — nada foi removido"
        );
        return Removal::Skipped;
    }

    match std::fs::remove_file(validated.path()) {
        Ok(()) => {
            let freed = validated.size_bytes();
            tally.removed_files += 1;
            tally.freed_bytes = tally.freed_bytes.saturating_add(freed);
            Removal::Removed(freed)
        }
        Err(error) => {
            tally.record_io_error(&error);
            tracing::trace!(
                arquivo = %elo_core::paths::mask_path(validated.path()),
                erro = %error,
                "arquivo mantido durante a limpeza"
            );
            Removal::Skipped
        }
    }
}

/// Valida e remove um arquivo num passo só.
///
/// É o caminho que a Engine usa durante a caminhada: validar e remover em
/// sequência mantém a janela entre as duas operações no mínimo possível.
pub fn validate_and_remove(
    guard: &PathGuard,
    candidate: &Path,
    tally: &mut RemovalTally,
) -> Removal {
    match guard.validate(candidate) {
        Ok(validated) => remove_validated_file(&validated, tally),
        Err(rejection) => {
            tally.record_rejection(rejection);
            Removal::Skipped
        }
    }
}

/// Remove pastas que ficaram vazias, das mais profundas para as mais rasas.
///
/// `remove_dir` **falha** se a pasta ainda tiver conteúdo — é essa falha que
/// torna a operação segura: não existe caminho em que esta função apague algo
/// que sobrou. A raiz da categoria nunca entra, porque o validador a recusa.
///
/// A ordenação por profundidade decrescente é o que permite remover uma cadeia
/// inteira de pastas vazias numa única passagem.
pub fn remove_empty_directories(
    guard: &PathGuard,
    directories: &mut [std::path::PathBuf],
    tally: &mut RemovalTally,
) {
    directories.sort_by_key(|path| std::cmp::Reverse(path.components().count()));

    for directory in directories.iter() {
        let Ok(validated) = guard.validate_directory(directory) else {
            continue;
        };

        // Só tenta se estiver de fato vazia. Sem esta checagem o log encheria
        // de erros esperados para toda pasta que ainda tem conteúdo.
        let is_empty =
            std::fs::read_dir(&validated).is_ok_and(|mut entries| entries.next().is_none());
        if !is_empty {
            continue;
        }

        if std::fs::remove_dir(&validated).is_ok() {
            tally.removed_folders += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs;
    use std::io::Write as _;
    use std::path::PathBuf;

    struct TempTree(PathBuf);

    impl TempTree {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "eloboost-exec-{name}-{}",
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

    fn guard(tree: &TempTree) -> PathGuard {
        PathGuard::for_root(tree.path()).expect("guarda")
    }

    #[test]
    fn remove_um_arquivo_e_conta_o_espaco_liberado() {
        let tree = TempTree::new("remove");
        let alvo = tree.file("a.tmp", 512);
        let mut tally = RemovalTally::default();

        let resultado = validate_and_remove(&guard(&tree), &alvo, &mut tally);

        assert_eq!(resultado, Removal::Removed(512));
        assert!(!alvo.exists());
        assert_eq!(tally.removed_files, 1);
        assert_eq!(tally.freed_bytes, 512);
        assert!(tally.skipped.is_empty());
    }

    #[test]
    fn nao_remove_nada_fora_da_raiz() {
        let tree = TempTree::new("dentro");
        let fora = TempTree::new("fora");
        let vitima = fora.file("importante.txt", 100);
        let mut tally = RemovalTally::default();

        let resultado = validate_and_remove(&guard(&tree), &vitima, &mut tally);

        assert_eq!(resultado, Removal::Skipped);
        assert!(vitima.exists(), "o arquivo de fora continua no disco");
        assert_eq!(tally.removed_files, 0);
        assert_eq!(tally.skipped.rejected_by_guard, 1);
    }

    #[cfg(unix)]
    #[test]
    fn nao_remove_link_nem_o_alvo_dele() {
        let tree = TempTree::new("link");
        let fora = TempTree::new("alvo");
        let alvo = fora.file("original.txt", 50);
        let link = tree.path().join("atalho.txt");
        std::os::unix::fs::symlink(&alvo, &link).expect("criar link");

        let mut tally = RemovalTally::default();
        let resultado = validate_and_remove(&guard(&tree), &link, &mut tally);

        assert_eq!(resultado, Removal::Skipped);
        assert!(alvo.exists(), "o alvo do link continua intacto");
        assert!(link.exists(), "o próprio link também é preservado");
        assert_eq!(tally.skipped.links, 1);
    }

    #[test]
    fn um_arquivo_ausente_e_contado_sem_falhar_a_limpeza() {
        let tree = TempTree::new("ausente");
        let mut tally = RemovalTally::default();

        let resultado =
            validate_and_remove(&guard(&tree), &tree.path().join("nada.tmp"), &mut tally);

        assert_eq!(resultado, Removal::Skipped);
        assert_eq!(tally.skipped.already_gone, 1);
        assert_eq!(tally.removed_files, 0);
    }

    #[test]
    fn remove_a_cadeia_de_pastas_vazias_de_baixo_para_cima() {
        let tree = TempTree::new("cadeia");
        let profundo = tree.file("a/b/c/x.tmp", 10);
        let mut tally = RemovalTally::default();

        validate_and_remove(&guard(&tree), &profundo, &mut tally);

        let mut pastas = vec![
            tree.path().join("a"),
            tree.path().join("a/b"),
            tree.path().join("a/b/c"),
        ];
        remove_empty_directories(&guard(&tree), &mut pastas, &mut tally);

        assert_eq!(tally.removed_folders, 3);
        assert!(!tree.path().join("a").exists());
        assert!(tree.path().exists(), "a raiz continua existindo");
    }

    #[test]
    fn nunca_remove_uma_pasta_que_ainda_tem_conteudo() {
        let tree = TempTree::new("ocupada");
        let sobrevivente = tree.file("sub/fica.txt", 20);
        let mut tally = RemovalTally::default();

        let mut pastas = vec![tree.path().join("sub")];
        remove_empty_directories(&guard(&tree), &mut pastas, &mut tally);

        assert_eq!(tally.removed_folders, 0);
        assert!(sobrevivente.exists());
    }

    #[test]
    fn a_raiz_da_categoria_nunca_e_removida() {
        let tree = TempTree::new("raiz");
        let mut tally = RemovalTally::default();

        let mut pastas = vec![tree.path().to_path_buf()];
        remove_empty_directories(&guard(&tree), &mut pastas, &mut tally);

        assert_eq!(tally.removed_folders, 0);
        assert!(tree.path().exists());
    }

    #[test]
    fn a_troca_do_arquivo_entre_validar_e_remover_aborta_a_remocao() {
        let tree = TempTree::new("toctou");
        let alvo = tree.file("a.tmp", 100);
        let validado = guard(&tree).validate(&alvo).expect("aprovar");

        // Alguém substitui o arquivo depois da validação.
        fs::remove_file(&alvo).expect("remover");
        let mut novo = fs::File::create(&alvo).expect("recriar");
        novo.write_all(b"conteudo substituido pelo atacante")
            .expect("escrever");

        let mut tally = RemovalTally::default();
        let resultado = remove_validated_file(&validado, &mut tally);

        assert_eq!(resultado, Removal::Skipped);
        assert!(alvo.exists(), "o arquivo novo não foi removido");
        assert_eq!(tally.skipped.rejected_by_guard, 1);
    }

    #[test]
    fn erros_de_io_sao_classificados_por_motivo() {
        use std::io::{Error, ErrorKind};

        let classificar = |erro: Error| {
            let mut tally = RemovalTally::default();
            tally.record_io_error(&erro);
            tally.skipped
        };

        assert_eq!(
            classificar(Error::new(ErrorKind::PermissionDenied, "x")).access_denied,
            1
        );
        assert_eq!(
            classificar(Error::new(ErrorKind::NotFound, "x")).already_gone,
            1
        );
        assert_eq!(classificar(Error::other("desconhecido")).other_failures, 1);

        #[cfg(windows)]
        assert_eq!(classificar(Error::from_raw_os_error(32)).in_use, 1);

        #[cfg(unix)]
        assert_eq!(classificar(Error::from_raw_os_error(16)).in_use, 1);
    }

    #[test]
    fn o_modulo_nunca_usa_remocao_recursiva() {
        // A trava mais importante deste arquivo: `remove_dir_all` apaga uma
        // árvore inteira e um único caminho errado seria catastrófico. Os
        // testes acima usam a versão recursiva na limpeza da própria árvore,
        // então a verificação corta o bloco de testes.
        let fonte = include_str!("executor.rs");
        let producao = fonte.split("#[cfg(test)]").next().unwrap_or_default();

        // Procura a **chamada**, não a menção: a documentação no topo do
        // arquivo cita `remove_dir_all` justamente para explicar por que ela
        // não existe aqui.
        assert!(
            !producao.contains("remove_dir_all("),
            "o executor não pode remover árvores inteiras"
        );
    }
}
