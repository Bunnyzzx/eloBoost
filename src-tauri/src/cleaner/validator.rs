//! `PathGuard` — o componente mais crítico do eloBoost.
//!
//! Todo caminho a ser removido passa por aqui. O ponto central do desenho está
//! no sistema de tipos: [`ValidatedPath`] **não pode ser construído fora deste
//! módulo**, e [`crate::cleaner::executor`] só aceita `&ValidatedPath`. Não
//! existe forma de chamar a remoção com uma `String` — o compilador impede
//! (docs/05 §2).
//!
//! Isso importa porque a alternativa é disciplina: lembrar de validar antes de
//! apagar. Disciplina falha em revisão de código; tipo não falha.
//!
//! # O que é verificado, em ordem
//!
//! 1. **Denylist absoluta** — áreas do sistema e pastas pessoais que nunca são
//!    tocadas, em nenhuma circunstância.
//! 2. **Componentes suspeitos** — `..`, caracteres de controle, prefixos de
//!    dispositivo do Windows, caminhos UNC.
//! 3. **Pertencimento à raiz** — o caminho canônico do **diretório pai** precisa
//!    estar sob a raiz canônica da categoria.
//! 4. **Natureza do item** — só arquivo comum. Link, junction, reparse point,
//!    diretório e dispositivo são recusados.
//! 5. **Identidade** — a identidade do arquivo (inode/índice + volume) é
//!    guardada na validação e reconferida imediatamente antes da remoção.
//!
//! # Limite conhecido
//!
//! A verificação 5 reduz muito, mas não elimina por completo, a janela TOCTOU
//! entre validar e remover. Fechá-la de vez exige remoção por **handle** já
//! aberto (`FILE_FLAG_OPEN_REPARSE_POINT` + `SetFileInformationByHandle`), que
//! é o passo de endurecimento previsto para o Windows. O ponto de encaixe é
//! [`ValidatedPath`]: quando o handle entrar, ele entra como campo desta struct
//! e nenhum chamador muda.

use std::path::{Component, Path, PathBuf};

use crate::scanner::locations;

/// Por que um caminho foi recusado.
///
/// Cada variante vira um contador no diagnóstico — nunca uma mensagem com o
/// caminho, que sairia da máquina do usuário no relatório.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Rejection {
    /// Está numa área proibida em absoluto.
    Denylisted,
    /// Contém `..`, caractere de controle, dispositivo ou é UNC.
    SuspiciousPath,
    /// Não está dentro da raiz autorizada da categoria.
    OutsideRoot,
    /// É link, junction ou reparse point.
    IsLink,
    /// Não é um arquivo comum.
    NotARegularFile,
    /// Já não existe.
    Missing,
    /// A leitura dos metadados falhou.
    Unreadable,
}

/// Impressão digital de um arquivo, para detectar troca entre a validação e a
/// remoção.
///
/// A força da verificação depende da plataforma, e vale ser honesto sobre isso:
///
/// - **Unix**: dispositivo + inode. É a identidade real do arquivo — dois
///   arquivos diferentes nunca a compartilham.
/// - **Windows**: data de criação + última escrita + tamanho + atributos.
///   `volume_serial_number` e `file_index`, que seriam a identidade verdadeira,
///   ainda são API instável do Rust (`windows_by_handle`). O conjunto usado é
///   uma impressão digital forte na prática — um arquivo substituído
///   dificilmente conserva os três carimbos — mas não uma identidade formal.
///
/// A verificação definitiva no Windows virá com a remoção por handle, descrita
/// no cabeçalho deste módulo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FileIdentity {
    primary: u64,
    secondary: u64,
    len: u64,
}

impl FileIdentity {
    /// Extrai a impressão digital dos metadados da plataforma.
    fn of(metadata: &std::fs::Metadata) -> Self {
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt as _;
            Self {
                primary: metadata.dev(),
                secondary: metadata.ino(),
                len: metadata.len(),
            }
        }

        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt as _;
            Self {
                primary: metadata.creation_time(),
                // Combina a última escrita com os atributos: um arquivo trocado
                // por um link, por exemplo, muda os atributos mesmo que os
                // carimbos sejam copiados.
                secondary: metadata.last_write_time() ^ u64::from(metadata.file_attributes()),
                len: metadata.len(),
            }
        }

        #[cfg(not(any(unix, windows)))]
        {
            Self {
                primary: 0,
                secondary: 0,
                len: metadata.len(),
            }
        }
    }
}

/// Um caminho aprovado para remoção.
///
/// **Só este módulo consegue construir um.** Os campos são privados e não há
/// construtor público — a única porta de entrada é [`PathGuard::validate`].
#[derive(Debug, Clone)]
pub struct ValidatedPath {
    path: PathBuf,
    identity: FileIdentity,
    size_bytes: u64,
}

impl ValidatedPath {
    /// O caminho aprovado.
    #[must_use]
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Tamanho registrado na validação — o que será contado como liberado.
    #[must_use]
    pub const fn size_bytes(&self) -> u64 {
        self.size_bytes
    }

    /// Confere se o arquivo no disco ainda é o mesmo que foi validado.
    ///
    /// Chamada imediatamente antes da remoção. Se o arquivo foi trocado por
    /// outro — ou por um link — entre a validação e agora, a remoção não
    /// acontece.
    #[must_use]
    pub fn still_matches(&self) -> bool {
        let Ok(metadata) = std::fs::symlink_metadata(&self.path) else {
            return false;
        };
        if metadata.is_symlink() || !metadata.is_file() {
            return false;
        }
        FileIdentity::of(&metadata) == self.identity
    }
}

/// Nomes de pastas pessoais que nunca são tocadas.
///
/// Comparados sem diferenciar maiúsculas, como o Windows faz.
const PERSONAL_FOLDERS: &[&str] = &[
    "documents",
    "documentos",
    "desktop",
    "área de trabalho",
    "pictures",
    "imagens",
    "videos",
    "vídeos",
    "music",
    "músicas",
    "downloads",
    "onedrive",
    "dropbox",
    "google drive",
    "saved games",
    "favorites",
    "favoritos",
    "contacts",
    "links",
];

/// Trechos de caminho que marcam área crítica do sistema.
const SYSTEM_SEGMENTS: &[&str] = &[
    "system32",
    "syswow64",
    "winsxs",
    "system volume information",
    "$recycle.bin",
    "program files",
    "programdata\\microsoft\\windows\\start menu",
    "boot",
    "efi",
    "recovery",
    "prefetch",
];

/// Arquivos do sistema que jamais podem ser removidos.
const PROTECTED_FILES: &[&str] = &["pagefile.sys", "hiberfil.sys", "swapfile.sys", "ntldr"];

/// O guarda de caminhos de uma categoria.
///
/// Criado uma vez por raiz: a canonicalização da raiz é a operação cara, e
/// reaproveitá-la evita repeti-la por arquivo.
#[derive(Debug, Clone)]
pub struct PathGuard {
    /// Raiz canônica autorizada.
    root: PathBuf,
    /// Pastas pessoais do usuário, canônicas, que nunca são tocadas.
    personal_roots: Vec<PathBuf>,
}

impl PathGuard {
    /// Constrói o guarda para uma raiz.
    ///
    /// Devolve `None` quando a raiz não existe, não é diretório, é um link ou
    /// está ela própria numa área proibida — casos em que **nenhum** arquivo
    /// abaixo dela pode ser aprovado.
    #[must_use]
    pub fn for_root(root: &Path) -> Option<Self> {
        let metadata = std::fs::symlink_metadata(root).ok()?;
        if metadata.is_symlink() || !metadata.is_dir() {
            return None;
        }

        // Canonicaliza a raiz uma vez: daqui para a frente a comparação de
        // pertencimento é textual sobre caminhos já resolvidos.
        let canonical = std::fs::canonicalize(root).ok()?;

        if is_denylisted(&canonical) || is_volume_root(&canonical) {
            tracing::error!(
                raiz = %elo_core::paths::mask_path(&canonical),
                "raiz recusada pelo PathGuard — nenhuma limpeza acontecerá nela"
            );
            return None;
        }

        Some(Self {
            root: canonical,
            personal_roots: personal_roots(),
        })
    }

    /// A raiz canônica que este guarda protege.
    #[must_use]
    pub fn root(&self) -> &Path {
        &self.root
    }

    /// Valida um caminho candidato à remoção.
    ///
    /// # Errors
    /// Devolve o motivo da recusa. Nenhuma recusa é fatal para a limpeza: ela
    /// vira um contador e a execução segue para o próximo arquivo.
    pub fn validate(&self, candidate: &Path) -> Result<ValidatedPath, Rejection> {
        if has_suspicious_components(candidate) {
            return Err(Rejection::SuspiciousPath);
        }

        let metadata = match std::fs::symlink_metadata(candidate) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Err(Rejection::Missing)
            }
            Err(_) => return Err(Rejection::Unreadable),
        };

        if metadata.is_symlink() || is_reparse_point(&metadata) {
            return Err(Rejection::IsLink);
        }
        if !metadata.is_file() {
            return Err(Rejection::NotARegularFile);
        }

        // O pai é canonicalizado, não o arquivo: canonicalizar o próprio
        // arquivo resolveria um link, e queremos justamente rejeitá-lo. Com o
        // pai resolvido e o nome preservado, um link no meio do caminho não
        // consegue apontar a remoção para fora da raiz.
        let parent = candidate.parent().ok_or(Rejection::SuspiciousPath)?;
        let canonical_parent = std::fs::canonicalize(parent).map_err(|_| Rejection::Unreadable)?;

        if !canonical_parent.starts_with(&self.root) {
            return Err(Rejection::OutsideRoot);
        }

        let file_name = candidate.file_name().ok_or(Rejection::SuspiciousPath)?;
        let resolved = canonical_parent.join(file_name);

        if is_denylisted(&resolved) || self.is_personal(&resolved) {
            return Err(Rejection::Denylisted);
        }

        Ok(ValidatedPath {
            identity: FileIdentity::of(&metadata),
            size_bytes: metadata.len(),
            path: resolved,
        })
    }

    /// Valida um diretório candidato à remoção **por estar vazio**.
    ///
    /// Mais restrito que a validação de arquivo: a própria raiz nunca é
    /// aprovada, porque remover a pasta `%TEMP%` inteira quebraria programas
    /// que esperam que ela exista.
    ///
    /// # Errors
    /// Devolve o motivo da recusa.
    pub fn validate_directory(&self, candidate: &Path) -> Result<PathBuf, Rejection> {
        if has_suspicious_components(candidate) {
            return Err(Rejection::SuspiciousPath);
        }

        let metadata = std::fs::symlink_metadata(candidate).map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                Rejection::Missing
            } else {
                Rejection::Unreadable
            }
        })?;

        if metadata.is_symlink() || is_reparse_point(&metadata) {
            return Err(Rejection::IsLink);
        }
        if !metadata.is_dir() {
            return Err(Rejection::NotARegularFile);
        }

        let canonical = std::fs::canonicalize(candidate).map_err(|_| Rejection::Unreadable)?;

        // Estritamente **abaixo** da raiz: `starts_with` sozinho aprovaria a
        // própria raiz.
        if canonical == self.root || !canonical.starts_with(&self.root) {
            return Err(Rejection::OutsideRoot);
        }
        if is_denylisted(&canonical) || self.is_personal(&canonical) {
            return Err(Rejection::Denylisted);
        }

        Ok(canonical)
    }

    /// `true` quando o caminho está dentro de uma pasta pessoal do usuário.
    fn is_personal(&self, path: &Path) -> bool {
        self.personal_roots
            .iter()
            .any(|root| path.starts_with(root))
    }
}

/// Pastas pessoais canônicas desta máquina.
fn personal_roots() -> Vec<PathBuf> {
    let Some(profile) = locations::user_profile() else {
        return Vec::new();
    };

    PERSONAL_FOLDERS
        .iter()
        .filter_map(|name| std::fs::canonicalize(profile.join(name)).ok())
        .collect()
}

/// `true` se o caminho toca uma área do sistema ou um arquivo protegido.
fn is_denylisted(path: &Path) -> bool {
    let lower = path
        .to_string_lossy()
        .to_ascii_lowercase()
        .replace('/', "\\");

    if SYSTEM_SEGMENTS.iter().any(|segment| {
        lower.contains(&format!("\\{segment}\\")) || lower.ends_with(&format!("\\{segment}"))
    }) {
        return true;
    }

    // A comparação é sobre o texto normalizado, não sobre `file_name()`: fora do
    // Windows a barra invertida não é separador, e `C:\\pagefile.sys` viria
    // inteiro como "nome do arquivo" — deixando o teste passar e a proteção não.
    PROTECTED_FILES
        .iter()
        .any(|protected| lower == *protected || lower.ends_with(&format!("\\{protected}")))
}

/// `true` quando o caminho é a raiz de um volume (`C:\`, `/`).
fn is_volume_root(path: &Path) -> bool {
    path.parent().is_none()
        || path
            .components()
            .filter(|component| matches!(component, Component::Normal(_)))
            .count()
            == 0
}

/// `true` para componentes que nunca aparecem num caminho legítimo do scanner.
fn has_suspicious_components(path: &Path) -> bool {
    let text = path.to_string_lossy();

    if text.contains('\0') || text.chars().any(char::is_control) {
        return true;
    }

    // UNC e prefixos de dispositivo do Windows.
    if text.starts_with("\\\\") && !text.starts_with("\\\\?\\") {
        return true;
    }
    if text.starts_with("\\\\.\\") {
        return true;
    }

    // A verificação de `..` é feita **duas vezes**, de propósito.
    //
    // `Components` entende a semântica do caminho, mas num caminho *verbatim*
    // do Windows (`\\?\C:\...`) o Rust desliga a normalização: ali `..` chega
    // como `Component::Normal("..")` e passaria batido. Como toda raiz do
    // PathGuard é canonicalizada — e no Windows `canonicalize` devolve
    // exatamente um caminho verbatim —, esse é o caso comum, não o exótico.
    //
    // A varredura textual dos segmentos não depende de plataforma nem de
    // prefixo, e é ela que fecha o buraco.
    if path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return true;
    }

    text.split(['\\', '/']).any(|segment| segment == "..")
}

/// `true` quando os metadados indicam um reparse point do Windows.
///
/// `is_symlink` não cobre *junctions*: são reparse points de outro tipo, e uma
/// junction dentro de `%TEMP%` apontando para `C:\Users` transformaria a limpeza
/// numa remoção de arquivos pessoais.
fn is_reparse_point(metadata: &std::fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt as _;
        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x0400;
        metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
    }

    #[cfg(not(windows))]
    {
        let _ = metadata;
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::fs;
    use std::io::Write as _;

    /// Árvore isolada — nenhum teste do validador toca área real do sistema.
    struct TempTree(PathBuf);

    impl TempTree {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(format!(
                "eloboost-guard-{name}-{}",
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
            let mut file = fs::File::create(&path).expect("criar arquivo");
            file.write_all(&vec![b'x'; bytes]).expect("escrever");
            path
        }

        fn dir(&self, relative: &str) -> PathBuf {
            let path = self.0.join(relative);
            fs::create_dir_all(&path).expect("criar pasta");
            path
        }
    }

    impl Drop for TempTree {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn guard(tree: &TempTree) -> PathGuard {
        PathGuard::for_root(tree.path()).expect("guarda para a raiz de teste")
    }

    #[test]
    fn aprova_um_arquivo_comum_dentro_da_raiz() {
        let tree = TempTree::new("aprova");
        let alvo = tree.file("sub/a.tmp", 128);

        let validado = guard(&tree).validate(&alvo).expect("deveria aprovar");

        assert_eq!(validado.size_bytes(), 128);
        assert!(validado.path().starts_with(tree.path()));
        assert!(validado.still_matches());
    }

    #[test]
    fn recusa_um_caminho_fora_da_raiz() {
        let tree = TempTree::new("dentro");
        let outra = TempTree::new("fora");
        let alvo = outra.file("segredo.txt", 10);

        assert_eq!(
            guard(&tree).validate(&alvo).unwrap_err(),
            Rejection::OutsideRoot,
            "um arquivo de outra árvore jamais pode ser aprovado"
        );
    }

    #[test]
    fn recusa_travessia_com_ponto_ponto() {
        let tree = TempTree::new("travessia");
        tree.file("a.tmp", 1);

        let travessia = tree.path().join("sub").join("..").join("..").join("a.tmp");
        assert_eq!(
            guard(&tree).validate(&travessia).unwrap_err(),
            Rejection::SuspiciousPath
        );
    }

    #[test]
    fn recusa_um_diretorio_quando_espera_arquivo() {
        let tree = TempTree::new("diretorio");
        let pasta = tree.dir("sub");

        assert_eq!(
            guard(&tree).validate(&pasta).unwrap_err(),
            Rejection::NotARegularFile
        );
    }

    #[test]
    fn recusa_um_arquivo_que_nao_existe() {
        let tree = TempTree::new("ausente");
        assert_eq!(
            guard(&tree)
                .validate(&tree.path().join("fantasma.tmp"))
                .unwrap_err(),
            Rejection::Missing
        );
    }

    #[cfg(unix)]
    #[test]
    fn recusa_link_simbolico_mesmo_apontando_para_dentro_da_raiz() {
        let tree = TempTree::new("link");
        let real = tree.file("real.tmp", 64);
        let link = tree.path().join("atalho.tmp");
        std::os::unix::fs::symlink(&real, &link).expect("criar link");

        // Mesmo apontando para um arquivo legítimo, o link é recusado: remover
        // o link seria remover algo que o usuário não viu na prévia.
        assert_eq!(guard(&tree).validate(&link).unwrap_err(), Rejection::IsLink);
    }

    #[cfg(unix)]
    #[test]
    fn um_link_de_pasta_nao_da_acesso_ao_alvo() {
        // O cenário que mais assusta: uma junction dentro de %TEMP% apontando
        // para a pasta pessoal. Aqui simulada com um link de diretório.
        let tree = TempTree::new("link-pasta");
        let fora = TempTree::new("pessoal");
        let vitima = fora.file("documento.docx", 999);

        let atalho = tree.path().join("pessoal");
        std::os::unix::fs::symlink(fora.path(), &atalho).expect("criar link de pasta");

        let pelo_atalho = atalho.join("documento.docx");
        let resultado = guard(&tree).validate(&pelo_atalho).unwrap_err();

        assert_eq!(
            resultado,
            Rejection::OutsideRoot,
            "canonicalizar o pai é o que impede o link de escapar da raiz"
        );
        assert!(vitima.exists(), "o arquivo pessoal continua intacto");
    }

    #[test]
    fn a_raiz_da_categoria_nunca_e_aprovada_como_pasta_removivel() {
        let tree = TempTree::new("raiz");
        assert_eq!(
            guard(&tree).validate_directory(tree.path()).unwrap_err(),
            Rejection::OutsideRoot,
            "remover a própria %TEMP% quebraria programas que dependem dela"
        );
    }

    #[test]
    fn uma_subpasta_e_aprovada_para_remocao_quando_vazia() {
        let tree = TempTree::new("subpasta");
        let sub = tree.dir("vazia");

        assert!(guard(&tree).validate_directory(&sub).is_ok());
    }

    #[test]
    fn a_identidade_detecta_troca_de_arquivo() {
        let tree = TempTree::new("identidade");
        let alvo = tree.file("a.tmp", 100);
        let validado = guard(&tree).validate(&alvo).expect("aprovar");

        assert!(validado.still_matches());

        // Alguém substitui o arquivo entre a validação e a remoção.
        fs::remove_file(&alvo).expect("remover");
        let mut novo = fs::File::create(&alvo).expect("recriar");
        novo.write_all(b"outro conteudo bem diferente")
            .expect("escrever");

        assert!(
            !validado.still_matches(),
            "a remoção precisa ser abortada quando o arquivo mudou"
        );
    }

    #[test]
    fn a_denylist_reconhece_areas_criticas_do_sistema() {
        assert!(is_denylisted(Path::new(
            r"C:\Windows\System32\kernel32.dll"
        )));
        assert!(is_denylisted(Path::new(r"C:\Windows\SysWOW64\algo.dll")));
        assert!(is_denylisted(Path::new(r"C:\Program Files\App\a.exe")));
        assert!(is_denylisted(Path::new(r"C:\$Recycle.Bin\x")));
        assert!(is_denylisted(Path::new(r"D:\System Volume Information\y")));
        assert!(is_denylisted(Path::new(r"C:\pagefile.sys")));
        assert!(is_denylisted(Path::new(r"C:\Windows\Prefetch\a.pf")));

        // Um temporário comum não é bloqueado.
        assert!(!is_denylisted(Path::new(
            r"C:\Users\ana\AppData\Local\Temp\a.tmp"
        )));
    }

    #[test]
    fn a_denylist_nao_se_engana_com_nome_parecido() {
        // "System32Backup" não é System32.
        assert!(!is_denylisted(Path::new(r"C:\Temp\System32Backup\a.tmp")));
        assert!(!is_denylisted(Path::new(r"C:\Temp\meu-pagefile.sys.bak")));
    }

    #[test]
    fn a_travessia_e_detectada_mesmo_em_caminho_verbatim_do_windows() {
        // Regressão: num caminho `\\?\C:\...` o Rust não interpreta `..` como
        // `ParentDir`, e a verificação por componentes sozinha deixava passar.
        // Como toda raiz canonicalizada no Windows é verbatim, esse era o caso
        // comum — não uma curiosidade.
        assert!(has_suspicious_components(Path::new(
            r"\\?\C:\Users\ana\AppData\Local\Temp\sub\..\..\alvo.tmp"
        )));
        assert!(has_suspicious_components(Path::new("/tmp/sub/../alvo.tmp")));

        // Um nome que apenas *contém* pontos não é travessia.
        assert!(!has_suspicious_components(Path::new(
            r"C:\Temp\arquivo..backup.tmp"
        )));
        assert!(!has_suspicious_components(Path::new(r"\\?\C:\Temp\a.tmp")));
    }

    #[test]
    fn caminhos_de_rede_e_dispositivo_sao_recusados() {
        assert!(has_suspicious_components(Path::new(r"\\servidor\share\a")));
        assert!(has_suspicious_components(Path::new(r"\\.\PhysicalDrive0")));
        assert!(has_suspicious_components(Path::new("a\u{1}b")));
        assert!(!has_suspicious_components(Path::new(r"C:\Temp\a.tmp")));
    }

    #[test]
    fn a_raiz_de_um_volume_nunca_vira_guarda() {
        assert!(is_volume_root(Path::new("/")));
        assert!(!is_volume_root(Path::new("/tmp")));
    }

    #[test]
    fn um_arquivo_valido_nao_pode_ser_construido_fora_deste_modulo() {
        // Este teste é documentação executável: se alguém tornar os campos
        // públicos ou acrescentar um construtor, o compilador aqui continua
        // feliz — mas a revisão vê o comentário. A garantia real é a
        // privacidade dos campos, verificada pelo próprio `cargo check` de
        // qualquer módulo que tentasse construir a struct.
        let tree = TempTree::new("construcao");
        let alvo = tree.file("a.tmp", 8);
        let validado = guard(&tree).validate(&alvo).expect("aprovar");

        assert_eq!(validado.size_bytes(), 8);
    }
}
