# 10 — Riscos e Decisões em Aberto

Status: **Entrega 1 — planejamento**.

---

## 1. Riscos técnicos

| # | Risco | Prob. | Impacto | Mitigação | Sinal de alerta |
|---|---|---|---|---|---|
| R-01 | Bug de caminho apaga dados do usuário | Baixa | **Catastrófico** | `PathGuard` por handle, allowlist, Épico 2 antes do Épico 3, suíte adversarial, Lixeira por padrão em risco médio | Qualquer PR que remova arquivo sem `ValidatedPath` |
| R-02 | Antivírus classifica o eloBoost como PUP/riskware | **Alta** | Alto | Assinatura Authenticode desde o primeiro release, sem PowerShell/`cmd`, sem packers/ofuscação, submissão a Microsoft/AV para whitelisting, comportamento sempre precedido de consentimento | Detecção em VirusTotal no primeiro build |
| R-03 | Plumbing COM/WMI em Rust consome mais tempo que o estimado | Média | Médio | Encapsular cedo em `system/wmi.rs`, usar a crate `wmi` onde couber, timebox de 2d por integração antes de reavaliar | Épico 1 estourando prazo |
| R-04 | Playwright instável sobre WebView2 | Média | Baixo | E2E é `P3`; a cobertura real vem de Vitest+RTL com backend mockado na camada `services/` | — |
| R-05 | `SRSetRestorePoint` falha silenciosamente (Proteção do Sistema desativada, limite de 24h, Home Edition) | **Alta** | Médio | Verificar pré-condições **antes** de prometer o ponto; se indisponível, informar e deixar o usuário decidir entre prosseguir sem ponto ou cancelar; nunca ativar a proteção sem consentimento | Testes em VM com proteção desativada |
| R-06 | Falso positivo em "instaladores antigos órfãos" remove algo necessário | Média | Alto | Categoria não-marcada por padrão, exige revisão item a item, vai para a Lixeira, exige comprovação de orfandade (sem referência no `Uninstall`) | — |
| R-07 | Duplicados: hash de disco inteiro é lento e desgasta SSD | Média | Médio | Pipeline tamanho → hash dos primeiros/últimos 64 KB → SHA-256 completo só nos candidatos finais; leitura sequencial com limite de paralelismo | Análise profunda > 10 min |
| R-08 | Variação de builds do Windows quebra ajustes | **Alta** | Médio | Catálogo declara `min/max_windows_build`; leitura do estado atual antes de aplicar; verificação pós-aplicação com rollback automático | Ajuste "aplicado" mas valor não muda |
| R-09 | Encerrar processo desestabiliza o sistema | Média | Alto | Lista estática + verificações dinâmicas (PPL, integridade, assinatura, sessão 0); confirmação reforçada para árvore | — |
| R-10 | Crash durante alteração deixa estado inconsistente | Baixa | Alto | Journal de operações pendentes + recuperação no boot com diff visível | — |
| R-11 | WebView2 ausente em Win10 antigo | Média | Médio | Instalador embute o bootstrapper oficial; detecção na inicialização com mensagem clara | — |
| R-12 | Banco cresce demais após varredura profunda | Média | Baixo | Política de retenção + `incremental_vacuum` + agregação de scans antigos | DB > 200 MB |
| R-13 | Broker elevado vira superfície de escalada de privilégio | Baixa | **Crítico** | Catálogo fechado tipado, revalidação total, ACL do pipe, verificação Authenticode do chamador, binário mínimo auditável | Qualquer PR que adicione string livre ao protocolo |
| R-14 | Dependência comprometida | Baixa | Alto | Lockfiles, `cargo audit`/`cargo deny`, `pnpm audit` no CI, revisão de novas dependências | — |

## 2. Riscos de produto

| # | Risco | Mitigação |
|---|---|---|
| R-15 | Usuário espera "ganho de FPS" e se frustra | Comunicação honesta desde o onboarding; métricas reais antes/depois; nenhuma promessa numérica |
| R-16 | Percepção de "mais um limpador duvidoso" | Transparência radical: caminhos analisados visíveis, critérios de saúde abertos, compromissos de segurança e privacidade afirmados na tela Sobre, sem pop-ups de venda |
| R-17 | Usuário limpa cookies e perde sessões | Cookies nunca marcados por padrão; aviso explícito; separação clara entre cache e dados de sessão |
| R-18 | Usuário desativa algo essencial na inicialização | Itens protegidos bloqueados; avisos críticos; reversão em um clique no histórico |
| R-19 | Escopo cresce indefinidamente | Escopos MVP/1.0/futuro fechados no doc 09; Laboratório isola experimentos |

## 3. Riscos legais e de conformidade

| # | Risco | Mitigação |
|---|---|---|
| R-20 | Semelhança com produtos existentes | Identidade, nome, paleta, ícone e textos originais (doc 08 §1); nenhum ativo de terceiros |
| R-21 | LGPD/GDPR | Tudo local por padrão; telemetria desativada por padrão, opt-in, com prévia do payload; sem coleta de nomes de arquivos, documentos, senhas ou histórico; `PRIVACY.md` explícito; "apagar dados locais" disponível |
| R-22 | Licenças de terceiros | `cargo deny` + tela de licenças no Sobre |
| R-23 | Responsabilidade por dano ao sistema | Backup e ponto de restauração antes de alterações; avisos de risco por ajuste; `LICENSE` com isenção padrão; nenhuma ação destrutiva sem consentimento duplo |

---

## 4. Decisões que precisam da sua validação antes da implementação

Estas mudam a arquitetura ou o comportamento do produto; não avanço sem sua resposta.

| # | Decisão | Recomendação | Alternativa |
|---|---|---|---|
| **D-1** | **Broker elevado como binário separado** (`eloBoost.Elevator.exe`) | **Sim** — é o único jeito de cumprir "elevação por operação" sem rodar o app inteiro como admin. Custo: 2º binário, 2º certificado, ~6 dias (Épico 7) | App inteiro elevado (viola o requisito 17) ou funções admin removidas do escopo |
| **D-2** | **Lixeira por padrão** para categorias de risco médio e `downloads_old` | **Sim** — torna erros reversíveis de fato. Cache/temp de risco baixo continuam indo direto | Exclusão definitiva sempre (mais espaço liberado imediato, sem rede de proteção) |
| **D-3** | **Idioma inicial** | pt-BR como padrão, estrutura i18n pronta desde o Épico 0, en-US completo na v1.0 | Só pt-BR (mais rápido, retrabalho depois) |
| **D-4** | ~~Nome definitivo~~ **RESOLVIDO** | **eloBoost** é o nome oficial do produto. Bundle identifier: `com.eloboost.app`. Crate compartilhado: `elo-core`. Aplicado em todo o repositório. | — |
| **D-5** | **Gerenciador de pacotes** | pnpm (lockfile determinístico, mais rápido) | npm |
| **D-6** | **Alvo de compatibilidade** | Windows 10 build 19041+ e Windows 11 | Incluir builds mais antigos (aumenta matriz de teste e limita APIs) |
| **D-7** | **Ordem de entrega** | Seguir o doc 09 (Fundação → PathGuard → Sistema → Limpeza) | Priorizar telas visuais antes do backend (entrega uma demo mais cedo, mas com dados mock — contra o requisito de "não criar apenas protótipo visual") |

---

## 5. Premissas assumidas

Se alguma estiver errada, me avise que eu reviso o planejamento:

1. Distribuição própria (site/GitHub Releases), **não** Microsoft Store — MSIX virtualiza registro
   e sistema de arquivos, o que quebraria um app de manutenção.
2. Certificado de assinatura de código será obtido antes do primeiro release público; o pipeline
   fica pronto com placeholder.
3. Sem backend/servidor próprio no MVP: tudo local. O updater precisará apenas de um endpoint
   estático servindo JSON + binários assinados.
4. O usuário-alvo é doméstico/gamer brasileiro; pt-BR é o idioma primário.
5. Desenvolvimento no Linux é possível para frontend e lógica pura de Rust, mas **compilação e
   testes das APIs Win32 exigem uma máquina/VM Windows**. Este ambiente é Linux — a partir do
   Épico 1 (integrações nativas), será necessário validar em Windows.
