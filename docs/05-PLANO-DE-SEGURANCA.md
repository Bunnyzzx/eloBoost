# 05 — Plano de Segurança

Status: **Entrega 1 — planejamento**.

O BoostCore apaga arquivos e altera o registro. O modelo de segurança não é um item de checklist:
é o produto. Este documento define o que o app **pode**, o que ele **nunca** faz e como isso é
garantido por construção, não por boa intenção.

---

## 1. Modelo de ameaças

| # | Ameaça | Impacto | Mitigação |
|---|---|---|---|
| T1 | Bug de caminho apaga dados do usuário | Crítico | `PathGuard` com allowlist, canonicalização, negação de caminhos fora de raízes permitidas, testes obrigatórios |
| T2 | Path traversal via nome de arquivo/entrada | Crítico | Nenhum caminho vem do frontend; canonicalização antes de qualquer comparação |
| T3 | Symlink/junction/reparse point aponta para fora da área permitida | Crítico | Não seguir reparse points; comparar `FILE_ID_INFO` + volume; remover o link, nunca o alvo |
| T4 | TOCTOU (caminho validado, depois trocado) | Alto | Operar por **handle**, não por caminho: abrir com `FILE_FLAG_OPEN_REPARSE_POINT`, validar o handle, apagar pelo handle |
| T5 | Conteúdo malicioso no WebView executa comando nativo | Crítico | CSP restritiva, sem `shell`/`fs` nas capabilities, comandos nomeados apenas, tokens de confirmação |
| T6 | Processo não confiável se conecta ao pipe do Elevator e pede operação privilegiada | Crítico | ACL do pipe restrita ao SID do usuário, verificação Authenticode do processo cliente, catálogo fechado de operações, revalidação total do lado elevado |
| T7 | Escalada por DLL hijacking / binary planting no diretório do app | Alto | Instalação em `Program Files` (ACL de admin), `SetDefaultDllDirectories`, sem carregar DLLs de caminhos graváveis pelo usuário |
| T8 | Atualização maliciosa | Crítico | HTTPS + verificação de assinatura minisign do manifesto e do binário antes de executar; rollback |
| T9 | Vazamento de dados pessoais em logs/relatórios | Alto | Redaction obrigatória, sem conteúdo de arquivo, sem cookies/senhas, exportação opt-in com prévia |
| T10 | App quebra o Windows ao desabilitar algo essencial | Alto | Listas de itens protegidos + avisos críticos + backup e reversão obrigatórios |
| T11 | Injeção de SQL no banco local | Médio | Apenas *prepared statements*; nenhuma query concatenada |
| T12 | Dependência comprometida (supply chain) | Alto | Lockfiles commitados, `cargo audit` + `pnpm audit` no CI, atualização revisada |

---

## 2. `PathGuard` — o componente mais crítico do sistema

Todo caminho a ser removido, lido em massa ou modificado passa por ele. Algoritmo:

```
validate(candidate, intent) -> Result<ValidatedPath, PathRejection>

1. Rejeitar imediatamente se contém: NUL, caracteres de controle, "..", ADS (":" após a letra
   de unidade), prefixos de dispositivo (\\.\ , \\?\ , CON, PRN, AUX, NUL, COM1..9, LPT1..9).
2. Rejeitar caminhos UNC (\\servidor\share) — o BoostCore não limpa rede.
3. Canonicalizar SEM seguir o último componente (GetFinalPathNameByHandle com
   FILE_FLAG_OPEN_REPARSE_POINT).
4. Verificar que a raiz canônica pertence à ALLOWLIST da categoria em questão.
5. Verificar que a raiz canônica NÃO pertence à DENYLIST (verificação redundante proposital).
6. Verificar profundidade máxima (padrão 64) e comprimento (< 32.767 com prefixo estendido).
7. Se for reparse point: NÃO seguir. Marcar `is_symlink = true`; a política padrão é ignorar.
8. Verificar que o volume do handle é o mesmo do diretório-raiz permitido (impede junction
   cross-volume).
9. Verificar exclusões configuradas pelo usuário.
10. Devolver ValidatedPath contendo o HANDLE já aberto, não uma string.
```

Ponto central: **`ValidatedPath` encapsula um handle**. Funções de remoção só aceitam
`ValidatedPath`. É impossível, pelo sistema de tipos, chamar `delete()` com uma `String` — o
compilador impede. É assim que T2/T4 deixam de depender de disciplina.

### Allowlist (raízes permitidas por categoria)

| Categoria | Raízes |
|---|---|
| `user_temp` | `%LOCALAPPDATA%\Temp`, `%TEMP%` |
| `windows_temp` | `%SystemRoot%\Temp` |
| `thumbnails` | `%LOCALAPPDATA%\Microsoft\Windows\Explorer` (apenas `thumbcache_*.db`, `iconcache_*.db`) |
| `explorer_cache` | idem acima, arquivos específicos |
| `windows_logs` | `%SystemRoot%\Logs`, `%SystemRoot%\System32\LogFiles` (somente `*.log`, `*.etl` com idade > 7 dias) |
| `error_reports` | `%LOCALAPPDATA%\CrashDumps`, `%ProgramData%\Microsoft\Windows\WER` |
| `update_cache` | `%SystemRoot%\SoftwareDistribution\Download` **somente** após verificar que o serviço `wuauserv` está parado e o download foi concluído |
| `recycle_bin` | via `SHEmptyRecycleBin` (API oficial), nunca manipulando `$Recycle.Bin` na mão |
| `browser_cache` | perfis detectados, subpastas de cache conhecidas por navegador |
| `shader_cache` | `%LOCALAPPDATA%\{NVIDIA,AMD,D3DSCache}`, `%LOCALAPPDATA%\NVIDIA\DXCache` |
| `app_temp` | subpastas `Temp`/`Cache` de apps de uma lista curada |
| `memory_dumps` | `%SystemRoot%\MEMORY.DMP`, `%SystemRoot%\Minidump` |
| `old_installers` | `%LOCALAPPDATA%\Package Cache` (apenas órfãos comprovados), `%TEMP%\*.msi` órfãos |
| `downloads_old` | `%USERPROFILE%\Downloads` — **somente sugestão, nunca selecionado por padrão, nunca removido sem seleção item a item** |

### Denylist absoluta (nunca tocada, em nenhuma circunstância)

```
%SystemRoot%\System32          %SystemRoot%\SysWOW64      %SystemRoot%\WinSxS
%ProgramFiles%                 %ProgramFiles(x86)%        %SystemDrive%\Users\<user>\Documents
Desktop, Pictures, Videos, Music, OneDrive, Dropbox, Google Drive
%SystemRoot%\System32\config   (registro)   pagefile.sys / hiberfil.sys / swapfile.sys
Qualquer raiz de volume (C:\, D:\)          System Volume Information
%SystemRoot%\Prefetch          (requisito 12: não limpar indiscriminadamente)
Pastas de instalação de jogos e aplicativos
```

`downloads_old` é a única categoria que toca uma pasta pessoal, e apenas em modo "sugestão com
seleção manual explícita" — nunca varre, nunca marca, nunca apaga sozinha.

---

## 3. Configuração do Tauri

`tauri.conf.json` (essencial):

```jsonc
{
  "app": {
    "security": {
      "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "freezePrototype": true,
      "assetProtocol": { "enable": false }
    }
  }
}
```

`capabilities/default.json`: apenas `core:event:*` e a lista explícita dos comandos do app.
**Não incluímos** `shell:allow-execute`, `fs:*`, `http:*`. O plugin `dialog` é incluído apenas
para os diálogos nativos de escolha de pasta/arquivo (exclusões e destino de exportação).

Consequência: mesmo que um atacante consiga executar JS arbitrário dentro do WebView, ele só
alcança os comandos nomeados — todos com validação, listas protegidas e token de confirmação.

---

## 4. Operações destrutivas

| Regra | Aplicação |
|---|---|
| Análise obrigatória antes de remoção | Impossível chamar `cleanup_execute` sem um `planId` gerado por `cleanup_prepare`, que só existe a partir de um `scanId` |
| Confirmação dupla | Token de uso único, TTL 5 min, atrelado ao conjunto exato de itens |
| Dry run | Flag no plano; execução percorre todo o fluxo e reporta, sem chamar nenhuma função de remoção |
| Backup antes de mudar | Otimizações/startup: snapshot **obrigatório**; falha no backup ⇒ `BACKUP_FAILED` e a alteração **não** ocorre |
| Sem "selecionar tudo" perigoso | Categorias `medium`/`high` nunca vêm pré-marcadas |
| Lixeira quando possível | Para arquivos de categorias de risco médio, usar `IFileOperation` com `FOF_ALLOWUNDO` (vai para a Lixeira) em vez de exclusão definitiva — reversível de fato |

> Decisão de produto que recomendo e submeto à sua validação: **usar a Lixeira por padrão** para
> categorias de risco médio/alto (e `downloads_old`), com opção "exclusão definitiva" nas
> configurações avançadas. Custa um pouco de espaço liberado imediato, mas torna literalmente todo
> erro reversível pelo usuário. Arquivos de cache/temp (risco baixo) vão direto, senão a Lixeira
> incharia sem propósito.

---

## 5. Processos e startup protegidos

Listas versionadas em `resources/protected_*.toml`, com **duas camadas**:

1. **Estática** — nomes/caminhos canônicos: `System`, `Registry`, `smss.exe`, `csrss.exe`,
   `wininit.exe`, `services.exe`, `lsass.exe`, `winlogon.exe`, `svchost.exe`, `MsMpEng.exe`,
   `SecurityHealthService.exe`, `dwm.exe`, `explorer.exe` (aviso, não bloqueio), soluções de
   antivírus conhecidas, softwares de acessibilidade.
2. **Dinâmica** — checagens em runtime, que capturam o que a lista não previu:
   - `IsProtectedProcess` / `PROCESS_PROTECTION_LEVEL` (PPL) ⇒ bloquear;
   - integridade `System` ⇒ bloquear;
   - executável em `System32` **e** assinado pela Microsoft ⇒ exigir confirmação reforçada;
   - processo com sessão 0 e conta `SYSTEM` ⇒ bloquear;
   - serviço marcado como crítico (`SERVICE_ERROR_CRITICAL`) ⇒ bloquear.

O nome nunca é o único critério (um malware pode se chamar `lsass.exe`); a decisão combina
caminho canônico + assinatura + nível de integridade + proteção do SO.

**Requisitos vetados que serão explicitamente impossíveis no código:** desativar Windows
Defender, firewall ou Windows Update. Esses alvos entram numa `FORBIDDEN_TARGETS` verificada no
`OptimizationService` e no Elevator — mesmo que alguém adicione uma entrada no catálogo TOML, o
serviço recusa e um teste de unidade falha o build.

---

## 6. Privacidade em logs

| Regra | Implementação |
|---|---|
| Sem senhas, tokens, cookies, conteúdo de arquivo | Nunca lemos conteúdo, exceto hash de duplicados (que não é registrado com o caminho completo) |
| Caminhos mascarados | `C:\Users\Ana\AppData\Local\Temp\x.tmp` → `%LOCALAPPDATA%\Temp\x.tmp`; nome do usuário substituído por `%USER%` |
| Nomes de arquivos pessoais | Em `downloads_old` e duplicados, o log registra hash curto + tamanho, não o nome |
| Níveis | `debug` (só com modo avançado ativo), `info`, `warning`, `error` |
| Rotação | 5 arquivos × 5 MB, `%LOCALAPPDATA%\BoostCore\logs` |
| `operation_id` | Presente em toda linha; é a chave para o usuário reportar um problema sem enviar o log inteiro |
| Exportação | Opt-in, com prévia do conteúdo e aviso do que contém |

---

## 7. Dependências e build

- `pnpm-lock.yaml` e `Cargo.lock` commitados; CI falha se o lock mudar sem intenção.
- `cargo audit` + `cargo deny` (licenças e avisos) + `pnpm audit --audit-level high` no CI.
- `#![deny(clippy::all, clippy::pedantic)]` nos crates de segurança; `unsafe` apenas em
  `system/ffi.rs`, com `// SAFETY:` obrigatório por bloco.
- Compilação com mitigações do Windows: `/DYNAMICBASE /NXCOMPAT /guard:cf` (via flags do MSVC),
  CFG habilitado.
- Assinatura Authenticode do `BoostCore.exe`, do `BoostCore.Elevator.exe` e do instalador
  (preparado no pipeline; certificado a ser provido posteriormente).

## 8. Checklist de revisão de segurança por PR

Todo PR que toca `security/`, `cleaners/`, `optimizations/`, `system/` ou `src-elevator/` exige:

- [ ] Nenhum caminho novo aceito do frontend sem `PathGuard`
- [ ] Nenhuma nova chamada de processo externo; se houver, justificada e com argumentos fixos
- [ ] Nova entrada no catálogo tem `description`, `side_effects` e `how_it_works` preenchidos
- [ ] Nova operação destrutiva tem backup + reversão + teste de reversão
- [ ] Teste com `FakeSystemPaths` cobrindo caso feliz, caminho negado e symlink
- [ ] Nenhum dado pessoal novo em log (verificado contra `redact`)
