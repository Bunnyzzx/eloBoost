# 06 — Plano de Permissões Administrativas

Status: **Entrega 1 — planejamento**.

Princípio (requisito 17): o eloBoost **não roda elevado**. Ele roda com o token normal do
usuário e pede elevação **por operação**, explicando antes o motivo. O UAC nunca é contornado,
adiado ou "reduzido" — nem por conveniência.

---

## 1. Classificação das operações

### Nível 0 — sem elevação (a grande maioria)
Toda a UI, monitoramento, listagens e:
- Informações do sistema (WMI, PDH, `GetSystemInfo`)
- Análise de armazenamento no perfil do usuário
- Limpeza de `user_temp`, `thumbnails`, `explorer_cache`, `browser_cache`, `shader_cache`,
  `app_temp`, Lixeira do próprio usuário
- Startup de escopo **usuário** (`HKCU\...\Run`, pasta Startup do usuário)
- Listagem de processos (dados básicos) e encerramento de processos do próprio usuário
- Otimizações de escopo usuário: efeitos visuais (`SystemParametersInfo`), transparência, modo de
  jogo, notificações, animações
- Leitura do catálogo, histórico, configurações, backups internos

### Nível 1 — elevação por operação
| Operação | Por quê |
|---|---|
| Criar ponto de restauração | `SRSetRestorePoint` exige admin |
| Limpar `%SystemRoot%\Temp`, logs do Windows, WER de máquina, `MEMORY.DMP` | ACL de sistema |
| Limpar cache do Windows Update | Requer parar/verificar `wuauserv` |
| Ler/alterar startup em `HKLM` e `StartupApproved` de máquina | ACL |
| Habilitar/desabilitar serviços e tarefas agendadas de sistema | ACL |
| Alterar plano de energia do sistema / criar plano | `PowerSetActiveScheme` em escopo máquina |
| Otimizações que gravam em `HKLM` | ACL |
| Encerrar processo de outro usuário ou de serviço | `SeDebugPrivilege` |
| Otimizar unidades (defrag/TRIM via API oficial) | ACL |
| Instalar atualização do próprio eloBoost | Escreve em `Program Files` |

### Nível 2 — nunca oferecidas
Desativar Defender, firewall, Windows Update, remover serviços essenciais, desativar
paginação/isolamento de núcleo, alterar BCD. Não existem no catálogo e são bloqueadas por
`FORBIDDEN_TARGETS` mesmo se alguém tentar adicioná-las.

---

## 2. Fluxo de elevação

```
① Usuário clica em uma ação de Nível 1
        │
② Frontend chama o comando normalmente
        │
③ PermissionService detecta: requiresAdmin && !isElevatorAvailable
        │  → devolve AppError::PermissionDenied { needs_admin: true }
        │    OU emite evento `elevation:required` com o motivo
        │
④ UI abre o PermissionDialog:
        ┌──────────────────────────────────────────────────────────┐
        │  🛡  Permissão de administrador necessária                │
        │                                                          │
        │  Para criar um ponto de restauração, o Windows exige     │
        │  permissão de administrador.                             │
        │                                                          │
        │  O que será feito:                                       │
        │   • Criar um ponto de restauração chamado "eloBoost –   │
        │     antes de otimizações" no disco C:                    │
        │                                                          │
        │  O que NÃO será feito:                                   │
        │   • Nenhum arquivo será removido                         │
        │   • Nenhuma configuração de segurança será alterada      │
        │                                                          │
        │  A permissão vale apenas para esta operação.             │
        │                                                          │
        │            [ Cancelar ]     [ Continuar ]                │
        └──────────────────────────────────────────────────────────┘
        │
⑤ Usuário confirma → ShellExecuteEx(verb = "runas", eloBoost.Elevator.exe)
        │  → Windows exibe o UAC (diálogo do SO, não nosso)
        │
⑥ Elevator inicia, conecta ao named pipe, verifica assinatura do processo chamador
        │
⑦ App envia { operationId, operation: <enum fechado>, params }
        │
⑧ Elevator REVALIDA tudo (allowlist, listas protegidas, targets proibidos)
        │  e executa apenas aquela operação
        │
⑨ Resultado tipado volta pelo pipe → registrado em activity_logs → UI
        │
⑩ Elevator encerra. O app volta ao nível normal.
```

Se o usuário cancelar o UAC (⑤/⑥): `ELEVATION_CANCELLED`, mensagem
"Permissão de administrador não concedida. A ação não foi executada." — sem insistir, sem
repetir o prompt automaticamente.

---

## 3. Sessão elevada (agrupamento consentido)

Aplicar 8 otimizações que exigem admin geraria 8 prompts de UAC — hostil e leva o usuário a
clicar sem ler. Solução:

- Quando uma ação em lote precisa de N operações elevadas, o diálogo lista **todas** elas
  explicitamente e pede **uma** elevação para o lote.
- O Elevator recebe o lote com o catálogo exato das operações e não aceita nada fora dele.
- A sessão elevada expira em **5 minutos** ou ao término do lote — o que vier primeiro.
- Ao expirar, o Elevator encerra o processo. Não existe modo "manter elevado".
- Um indicador visível no Header mostra "modo elevado ativo" enquanto durar, com botão
  "Encerrar agora".

---

## 4. Contrato do Elevator

```rust
// crates/elo-core/src/elevated_ops.rs — compartilhado e revalidado dos dois lados
#[derive(Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
pub enum ElevatedOperation {
    CreateRestorePoint { description: String },
    DeleteFilesInAllowedRoot { root: SystemRoot, item_ids: Vec<FileToken> },
    SetRegistryValue { hive: Hive, key: RegistryKeyId, value: RegistryValue },
    DeleteRegistryValue { hive: Hive, key: RegistryKeyId, name: String },
    SetStartupApproved { item: StartupItemId, enabled: bool },
    SetServiceStartType { service: ServiceId, start_type: ServiceStartType },
    SetScheduledTaskEnabled { task: TaskPath, enabled: bool },
    SetActivePowerScheme { scheme: PowerSchemeId },
    OptimizeVolume { volume: VolumeId, mode: OptimizeMode },
    TerminateProcess { pid: u32, start_time: u64 },
}
```

Características que tornam isso seguro:
- `RegistryKeyId`, `SystemRoot`, `ServiceId`, `TaskPath` são **enums/IDs de um catálogo fechado**,
  não strings livres. O Elevator não sabe escrever numa chave arbitrária porque o tipo não permite
  expressá-la.
- `FileToken` é um identificador emitido pelo processo não elevado, resolvido pelo Elevator contra
  a mesma allowlist — o Elevator refaz a validação completa do `PathGuard`.
- `deny_unknown_fields` + enum `tag`ado: mensagem malformada é rejeitada antes de qualquer efeito.
- Toda operação escreve seu resultado e o `operation_id` de volta; nada acontece "em silêncio".

### Proteção do canal
- Pipe: `\\.\pipe\eloBoost.Elevator.<sid-do-usuário>` com *security descriptor* que concede
  acesso apenas ao SID do usuário interativo e a `SYSTEM`.
- O Elevator obtém o PID do cliente (`GetNamedPipeClientProcessId`) e verifica:
  assinatura Authenticode válida do nosso certificado **e** caminho do executável dentro do
  diretório de instalação.
- Nonce por sessão trocado via linha de comando do Elevator, evitando que outro processo se
  conecte primeiro.
- Timeout de conexão: 30 s. Sem cliente válido, o Elevator encerra.

---

## 5. Regras invioláveis

1. Nunca usar auto-elevação por task scheduler, `ms-settings` hijack, COM moniker elevado ou
   qualquer bypass conhecido de UAC. Se o usuário negar, a ação não acontece.
2. Nunca marcar o app inteiro como `requireAdministrator`.
3. Nunca pedir elevação sem explicar antes, em português claro, o que será feito.
4. Nunca reutilizar uma sessão elevada para operações não listadas no consentimento.
5. Se o usuário não for administrador da máquina, a UI mostra as ações de Nível 1 desabilitadas
   com explicação — em vez de falharem depois de clicadas.
6. O manifesto do Elevator declara `uiAccess=false` e `requireAdministrator` — sem
   `autoElevate`.
