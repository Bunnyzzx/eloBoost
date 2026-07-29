# BoostCore

> Utilitário de limpeza, manutenção e otimização **segura** para Windows 10 e 11.
>
> **Status: Entrega 1 — Planejamento.** Nenhum código de aplicação foi escrito ainda.
> A implementação começa somente após validação deste planejamento.

---

## O que é

O BoostCore centraliza ferramentas legítimas de manutenção do Windows — limpeza de temporários,
análise de armazenamento, gerenciamento de inicialização, processos, aplicativos instalados,
monitoramento e ajustes de desempenho — com três compromissos inegociáveis:

1. **Nada acontece sem análise prévia e confirmação explícita.**
2. **Toda alteração de configuração é reversível**, com backup obrigatório antes de aplicar.
3. **Transparência total**: os caminhos analisados, os critérios de saúde e a origem de cada
   métrica são exibidos ao usuário.

## O que o BoostCore nunca fará

- Desativar Windows Defender, firewall ou Windows Update.
- Prometer ganho de FPS ou qualquer número de desempenho não medido.
- Apagar arquivos pessoais sem seleção explícita, item a item.
- Executar comandos arbitrários vindos da interface.
- Rodar como administrador o tempo todo, ou contornar o UAC.
- Coletar nomes de arquivos, documentos, senhas ou histórico de navegação.
- Usar pop-ups agressivos ou padrões enganosos de compra.

## Stack escolhida

**Tauri 2 + Rust + React 18 + TypeScript + Vite + Tailwind + Framer Motion + Recharts + SQLite.**

Comparação completa e justificativa em [`docs/00-DECISAO-TECNICA.md`](docs/00-DECISAO-TECNICA.md).
Resumo: é o único dos três candidatos avaliados em que a proibição de "shell genérico" é
**estrutural** e não apenas disciplina de revisão, com cerca de 1/4 da memória do Electron e
acesso nativo direto ao Win32 sem depender de PowerShell.

## Documentação do planejamento

| Documento | Conteúdo |
|---|---|
| [00 — Decisão técnica](docs/00-DECISAO-TECNICA.md) | Tauri × .NET/WinUI × Electron, placar ponderado, decisão e limitações declaradas |
| [01 — Arquitetura](docs/01-ARQUITETURA.md) | Camadas, fluxo obrigatório de ação, serviços, eventos, cancelamento, testabilidade |
| [02 — Estrutura de diretórios](docs/02-ESTRUTURA-DE-DIRETORIOS.md) | Árvore completa do repositório, marcada por escopo |
| [03 — Modelo de dados](docs/03-MODELO-DE-DADOS.md) | DDL SQLite, migrations versionadas, retenção e privacidade |
| [04 — Contratos IPC](docs/04-CONTRATOS-IPC.md) | Catálogo de comandos, tipos TS, structs Rust, catálogo de erros |
| [05 — Plano de segurança](docs/05-PLANO-DE-SEGURANCA.md) | Modelo de ameaças, `PathGuard`, allowlist/denylist, CSP, itens protegidos |
| [06 — Permissões administrativas](docs/06-PERMISSOES-ADMINISTRATIVAS.md) | Classificação por nível, fluxo de elevação, contrato do broker elevado |
| [07 — Backup e reversão](docs/07-BACKUP-E-REVERSAO.md) | Camadas de proteção, formato do snapshot, recuperação pós-crash |
| [08 — Wireframes](docs/08-WIREFRAMES.md) | Identidade visual própria, tokens, 13 telas, 5 modais, acessibilidade |
| [09 — Backlog e roadmap](docs/09-BACKLOG-E-ROADMAP.md) | MVP / v1.0 / futuro, 14 épicos, estimativas, definição de pronto |
| [10 — Riscos](docs/10-RISCOS.md) | Riscos técnicos, de produto e legais + **decisões que aguardam validação** |

## Escopos

**MVP (v0.1)** — Dashboard · informações reais do sistema · análise de temporários · limpeza
segura · Dry Run · histórico · configurações · backup das ações · interface responsiva ·
tratamento de erros · primeira execução. (~35 dias)

**v1.0** — MVP + otimizações reversíveis · inicialização · aplicativos · processos ·
armazenamento com duplicados · monitoramento · restauração · broker elevado · instalador ·
atualizador assinado. (~78 dias)

**Futuro** — Perfil Gaming · Laboratório experimental · agendamento · perfis · relatórios
avançados · plano Pro opcional (sem bloquear funções de segurança).

## Próximo passo

Este repositório contém **apenas planejamento**. Antes de iniciar o Épico 0 (fundação), preciso
da sua validação sobre as decisões listadas em
[`docs/10-RISCOS.md` §4](docs/10-RISCOS.md) — principalmente o broker elevado (D-1), o uso da
Lixeira por padrão (D-2) e o nome definitivo do produto (D-4).
