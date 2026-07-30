//! Verificação de instalação limpa.
//!
//! Simula o primeiro início do eloBoost numa máquina onde nada existe: pasta de
//! dados ausente, banco inexistente, nenhuma migration aplicada. É o cenário
//! que mais importa acertar — se o banco não subir, não há histórico, backup
//! nem reversão, e nenhuma funcionalidade do produto pode ser confiável.
//!
//! Todos os testes usam diretório temporário isolado. Nenhum caminho real do
//! Windows é tocado.

use elo_core::db::{migrations, Database};

/// Cria um diretório temporário e devolve o caminho do banco dentro dele,
/// **sem** criar a pasta intermediária — é isso que uma instalação limpa
/// encontra.
fn caminho_em_instalacao_limpa() -> (tempfile::TempDir, std::path::PathBuf) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("eloBoost").join("eloboost.db");
    assert!(
        !path.exists(),
        "o cenário exige que o banco ainda não exista"
    );
    (dir, path)
}

#[test]
fn primeiro_inicio_cria_pasta_banco_e_aplica_todas_as_migrations() {
    let (_dir, path) = caminho_em_instalacao_limpa();

    let database = Database::open(&path).expect("primeiro início deve funcionar");
    let status = database.status().expect("status");

    assert!(path.exists(), "o arquivo do banco deve ter sido criado");
    assert!(
        path.parent().expect("pai").exists(),
        "a pasta de dados deve ter sido criada"
    );
    assert_eq!(status.schema_version, migrations::expected_version());
    assert!(
        status.healthy,
        "o banco deve estar íntegro após o primeiro início"
    );
    assert_eq!(
        status.applied_migrations.len(),
        migrations::MIGRATIONS.len()
    );
    assert!(
        status.size_bytes > 0,
        "o arquivo do banco não pode estar vazio"
    );
}

#[test]
fn schema_completo_esta_disponivel_imediatamente_apos_a_instalacao() {
    let (_dir, path) = caminho_em_instalacao_limpa();
    let database = Database::open(&path).expect("abrir banco");
    let connection = database.connection().expect("conexão");

    // Toda tabela do modelo de dados precisa existir já no primeiro início,
    // senão uma funcionalidade futura falharia só em produção.
    let tabelas = [
        "settings",
        "cleanup_scans",
        "cleanup_items",
        "optimization_definitions",
        "optimization_history",
        "backups",
        "activity_logs",
        "startup_snapshots",
        "exclusions",
        "health_snapshots",
        "gaming_sessions",
        "pending_operations",
        "schema_migrations",
    ];

    for tabela in tabelas {
        let existe: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [tabela],
                |row| row.get(0),
            )
            .expect("consulta");
        assert_eq!(existe, 1, "tabela ausente após instalação limpa: {tabela}");
    }
}

#[test]
fn banco_novo_aceita_escrita_e_leitura() {
    let (_dir, path) = caminho_em_instalacao_limpa();
    let database = Database::open(&path).expect("abrir banco");
    let connection = database.connection().expect("conexão");

    connection
        .execute(
            "INSERT INTO settings (key, value, value_type, updated_at)
             VALUES ('tema', '\"dark\"', 'json', ?1)",
            [elo_core::now_iso8601()],
        )
        .expect("insert deve funcionar em banco recém-criado");

    let valor: String = connection
        .query_row("SELECT value FROM settings WHERE key = 'tema'", [], |row| {
            row.get(0)
        })
        .expect("select");

    assert_eq!(valor, "\"dark\"");
}

#[test]
fn segundo_inicio_preserva_os_dados_e_nao_reaplica_migrations() {
    let (_dir, path) = caminho_em_instalacao_limpa();

    {
        let database = Database::open(&path).expect("primeiro início");
        let connection = database.connection().expect("conexão");
        connection
            .execute(
                "INSERT INTO settings (key, value, value_type, updated_at)
                 VALUES ('escala', '1.25', 'float', ?1)",
                [elo_core::now_iso8601()],
            )
            .expect("insert");
    }

    let database = Database::open(&path).expect("segundo início");
    let status = database.status().expect("status");
    let connection = database.connection().expect("conexão");

    // `settings.value` é TEXT com o tipo real indicado em `value_type` — é
    // assim que o repositório de configurações lerá o valor.
    let (bruto, tipo): (String, String) = connection
        .query_row(
            "SELECT value, value_type FROM settings WHERE key = 'escala'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("o dado gravado antes deve continuar lá");

    assert_eq!(tipo, "float");
    let escala: f64 = bruto.parse().expect("valor numérico");
    assert!((escala - 1.25).abs() < f64::EPSILON);
    assert_eq!(
        status.applied_migrations.len(),
        migrations::MIGRATIONS.len()
    );
    assert!(status.healthy);
}

#[test]
fn diagnostico_nao_expoe_o_nome_do_usuario() {
    let (_dir, path) = caminho_em_instalacao_limpa();
    let database = Database::open(&path).expect("abrir banco");
    let status = database.status().expect("status");

    // O caminho exibido na tela Sobre passa por mascaramento; a verificação de
    // substituição em si vive nos testes de `paths`.
    assert!(!status.database_path_masked.is_empty());
    if let Ok(usuario) = std::env::var("USERNAME") {
        if !usuario.is_empty() {
            assert!(
                !status.database_path_masked.contains(&usuario),
                "o caminho exibido não pode conter o nome da conta"
            );
        }
    }
}

#[test]
fn modo_wal_esta_ativo_em_banco_em_arquivo() {
    let (_dir, path) = caminho_em_instalacao_limpa();
    let database = Database::open(&path).expect("abrir banco");
    let connection = database.connection().expect("conexão");

    let modo: String = connection
        .query_row("PRAGMA journal_mode", [], |row| row.get(0))
        .expect("pragma");

    assert_eq!(modo.to_lowercase(), "wal");
}
