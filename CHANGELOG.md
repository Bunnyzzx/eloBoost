# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado — Épico 0: infraestrutura

**Interface**

- Projeto Vite 8 + React 19 + TypeScript 5.9 em modo estrito, sem uso de `any`.
- Design system com tokens em CSS custom properties: `Button`, `Card`, `Badge`/`RiskBadge`,
  `Modal` com retenção de foco, `Toast`, `Toggle`, `Tooltip`, `Skeleton`, `EmptyState`,
  `ErrorState`.
- Tema escuro como padrão e tema claro completo, alternáveis em tempo de execução.
- Layout com barra lateral recolhível, cabeçalho com trilha de contexto e área principal
  responsiva (1080 px a 2K, escala de interface de 90% a 130%).
- Roteamento com 12 telas registradas; rota desconhecida volta ao início.
- Marca própria do eloBoost em SVG, e conjunto de ícones do instalador gerado a partir dela.

**Comunicação com o backend**

- Camada `services/ipc.ts` como única autorizada a chamar comandos Tauri, com validação Zod de
  toda resposta e normalização de erros.
- Regra de ESLint que impede `invoke` fora dessa camada.
- Contrato de erros com 22 códigos estáveis, mensagem amigável em pt-BR, sugestão de solução,
  indicação de retentabilidade e ID de diagnóstico.
- `ErrorBoundary` por área e captura global de promessas rejeitadas.

**Backend**

- Workspace Cargo com `elo-core` (sem dependência do Tauri) e `src-tauri`.
- Banco SQLite com WAL, `foreign_keys` e `busy_timeout`.
- Migrations versionadas com verificação de SHA-256: uma migration alterada após ter sido
  aplicada aborta a inicialização, e um banco criado por versão mais nova é detectado.
- Schema inicial com 12 tabelas, restrições `CHECK`, índices e integridade referencial.
- Mascaramento de nome de usuário e caminhos antes de qualquer registro em log.
- Log técnico com rotação diária e níveis debug/info/warning/error.
- Comandos `app_get_info` e `app_get_database_status`, ambos somente-leitura.

**Segurança**

- CSP restritiva e capabilities mínimas: sem plugin de shell, sistema de arquivos ou HTTP na
  interface.
- `unsafe_code = "forbid"` nos dois crates Rust.
- Nenhuma dependência capaz de executar processos externos foi adicionada ao projeto.

**Camada de animações e microinterações**

- Tokens centralizados de duração, easing e intensidade, espelhados entre TypeScript e CSS, com
  teste que falha se as duas metades divergirem.
- Transição de entrada de página com fade e deslocamento vertical sutil, sem animação de saída —
  evita piscada e telas duplicadas chamando o backend.
- Entrada escalonada de cards (40 ms por item, teto em 6) e elevação de 1 px no hover de cards
  interativos, sem deslocar o layout.
- Feedback de pressionar nos botões e estado desabilitado inequívoco.
- Barra lateral com transição de largura, rótulos que saem por opacidade sem desmontar, e
  destaque do item ativo que desliza entre itens.
- Componentes novos: `Spinner`, `ProgressBar`, `Meter` (reutilizável para CPU, memória, disco e
  rede), `PageTransition`, `StaggerItem`, `Reveal`, e variantes de skeleton `SkeletonText`,
  `SkeletonMeter`, `SkeletonRow`.
- Uma única animação contínua no sistema: a barra de progresso indeterminada.
- Suporte a `prefers-reduced-motion` do sistema e à configuração interna, com validação em
  navegador real (`pnpm check:motion`).

**Qualidade**

- 100 testes de frontend e 53 de backend.
- CI com verificação de tipos, lint, testes e build, em Linux e Windows.

### Observações

- Nenhuma funcionalidade de limpeza, otimização, registro, inicialização, processos ou
  monitoramento foi implementada. As telas correspondentes declaram isso explicitamente e não
  exibem dados simulados.
- O produto foi nomeado **eloBoost** (identificador `com.eloboost.app`), resolvendo a decisão
  D-4 do planejamento.
