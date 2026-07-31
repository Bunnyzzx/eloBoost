# Changelog

Todas as mudanças relevantes deste projeto são documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto adota
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado — Épico 3: Engine de Limpeza

O primeiro épico que remove arquivos. Toda remoção passa por três portas em série, e a do meio é
uma garantia do sistema de tipos, não uma convenção.

**`PathGuard` (`cleaner/validator.rs`)**

- `ValidatedPath` tem campos privados e **nenhum construtor público**: a única forma de obter um é
  `PathGuard::validate`. Como o executor só aceita `&ValidatedPath`, é impossível — pelo
  compilador — chamar a remoção com uma `String`.
- Verifica, em ordem: denylist absoluta (System32, Program Files, `$Recycle.Bin`, `pagefile.sys`,
  pastas pessoais), componentes suspeitos (`..`, UNC, dispositivos, caracteres de controle),
  pertencimento à raiz canônica, natureza do item (só arquivo comum) e identidade.
- **Canonicaliza o diretório pai, não o arquivo**: canonicalizar o arquivo resolveria um link, e é
  justamente o link que precisa ser recusado. Com o pai resolvido e o nome preservado, um atalho no
  meio do caminho não consegue apontar a remoção para fora da área.
- A identidade do arquivo (inode no Unix; carimbos + atributos no Windows) é reconferida
  imediatamente antes de remover — se o arquivo foi trocado, a remoção é abortada.

**Executor (`cleaner/executor.rs`)**

- **Nunca `remove_dir_all`.** Arquivos saem um a um; pastas só saem se já estiverem vazias, via
  `remove_dir`, que falha por construção se ainda houver conteúdo. Um defeito aqui perde um
  arquivo, nunca uma árvore. Há um teste que lê o próprio código-fonte e falha se a chamada
  recursiva aparecer.
- Nenhum erro interrompe a limpeza: acesso negado, arquivo em uso, caminho longo e item inexistente
  viram contadores e a execução segue.

**Contrato `Cleanable` (`traits/cleanable.rs`)**

- Os quatro verbos — `scan`, `preview`, `validate`, `clean` — têm **implementação padrão**. Uma
  categoria informa apenas quem é e onde vive. Se cada uma escrevesse a própria caminhada,
  existiriam sete implementações de "nunca seguir link", e só uma seria revisada a sério.
- A Engine reaproveita a travessia do scanner via `walk_root_with`, em vez de duplicá-la. O módulo
  `scanner/` continua sem nenhuma API de escrita.

**Fluxo prévia → confirmação → execução**

- `cleaner_preview` mede (somente leitura) e emite um `previewId` + `confirmationToken`.
- `cleaner_execute` **exige** esse par: token de uso único, expira em 5 minutos. Um duplo clique
  não roda a limpeza duas vezes.
- A seleção da interface é intersectada com a autorização da prévia: uma categoria que a prévia não
  liberou não é limpa nem que o frontend peça.

**Interface**

- Tela Limpeza com as fases seleção → confirmação → execução → resultado, cards atualizando ao
  vivo, e um `Checkbox` acessível novo (com estado indeterminado para o "marcar todas").
- Downloads e Lixeira aparecem medidas e **sem caixa de seleção** — a política do backend chega até
  o pixel.
- O resultado separa **itens mantidos** de **falhas**: um arquivo em uso que o eloBoost preservou
  não é um erro, e juntá-los apagaria o caso em que o produto agiu com cautela.
- Tela Histórico com o registro de cada limpeza. Informativa: não há botão de desfazer, e o rodapé
  diz que arquivos removidos não podem ser restaurados por ali.

**Persistência**

- `elo-core::db::activity` — repositório do histórico, com SQL junto do banco e testável sem Tauri.
  `undo_kind` é gravado como `'none'`: enquanto a restauração não existir, nenhum registro pode
  sugerir que ela existe.

### Adicionado — Épico 2: infraestrutura de análise (somente leitura)

Nenhum arquivo é aberto, alterado, movido ou removido. Esta etapa mede — a limpeza é o Épico 3.

**Motor de varredura (`src-tauri/src/scanner/`)**

- Caminhada iterativa com pilha explícita de diretórios: o tamanho é somado durante o percurso e a
  lista de arquivos nunca entra na memória. Uma pasta com 200 mil arquivos custa o mesmo que uma
  com dez.
- **Links nunca são seguidos.** Cada entrada é lida com metadados que não atravessam o link e, no
  Windows, também pelo atributo de *reparse point* — que cobre *junctions*, invisíveis para
  `is_symlink`. Uma junction para `C:\Users` dentro de `%TEMP%` não faz a análise medir a pasta
  pessoal inteira.
- Nenhum erro interrompe a análise: acesso negado, caminho longo demais, arquivo em uso e falhas de
  leitura viram contadores de diagnóstico, e a categoria conclui com o que conseguiu medir.
- Profundidade limitada a 64 níveis e filtros por prefixo ou extensão, para que uma categoria meça
  exatamente os arquivos que a definem — e não a pasta inteira em que eles vivem.
- Um teste lê o código-fonte do próprio módulo e falha se qualquer API de escrita aparecer; outro
  compara um manifesto completo (nome, tamanho, data) antes e depois de uma análise.

**Sete fontes independentes (`scanner/sources/`)**

- Arquivos temporários, temporários do Windows, Lixeira, miniaturas e ícones, registros do sistema,
  cache dos navegadores (Chrome, Edge, Firefox, todos os perfis) e Downloads.
- Cada fonte resolve apenas as próprias raízes; acrescentar uma categoria é acrescentar um arquivo.
- A Lixeira usa `SHQueryRecycleBin`, a API oficial — `$Recycle.Bin` nunca é enumerado à mão.
- **Downloads é somente medido.** A política viaja no tipo (`ManualSelectionOnly`), o resumo a
  exclui do "espaço recuperável" e há um teste que quebra se outra pasta pessoal for marcada como
  limpável em lote.
- Áreas exclusivas do Windows se declaram indisponíveis em outras plataformas, em vez de medir um
  equivalente e chamá-lo pelo nome errado.

**Comandos e eventos**

- `scanner_list_categories` e `scanner_scan_all`. Nenhum recebe caminho da interface.
- Cada categoria concluída é publicada em `scanner://category`, para que a tela preencha os cards
  conforme chegam. O retorno do comando continua sendo a fonte de verdade e corrige qualquer evento
  perdido.
- `subscribeToEvent` em `services/ipc.ts`: eventos passam pela mesma validação Zod das respostas de
  comando — uma carga fora do contrato é descartada, nunca renderizada.

**Tela Análise**

- Estados vazio, em andamento, concluído e erro. Os cards aparecem conforme cada área termina.
- O progresso conta **categorias concluídas**, não bytes: não há como saber o total antes de
  percorrer, e uma barra por estimativa andaria para trás. Enquanto nada respondeu, ela fica
  indeterminada.
- Uma área que não existe neste computador aparece em tom neutro — não é um problema a resolver.
- Ao final, o aviso exigido pelo produto fica visível junto do número grande: **nenhum arquivo foi
  removido**.

### Alterado — refinamento do Épico 1

- **Barra lateral fixa**: o recolhimento foi removido por inteiro (botão, estado persistido,
  tooltips do modo estreito). A largura caiu de 240 px para 224 px, devolvendo espaço ao dashboard
  sem alterar espaçamentos, alinhamento dos ícones nem a identidade visual.
- **Card "eloBoost"** reduzido ao que interessa ao usuário: versão, estado da comunicação,
  privilégio e horário da última leitura. Caminho do banco, schema, tamanho do arquivo, alvo de
  compilação e pasta de dados saíram — são diagnóstico de desenvolvedor. O perfil de compilação
  aparece apenas em builds de desenvolvimento. Nenhum valor escapa mais das bordas do card.
- **Página Sobre** reescrita para o usuário final, em torno de Segurança, Privacidade e
  Transparência. O card de diagnóstico do banco de dados e a lista de promessas negativas
  (incluindo a menção a FPS) foram removidos.
- **Campos indisponíveis** na ficha técnica passam a exibir o rótulo curto `não disponível`, com o
  motivo completo em tooltip acessível por mouse e por teclado — a frase por extenso repetida em
  várias linhas dominava o card.
- Rótulos `Edição` e `Versão` viraram `Edição do Windows` e `Versão do Windows`, para não colidirem
  com a versão do aplicativo exibida ao lado.
- Títulos de card quebram em duas linhas em vez de serem cortados; descrições de cabeçalho de tela
  usam `text-pretty` para evitar a última linha com uma palavra só.

### Adicionado — Épico 1: dashboard com dados reais do sistema

**Backend (somente leitura)**

- `models/availability.rs`: tipo `Availability<T>` que torna impossível apresentar um dado não
  lido — um campo indisponível carrega o motivo, nunca um zero.
- `services/`: um arquivo por domínio — `os`, `cpu`, `memory`, `storage`, `gpu`, `privilege`,
  `app` — orquestrados por `system_service`, com as leituras lentas em paralelo.
- `system/ffi.rs`: única fronteira Win32 do projeto, com `unsafe` confinado e um comentário
  `// SAFETY:` por bloco. Lê edição/versão/build do registro, adaptadores via DXGI e o estado de
  elevação do token — tudo somente leitura.
- `util/text.rs`: normalização de strings do sistema (terminadores nulos, espaços duplicados).
- Comandos `system_get_snapshot` e `app_get_runtime_info`.

**Interface**

- Tela Início reescrita como dashboard: processador com núcleos e frequência, memória com uso,
  placa de vídeo com memória dedicada, tempo ligado, um card por volume, ficha técnica do
  computador e diagnóstico do aplicativo.
- Componentes reutilizáveis novos: `StatCard`, `ProgressCard`, `StorageCard`, `InfoRow`/`InfoList`
  e `StatusBadge`.
- Botão Atualizar que preserva os dados anteriores na tela durante a recarga, com atenuação
  discreta em vez de skeletons piscando.
- `useAsync` passou a distinguir primeira carga de recarga (`isRefreshing`).
- `utils/status.ts` centraliza os limiares de uso, para que "atenção" signifique o mesmo em
  memória, disco e CPU.

**Dependências**

- `sysinfo` (multiplataforma) e `windows` (apenas no alvo Windows, features restritas às APIs de
  leitura efetivamente usadas).

### Adicionado — Épico 0: infraestrutura

**Interface**

- Projeto Vite 8 + React 19 + TypeScript 5.9 em modo estrito, sem uso de `any`.
- Design system com tokens em CSS custom properties: `Button`, `Card`, `Badge`/`RiskBadge`,
  `Modal` com retenção de foco, `Toast`, `Toggle`, `Tooltip`, `Skeleton`, `EmptyState`,
  `ErrorState`.
- Tema escuro como padrão e tema claro completo, alternáveis em tempo de execução.
- Layout com barra lateral fixa, cabeçalho com trilha de contexto e área principal
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

- 133 testes de frontend e 103 de backend.
- CI com verificação de tipos, lint, testes e build, em Linux e Windows.

### Observações

- Nenhuma funcionalidade de limpeza, otimização, registro, inicialização, processos ou
  monitoramento foi implementada. As telas correspondentes declaram isso explicitamente e não
  exibem dados simulados.
- O produto foi nomeado **eloBoost** (identificador `com.eloboost.app`), resolvendo a decisão
  D-4 do planejamento.
