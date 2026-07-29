# 07 — Plano de Backup e Reversão

Status: **Entrega 1 — planejamento**.

Regra do produto: **toda alteração de configuração é reversível**. Onde a reversão é
tecnicamente impossível (arquivo apagado definitivamente), o app diz isso com clareza *antes*
de agir — nunca oferece um botão "Desfazer" que falharia.

---

## 1. Camadas de proteção

| Camada | Escopo | Custo | Quando |
|---|---|---|---|
| **L1 — Snapshot de configuração** | Valor exato antes/depois de cada chave | ~KB, instantâneo | Sempre, obrigatório, para toda alteração de registro/startup/energia |
| **L2 — Backup de conjunto** | Todas as chaves de um lote (ex.: "Perfil Gaming") | ~KB | Ao aplicar perfis/lotes |
| **L3 — Ponto de restauração do Windows** | Sistema inteiro | Minutos, ~centenas de MB | Antes de lotes de risco médio/alto, com consentimento |
| **L4 — Lixeira do Windows** | Arquivos removidos de categorias de risco médio | Espaço em disco | Padrão para categorias não-cache (ver 05 §4) |

L1 é **obrigatória e bloqueante**: se o snapshot falhar, a alteração não acontece
(`BACKUP_FAILED`). Isso é intencional — preferimos não otimizar a otimizar sem volta.

---

## 2. Fluxo obrigatório de alteração (requisito 15)

```
1. LER      valor atual real (não presumido)         → previous_value
2. SNAPSHOT L1 gravado em optimization_history + arquivo JSON com SHA-256
3. RESTORE  L3 se: risco ≥ medium, OU lote, OU o usuário ativou "sempre criar"
              → requer elevação (ver doc 06); se negada, oferecer prosseguir SEM ponto
                (com aviso explícito) ou cancelar. Nunca prosseguir silenciosamente.
4. CONFIRMAR  modal com: o que muda, valor atual → novo, riscos, efeitos colaterais,
              se exige reinício, e se é reversível
5. EXECUTAR
6. VERIFICAR  reler o valor e comparar com o esperado
                 ├─ igual        → status = applied
                 ├─ diferente    → status = failed + rollback automático imediato
                 └─ precisa boot → status = pending_restart
7. REGISTRAR  activity_logs (com undo_ref) + optimization_history
```

O passo 6 é o que distingue "aplicamos" de "achamos que aplicamos". Nada é reportado como
sucesso sem releitura.

---

## 3. Formato do snapshot interno

`%LOCALAPPDATA%\BoostCore\backups\<uuid>.json` + `sha256` registrado em `backups`:

```jsonc
{
  "schemaVersion": 1,
  "id": "0192f3c1-...",
  "kind": "registry_snapshot",
  "createdAt": "2026-07-29T14:02:11.412Z",
  "appVersion": "0.1.0",
  "operationId": "0192f3c0-...",
  "user": "%USER%",
  "windows": { "build": 22631, "edition": "Pro" },
  "entries": [
    {
      "target": "HKCU\\Control Panel\\Desktop\\MenuShowDelay",
      "kind": "registry_value",
      "valueType": "REG_SZ",
      "previous": { "present": true, "value": "400" },
      "new":      { "present": true, "value": "100" }
    },
    {
      "target": "startup:registry_run:user:Spotify",
      "kind": "startup_item",
      "previous": { "state": "enabled", "rawApproved": "AgAAAAAAAAAAAAAA" },
      "new":      { "state": "disabled" }
    }
  ],
  "requiresRestart": false,
  "reversible": true
}
```

Pontos de desenho:
- `previous.present = false` distingue "valor não existia" de "valor era vazio" — reverter
  significa **apagar** a chave, não gravar "".
- `rawApproved` guarda o blob binário original: restauramos o byte exato.
- O arquivo é validado por hash na leitura; snapshot corrompido ⇒ `BACKUP_FAILED` e a reversão
  não é oferecida como se fosse segura.
- Snapshots não contêm dados pessoais (ver doc 05 §6).

---

## 4. Reversão

| Origem | Como reverter |
|---|---|
| Otimização individual | `optimization_revert(historyId)` → aplica `previous` de cada entrada, revalida, marca `reverted_at` |
| Lote / perfil | Reverte na ordem inversa da aplicação |
| Item de startup | Restaura `raw_previous` do `startup_snapshots` |
| Sessão Gaming | Restaura `applied_changes` invertidos; se o app foi encerrado abruptamente, a recuperação roda no próximo boot |
| Configurações do app | `settings_reset` restaura padrões (também gera snapshot antes) |
| Arquivos na Lixeira | Instrui o usuário a restaurar pela Lixeira; o app não "des-apaga" por conta própria |
| Arquivos removidos definitivamente | **Não reversível** — declarado antes da ação e no histórico |
| Sistema inteiro | Abre `rstrui.exe` no ponto escolhido (interface oficial do Windows) |

### Reversão em cascata
Se o usuário reverte uma otimização que foi aplicada antes de outras que dependem dela, o
`OptimizationService` detecta a dependência (declarada no catálogo como `depends_on`) e avisa,
oferecendo reverter o conjunto.

---

## 5. Recuperação após interrupção

Duas situações:

**A) Crash/energia durante uma alteração.**
Antes de escrever, gravamos um *journal* (`pending_operations`, em SQLite, com WAL) contendo o
plano completo. No boot, o app detecta operações em `applied`/`in_progress` sem `verified_at` e:
1. Relê o estado real do sistema;
2. Se ficou no meio, oferece **concluir** ou **reverter** — com o diff exato na tela;
3. Registra a decisão.

**B) Sessão Gaming interrompida.**
`gaming_sessions.status = 'active'` no boot ⇒ banner:
"Uma sessão de jogo foi interrompida. Restaurar as configurações anteriores?" com a lista do que
seria restaurado. Requisito 13 atendido.

---

## 6. Pontos de restauração do Windows

- Criados via `SRSetRestorePoint` (`APPLICATION_INSTALL` / `MODIFY_SETTINGS`), com descrição
  padronizada `BoostCore — <motivo> — <data>`.
- O Windows limita a **um ponto por 24h por padrão** (`SystemRestorePointCreationFrequency`).
  **Não alteramos essa política do usuário.** Quando bloqueado, informamos:
  "O Windows já criou um ponto de restauração recentemente; ele será usado." e mostramos a data
  do ponto existente.
- Se a Proteção do Sistema estiver desativada, o app **não a ativa silenciosamente**: explica o
  que é, o custo em disco, e oferece um botão que abre as configurações oficiais do Windows.
- A listagem lê pontos existentes via WMI (`SystemRestore`), incluindo os criados por outros
  programas — marcados com sua origem.

---

## 7. Retenção

| Tipo | Padrão | Configurável |
|---|---|---|
| Snapshots de configuração | 90 dias ou 200 registros | sim |
| Relatórios exportados | Nunca apagados (ficam onde o usuário salvou) | — |
| Detalhes de scans de limpeza | 30 dias / 5 scans | sim |
| Pontos de restauração do Windows | Gerenciados pelo Windows | não (é do SO) |

O app nunca apaga pontos de restauração do Windows automaticamente. A exclusão manual está
disponível na tela de Restauração, com confirmação e aviso de que é irreversível.

---

## 8. Testes obrigatórios desta área

- Aplicar → verificar → reverter → verificar, para cada tipo de alvo (registro presente,
  registro ausente, startup, energia), usando `InMemoryRegistry`.
- Falha no snapshot ⇒ alteração **não** ocorre (teste de injeção de falha).
- Snapshot corrompido (hash inválido) ⇒ reversão recusada com erro claro.
- Journal com operação interrompida ⇒ recuperação oferece as duas opções corretas.
- Reversão de valor inexistente ⇒ a chave é **removida**, não zerada.
- Nenhum teste toca o registro real nem pastas reais do Windows.
