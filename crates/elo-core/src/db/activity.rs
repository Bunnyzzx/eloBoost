//! Repositório do histórico de operações.
//!
//! O SQL vive aqui, junto do banco, e não no módulo que produz o relatório: é o
//! mesmo motivo pelo qual `elo-core` existe — a persistência precisa ser
//! testável sem Tauri, e o broker elevado do Épico 7 vai reutilizar exatamente
//! estas funções.
//!
//! O repositório recebe **escalares já redigidos**. Nenhum caminho de arquivo
//! chega aqui: quem monta a mensagem é a camada de cima, e ela só escreve
//! contadores (docs/05 §privacidade).

use rusqlite::params;

use crate::errors::AppResult;

/// Uma operação a registrar no histórico.
#[derive(Debug, Clone)]
pub struct ActivityRecord {
    /// Correlaciona com o log técnico e com a operação que a originou.
    pub operation_id: String,
    /// Tipo da ação — precisa estar na lista aceita pelo schema.
    pub action_type: String,
    /// Frase pronta para exibição.
    pub message: String,
    /// `debug`, `info`, `warning` ou `error`.
    pub level: String,
    /// `success`, `partial`, `failed` ou `cancelled`.
    pub result: String,
    /// Itens afetados.
    pub affected_count: u64,
    /// Espaço liberado, em bytes.
    pub released_bytes: u64,
    /// Detalhe adicional já redigido.
    pub details: Option<String>,
    /// Quando aconteceu, em ISO-8601 UTC.
    pub created_at: String,
}

/// Uma entrada lida do histórico.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActivityEntry {
    /// Identificador do registro.
    pub id: String,
    /// Operação correlacionada.
    pub operation_id: String,
    /// Tipo da ação.
    pub action_type: String,
    /// Frase exibida.
    pub message: String,
    /// Resultado.
    pub result: String,
    /// Itens afetados.
    pub affected_count: u64,
    /// Espaço liberado.
    pub released_bytes: u64,
    /// Quando aconteceu.
    pub created_at: String,
    /// Detalhe adicional.
    pub details: Option<String>,
}

impl super::Database {
    /// Registra uma operação no histórico.
    ///
    /// `undo_kind` é gravado como `'none'`: enquanto a restauração não existir,
    /// nenhum registro pode sugerir que ela existe.
    ///
    /// # Errors
    /// Devolve `DatabaseError` se a escrita falhar.
    pub fn record_activity(&self, record: &ActivityRecord) -> AppResult<()> {
        let connection = self.connection()?;

        connection.execute(
            "INSERT INTO activity_logs (
                 id, operation_id, action_type, message, level, result,
                 affected_count, released_bytes, details, undo_kind, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'none', ?10)",
            params![
                crate::new_operation_id(),
                record.operation_id,
                record.action_type,
                record.message,
                record.level,
                record.result,
                i64::try_from(record.affected_count).unwrap_or(i64::MAX),
                i64::try_from(record.released_bytes).unwrap_or(i64::MAX),
                record.details,
                record.created_at,
            ],
        )?;

        Ok(())
    }

    /// Lê as operações mais recentes.
    ///
    /// # Errors
    /// Devolve `DatabaseError` se a consulta falhar.
    pub fn recent_activities(&self, limit: u32) -> AppResult<Vec<ActivityEntry>> {
        let connection = self.connection()?;

        let mut statement = connection.prepare(
            "SELECT id, operation_id, action_type, message, result,
                    affected_count, released_bytes, created_at, details
               FROM activity_logs
              ORDER BY created_at DESC, rowid DESC
              LIMIT ?1",
        )?;

        let rows = statement.query_map([limit], |row| {
            Ok(ActivityEntry {
                id: row.get(0)?,
                operation_id: row.get(1)?,
                action_type: row.get(2)?,
                message: row.get(3)?,
                result: row.get(4)?,
                affected_count: u64::try_from(row.get::<_, i64>(5)?).unwrap_or(0),
                released_bytes: u64::try_from(row.get::<_, i64>(6)?).unwrap_or(0),
                created_at: row.get(7)?,
                details: row.get(8)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn limpeza(result: &str, files: u64, bytes: u64) -> ActivityRecord {
        ActivityRecord {
            operation_id: crate::new_operation_id(),
            action_type: String::from("cleanup"),
            message: String::from("Limpeza de 3 áreas"),
            level: String::from("info"),
            result: String::from(result),
            affected_count: files,
            released_bytes: bytes,
            details: None,
            created_at: crate::now_iso8601(),
        }
    }

    #[test]
    fn registra_e_le_de_volta() {
        let db = Database::open_in_memory().expect("banco");
        let registro = limpeza("success", 120, 2_048_000);

        db.record_activity(&registro).expect("registrar");
        let historico = db.recent_activities(10).expect("ler");

        assert_eq!(historico.len(), 1);
        assert_eq!(historico[0].operation_id, registro.operation_id);
        assert_eq!(historico[0].affected_count, 120);
        assert_eq!(historico[0].released_bytes, 2_048_000);
        assert_eq!(historico[0].action_type, "cleanup");
    }

    #[test]
    fn o_mais_recente_vem_primeiro() {
        let db = Database::open_in_memory().expect("banco");

        for bytes in [100_u64, 200, 300] {
            db.record_activity(&limpeza("success", 1, bytes))
                .expect("registrar");
        }

        let historico = db.recent_activities(10).expect("ler");
        assert_eq!(historico.len(), 3);
        for par in historico.windows(2) {
            assert!(par[0].created_at >= par[1].created_at);
        }
    }

    #[test]
    fn o_limite_e_respeitado() {
        let db = Database::open_in_memory().expect("banco");
        for _ in 0..5 {
            db.record_activity(&limpeza("success", 1, 1))
                .expect("registrar");
        }

        assert_eq!(db.recent_activities(2).expect("ler").len(), 2);
    }

    #[test]
    fn um_resultado_fora_do_schema_e_recusado_pelo_banco() {
        // A restrição CHECK da migration é a última linha de defesa contra um
        // valor inventado chegar ao histórico.
        let db = Database::open_in_memory().expect("banco");
        let invalido = ActivityRecord {
            result: String::from("mais_ou_menos"),
            ..limpeza("success", 1, 1)
        };

        assert!(db.record_activity(&invalido).is_err());
    }

    #[test]
    fn nenhum_registro_sugere_reversao_disponivel() {
        let db = Database::open_in_memory().expect("banco");
        db.record_activity(&limpeza("partial", 5, 500))
            .expect("registrar");

        let connection = db.connection().expect("conexão");
        let (undo_kind, undo_ref): (String, Option<String>) = connection
            .query_row(
                "SELECT undo_kind, undo_ref FROM activity_logs LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("consultar");

        assert_eq!(undo_kind, "none");
        assert!(undo_ref.is_none());
    }

    #[test]
    fn um_historico_vazio_devolve_lista_vazia() {
        let db = Database::open_in_memory().expect("banco");
        assert!(db.recent_activities(10).expect("ler").is_empty());
    }
}
