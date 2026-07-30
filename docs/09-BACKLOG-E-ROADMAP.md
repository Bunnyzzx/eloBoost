# 09 — Backlog, Escopos e Roadmap

Status: **Entrega 1 — planejamento**.

Prioridades: **P0** bloqueia tudo · **P1** essencial ao MVP · **P2** necessário para 1.0 ·
**P3** desejável · **P4** futuro.

Estimativas em *dias de desenvolvimento focado* (1 dev sênior). São ordens de grandeza para
sequenciamento, não compromisso de prazo.

---

## 1. Separação de escopos

### MVP (v0.1) — "análise e limpeza confiáveis"
Dashboard · Informações reais do sistema · Análise de temporários · Limpeza segura ·
Dry Run · Histórico · Configurações · Backup das ações · Interface responsiva ·
Tratamento de erros · Onboarding de primeira execução.

### v1.0 — "suíte completa de manutenção"
MVP + Otimizações com reversão · Inicialização · Aplicativos instalados · Processos ·
Armazenamento (rápido + profundo + duplicados) · Monitoramento · Restauração completa ·
Broker elevado · Instalador NSIS/MSI · Atualizador assinado · Documentação completa · i18n.

### Futuro (v1.x+)
Perfil Gaming · Laboratório experimental · Agendamento automático · Perfis personalizados ·
Relatórios avançados · Temas adicionais · Plano Pro · Tema claro polido · Telemetria opt-in.

---

## 2. Backlog

### Épico 0 — Fundação `P0` (~7d)
| ID | Tarefa | Est. | Depende |
|---|---|---|---|
| F-01 | Scaffold Tauri 2 + React + TS strict + Vite + Tailwind | 1d | — |
| F-02 | ESLint + Prettier + `tsc --noEmit` + `cargo fmt/clippy` + CI GitHub Actions | 1d | F-01 |
| F-03 | Design tokens, tema escuro, tipografia, `globals.css` | 1d | F-01 |
| F-04 | `AppLayout` + Sidebar + Header + rotas + páginas vazias com `EmptyState` | 1.5d | F-03 |
| F-05 | Componentes base: Button, Card, Modal, Toggle, Tooltip, Toast, Badge, Skeleton | 1.5d | F-03 |
| F-06 | `AppError` (Rust) + `OperationError` (TS) + `services/ipc.ts` com Zod + ErrorBoundary | 1d | F-01 |
| F-07 | SQLite + migrations versionadas + `schema_migrations` + testes de migração | 1d | F-01 |
| F-08 | `logging/` com tracing, rotação e redaction + `operation_id` | 0.5d | F-06 |

**Saída da fase:** app abre, navega entre 12 telas vazias, tem tema, erros tipados e banco
inicializado. Dados ainda inexistentes (nada de mock disfarçado de real).

### Épico 1 — Informações reais do sistema `P1` (~5d)
| ID | Tarefa | Est. |
|---|---|---|
| S-01 | `system/paths.rs` com trait `SystemPaths` + `FakeSystemPaths` para testes | 0.5d |
| S-02 | SO, build, edição, nome do computador, usuário | 0.5d |
| S-03 | CPU (nome, núcleos, threads, clock) via WMI + `GetLogicalProcessorInformation` | 0.5d |
| S-04 | Memória, discos (tipo SSD/HDD via `StorageDeviceSeekPenalty`), espaço livre | 1d |
| S-05 | GPU + VRAM (WMI `Win32_VideoController` + DXGI para VRAM real) | 1d |
| S-06 | Uptime + amostragem básica CPU/RAM/disco (PDH) | 1d |
| S-07 | `SystemInfoCard`, `StatCard`, `Sparkline` no dashboard, com dados reais | 0.5d |

### Épico 2 — Segurança de caminhos `P0` (~4d) — **antes de qualquer limpeza**
| ID | Tarefa | Est. |
|---|---|---|
| P-01 | `PathGuard`: canonicalização, allowlist, denylist, traversal, dispositivos, UNC | 1.5d |
| P-02 | `ValidatedPath` baseado em handle (anti-TOCTOU) + API de remoção que só aceita ele | 1d |
| P-03 | Detecção de reparse points, junctions e cross-volume | 0.5d |
| P-04 | Suíte de testes de segurança (tempdir isolado, ~40 casos incl. adversariais) | 1d |

### Épico 3 — Limpeza `P1` (~9d)
| ID | Tarefa | Est. |
|---|---|---|
| C-01 | Trait `Cleaner` + registro de categorias + `cleanup_list_categories` | 0.5d |
| C-02 | Cleaners: `user_temp`, `windows_temp`, `thumbnails`, `explorer_cache` | 1.5d |
| C-03 | Cleaners: `error_reports`, `windows_logs`, `shader_cache`, `memory_dumps` | 1d |
| C-04 | Lixeira via `SHQueryRecycleBin`/`SHEmptyRecycleBin` | 0.5d |
| C-05 | Detecção de navegadores (Chromium + Firefox) e perfis, com verificação de execução | 1.5d |
| C-06 | Fluxo scan → prepare → execute com `confirmationToken` e Dry Run | 1.5d |
| C-07 | Progresso por evento, cancelamento cooperativo, resultado parcial consistente | 1d |
| C-08 | UI: `CleanupCategoryCard`, seleção, detalhes paginados, modais de confirmação/progresso | 1.5d |

### Épico 4 — Histórico, backup de ações e configurações `P1` (~5d)
| ID | Tarefa | Est. |
|---|---|---|
| H-01 | `activity_logs` + repositório + `ActivityTable` + filtros + detalhes | 1.5d |
| H-02 | Snapshot L1 (JSON + SHA-256) + repositório de backups | 1d |
| H-03 | `settings` com schema Zod/serde + tela de Configurações | 1.5d |
| H-04 | Exportação de relatório com prévia e consentimento | 1d |

### Épico 5 — Saúde e análise do sistema `P1` (~3d)
| ID | Tarefa | Est. |
|---|---|---|
| A-01 | Motor de saúde com critérios transparentes e pesos versionados | 1d |
| A-02 | `HealthGauge` + painel "Como calculamos" | 0.5d |
| A-03 | Fluxo "Analisar computador" agregando limpeza + startup + espaço | 1.5d |

### Épico 6 — Primeira execução `P1` (~2d)
| ID | Tarefa | Est. |
|---|---|---|
| O-01 | Onboarding: boas-vindas, aviso de segurança, idioma, tema, preferências | 1.5d |
| O-02 | Primeira análise opcional + entrada no dashboard | 0.5d |

> **Fim do MVP.** Marco: app instalável, útil e seguro, sem nenhuma função simulada.

### Épico 7 — Elevação `P2` (~6d)
| ID | Tarefa | Est. |
|---|---|---|
| E-01 | Crate `src-elevator` + manifesto + catálogo fechado de operações | 1.5d |
| E-02 | Named pipe com ACL, nonce, verificação Authenticode do chamador | 1.5d |
| E-03 | `PermissionService` + `PermissionDialog` + sessão elevada com expiração | 1.5d |
| E-04 | Revalidação completa do lado elevado + testes de rejeição | 1.5d |

### Épico 8 — Inicialização e aplicativos `P2` (~7d)
| ID | Tarefa | Est. |
|---|---|---|
| I-01 | Enumeração: `Run`/`RunOnce` (HKCU/HKLM, 32/64), pasta Startup | 1.5d |
| I-02 | Tarefas agendadas (COM `ITaskService`) e serviços (seção avançada) | 1.5d |
| I-03 | `StartupApproved` (habilitar/desabilitar) + `startup_snapshots` + reversão | 1.5d |
| I-04 | Lista de itens protegidos + avisos críticos | 0.5d |
| I-05 | Apps instalados (registro Uninstall + MSIX) com ícones | 1.5d |
| I-06 | Desinstalação/reparo via desinstalador oficial | 0.5d |

### Épico 9 — Otimizações `P2` (~8d)
| ID | Tarefa | Est. |
|---|---|---|
| T-01 | Catálogo declarativo TOML + validação (descrição/efeitos obrigatórios) + `FORBIDDEN_TARGETS` | 1.5d |
| T-02 | Trait `Optimization` (read/apply/revert/verify) + `InMemoryRegistry` | 1.5d |
| T-03 | Ajustes de energia, visuais, animações, transparência | 1.5d |
| T-04 | Ajustes de gaming (modo de jogo, captura em segundo plano, notificações) | 1d |
| T-05 | Privacidade, indexação por pasta, otimização de unidades/TRIM (APIs oficiais) | 1.5d |
| T-06 | UI `OptimizationCard` + fluxo backup→confirmação→aplicar→verificar→reverter | 1d |

### Épico 10 — Restauração `P2` (~4d)
| ID | Tarefa | Est. |
|---|---|---|
| R-01 | `SRSetRestorePoint` + listagem via WMI + tratamento do limite de 24h | 1.5d |
| R-02 | Tela de Restauração + `RestorePointDialog` | 1d |
| R-03 | Reversão a partir de snapshots + journal de recuperação pós-crash | 1.5d |

### Épico 11 — Armazenamento `P2` (~6d)
| ID | Tarefa | Est. |
|---|---|---|
| G-01 | Varredura com categorização (rápida e profunda) + progresso | 2d |
| G-02 | Maiores pastas, arquivos grandes, arquivos antigos | 1d |
| G-03 | Duplicados: tamanho → hash parcial → SHA-256 completo, com seleção manual | 2d |
| G-04 | `StorageChart` + UI | 1d |

### Épico 12 — Processos e monitoramento `P2` (~7d)
| ID | Tarefa | Est. |
|---|---|---|
| M-01 | Enumeração de processos + métricas + assinatura + integridade | 2d |
| M-02 | Encerrar processo/árvore com pid+startTime e listas protegidas | 1d |
| M-03 | Amostrador PDH (CPU, RAM, disco, rede, GPU) + ring buffers 60s/5min/15min | 2d |
| M-04 | Sensores opcionais com fallback declarado | 1d |
| M-05 | `ResourceChart` + telas de Processos e Monitoramento | 1d |

### Épico 13 — Distribuição `P2` (~5d)
| ID | Tarefa | Est. |
|---|---|---|
| D-01 | Ícone e identidade aplicados ao bundle | 0.5d |
| D-02 | Instalador NSIS + MSI, com bootstrapper do WebView2 | 1.5d |
| D-03 | Atualizador com verificação de assinatura + changelog + rollback | 1.5d |
| D-04 | Pipeline de assinatura Authenticode (placeholder para o certificado) | 1d |
| D-05 | Termos, política de privacidade, licenças de terceiros | 0.5d |

### Épico 14 — Qualidade transversal `P1–P2` (contínuo, ~6d)
| ID | Tarefa | Est. |
|---|---|---|
| Q-01 | Testes de componentes (Vitest + RTL) das telas do MVP | 2d |
| Q-02 | Testes de integração dos fluxos scan/clean/restore em tempdir | 1.5d |
| Q-03 | Acessibilidade: navegação por teclado, focus trap, contraste, `axe` no CI | 1.5d |
| Q-04 | Matriz de responsividade (1280/1366/1920/2K × 100/125/150%) | 1d |

### Futuro `P3–P4`
| ID | Tarefa | Escopo |
|---|---|---|
| X-01 | Perfil Gaming completo (com restauração pós-crash) | v1.1 |
| X-02 | Laboratório experimental (desabilitado por padrão) | v1.1 |
| X-03 | Agendamento de limpeza automática | v1.1 |
| X-04 | Perfis personalizados de otimização | v1.2 |
| X-05 | Relatórios avançados e comparação temporal | v1.2 |
| X-06 | Arquitetura de licenciamento Free/Pro (sem bloquear segurança) | v1.2 |
| X-07 | Telemetria opt-in com prévia do payload | v1.2 |
| X-08 | Tema claro polido + temas adicionais | v1.2 |
| X-09 | E2E Playwright sobre WebView2 | v1.1 |
| X-10 | i18n en-US completo | v1.0/1.1 |

---

## 3. Sequência recomendada

```
Fundação (F) ──► Segurança de caminhos (P) ──► Sistema (S) ──► Limpeza (C)
                                                    │
                          Histórico/Backup (H) ─────┤
                                Saúde (A) ──────────┤
                             Onboarding (O) ────────┴──► ◆ MVP v0.1

Elevação (E) ──► Startup/Apps (I) ──► Otimizações (T) ──► Restauração (R)
Armazenamento (G) ──► Processos/Monitor (M) ──► Distribuição (D) ──► ◆ v1.0
                          Qualidade (Q) atravessa tudo
```

Ordem inegociável: **Épico 2 (PathGuard) antes do Épico 3 (limpeza)** e **Épico 7 (elevação)
antes do Épico 9 (otimizações)**. Nenhuma função que escreve no sistema é implementada antes da
sua camada de proteção existir e estar testada.

Totais: MVP ≈ **35 dias** · v1.0 ≈ **78 dias** (sem contar futuro).

---

## 4. Definição de Pronto

Uma tarefa só é "pronta" quando:
1. `tsc --noEmit` limpo, sem `any` não justificado;
2. `eslint` sem warnings;
3. `cargo clippy -- -D warnings` limpo;
4. testes novos escritos e a suíte inteira passando;
5. nenhum dado simulado em funcionalidade marcada como concluída (mocks, quando existirem,
   carregam rótulo visível "DADOS DE EXEMPLO" na UI);
6. estados de carregando/vazio/erro implementados;
7. navegação por teclado funcionando na tela tocada;
8. entrada no `CHANGELOG.md`;
9. se toca `security/`, `cleaners/`, `optimizations/` ou `src-elevator/`: checklist de segurança
   do doc 05 §8 preenchido no PR.
