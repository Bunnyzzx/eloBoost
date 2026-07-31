# eloBoost

> Utilitário de limpeza, manutenção e otimização **segura** para Windows 10 e 11.
>
> **Status: Épico 3 — Engine de Limpeza.** Início lê informações reais do computador, Análise mede
> as áreas descartáveis e **Limpeza remove o que você marcar** — sempre depois de uma prévia e de
> uma confirmação explícita. Toda remoção passa pelo `PathGuard`, que só aprova caminhos dentro das
> áreas autorizadas; arquivos pessoais e a pasta Downloads nunca são limpos em lote. **Nenhuma
> otimização, escrita no registro, alteração de serviço ou restauração existe no projeto.**

---

## O que é

O eloBoost centraliza ferramentas legítimas de manutenção do Windows — limpeza de temporários,
análise de armazenamento, gerenciamento de inicialização, processos, aplicativos instalados,
monitoramento e ajustes de desempenho — com três compromissos inegociáveis:

1. **Nada acontece sem análise prévia e confirmação explícita.**
2. **Toda alteração de configuração é reversível**, com backup obrigatório antes de aplicar.
3. **Transparência total**: os caminhos analisados, os critérios de saúde e a origem de cada
   métrica são exibidos ao usuário.

## Limites do produto

Estes limites são parte da arquitetura, não apenas uma intenção:

- Todo número exibido vem de uma leitura real do computador. Quando um dado não pode ser lido, o
  aplicativo diz isso em vez de estimar.
- Arquivos pessoais só são removidos com seleção explícita, item a item. A pasta Downloads é
  medida e **nunca** limpa em lote — a política está no tipo, não num comentário.
- Nada é removido sem uma prévia e uma confirmação: o comando de execução exige um token de uso
  único emitido pela prévia que o usuário viu.
- A interface não executa comandos arbitrários: apenas operações nomeadas e validadas.
- A elevação de privilégio é pedida por operação, com explicação antes — nunca para a sessão
  inteira, e nunca contornando o UAC.
- Mecanismos de segurança do Windows (Defender, firewall, Windows Update) não são desativados.
- Nada é coletado ou enviado: sem nomes de arquivos, documentos, senhas ou histórico.
- Sem pop-ups agressivos nem padrões enganosos de compra.

## Capturas de tela

O dashboard, com dados reais lidos do sistema:

![Dashboard com dados reais](screenshots/18-inicio-aplicativo-real.png)

A análise do computador, medindo áreas reais. As categorias exclusivas do Windows aparecem como
indisponíveis nesta máquina Linux, em vez de zeradas:

![Análise com dados reais](screenshots/20-analise-aplicativo-real.png)

A limpeza, em três etapas. Seleção — Downloads aparece medido, sem caixa de seleção:

![Seleção da limpeza](screenshots/21-limpeza-selecao-real.png)

Confirmação, com o total, as áreas pelo nome e a promessa sobre arquivos pessoais:

![Confirmação da limpeza](screenshots/22-limpeza-confirmacao-real.png)

Resultado de uma limpeza real: 521 arquivos removidos, 2 pastas vazias e **1 atalho preservado** —
o link que apontava para fora da área permitida:

![Resultado da limpeza](screenshots/23-limpeza-resultado-real.png)

A ficha técnica completa. Os campos que este sistema não expõe aparecem como `não disponível`, com
o motivo ao passar o mouse — nunca zerados:

![Ficha técnica com dados reais](screenshots/19-ficha-tecnica-aplicativo-real.png)

| Sobre | Tema claro |
| --- | --- |
| ![Sobre](screenshots/12-sobre.png) | ![Tema claro](screenshots/13-tema-claro.png) |

As 25 capturas de `screenshots/` cobrem as 13 telas, os dois temas, as resoluções 1280×720,
1366×768, 1920×1080 e o aplicativo real em execução.

Para regenerá-las:

```bash
pnpm build
pnpm preview --port 4173 &
pnpm screenshots
```

Como rodam no navegador (sem o backend Tauri), as telas mostram o estado **"Somente interface"** —
que é o comportamento correto fora do aplicativo instalado, não um defeito da captura.

## Tecnologias

| Camada | Escolha |
| --- | --- |
| Aplicativo desktop | Tauri 2 |
| Backend | Rust (workspace com `elo-core` + `src-tauri`) |
| Banco local | SQLite via `rusqlite`, com migrations versionadas |
| Interface | React 19 + TypeScript 5.9 (estrito) + Vite 8 |
| Estilo | Tailwind CSS 4 com tokens próprios |
| Animação / gráficos | Framer Motion · Recharts |
| Estado / validação | Zustand · Zod |
| Testes | Vitest + Testing Library · `cargo test` |

A comparação que levou a essa escolha está em [`docs/00-DECISAO-TECNICA.md`](docs/00-DECISAO-TECNICA.md).

## Pré-requisitos

- **Node.js 20.19+** (recomendado 22) e **pnpm 10+**
- **Rust 1.97.0** — instalado automaticamente pelo `rustup` a partir de `rust-toolchain.toml`
- **Windows 10 (build 19041+) ou 11** para executar o aplicativo
- No Windows: **WebView2 Runtime** (já presente no Windows 11 e na maioria dos Windows 10)
- No Linux, apenas para desenvolvimento da interface e do núcleo:
  `libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev patchelf`

## 1. Instalar as dependências

```bash
git clone https://github.com/Bunnyzzx/eloBoost.git
cd eloBoost

pnpm install          # dependências do frontend
```

As dependências do Rust são baixadas automaticamente na primeira compilação. A versão do
compilador vem de `rust-toolchain.toml` (Rust 1.97.0) — o `rustup` instala sozinho na primeira
execução de `cargo`.

## 2. Executar apenas o frontend

```bash
pnpm dev
```

Abre em <http://localhost:5173>. Roda no navegador, **sem o backend**: as chamadas ao núcleo
falham com `BACKEND_UNAVAILABLE` e a interface exibe o aviso "Somente interface" — em vez de
travar ou mostrar dados falsos. Útil para trabalhar em UI sem recompilar Rust.

## 3. Executar pelo Tauri (aplicativo completo)

```bash
pnpm tauri dev
```

Sobe o Vite e o backend Rust juntos, abrindo a janela do aplicativo. É a única forma de exercitar
o caminho completo interface → comando Tauri → Rust → SQLite. Na primeira execução a compilação
do Rust leva alguns minutos.

O banco é criado em `%APPDATA%\\eloBoost\\eloboost.db` e os logs em
`%APPDATA%\\eloBoost\\logs\\`.

## 4. Rodar os testes

```bash
# Tudo de uma vez
pnpm verify           # tsc --noEmit + eslint + vitest
pnpm verify:rust      # cargo fmt --check + clippy -D warnings + cargo test

# Individualmente
pnpm typecheck
pnpm lint
pnpm test             # 206 testes do frontend
pnpm test:watch
pnpm test:coverage

cargo test --workspace --all-features   # 264 testes do backend
cargo clippy --workspace --all-targets --all-features -- -D warnings
cargo fmt --all --check
```

Verificação do código exclusivo do Windows sem uma máquina Windows — `cargo check` e `clippy` não
linkam, então o alvo GNU basta para type-checar tudo atrás de `#[cfg(windows)]`:

```bash
rustup target add x86_64-pc-windows-gnu
sudo apt-get install -y gcc-mingw-w64-x86-64   # apenas no Linux

CC_x86_64_pc_windows_gnu=x86_64-w64-mingw32-gcc \
  cargo clippy --target x86_64-pc-windows-gnu --workspace --all-targets --all-features -- -D warnings
```

Validação da camada de animações num navegador real — navegação rápida, ausência de deslocamento
de layout, barra lateral de largura estável e `prefers-reduced-motion` efetivo:

```bash
pnpm build
pnpm preview --port 4173 &
pnpm check:motion
```

**Nenhum teste escreve nem remove fora de uma pasta temporária própria, e nenhum toca o registro.**
Os testes do banco usam SQLite em memória ou diretórios isolados; os do scanner e os da Engine de
Limpeza montam a própria árvore de arquivos e a removem no fim. Os que exercitam áreas reais da
máquina — a pasta temporária, por exemplo — apenas as **leem**, e um deles compara um manifesto
completo antes e depois para provar que a análise não alterou nada.

Três testes sustentam a garantia de segurança da limpeza, e vale rodá-los ao mexer no `cleaner/`:

```bash
cargo test --package eloboost cleaner::   # PathGuard, executor e Engine
```

## 5. Gerar o build

```bash
pnpm build                  # interface de produção em dist/
cargo build --workspace     # backend em modo debug
cargo build --release       # backend otimizado

pnpm tauri build            # instalador Windows (NSIS + MSI) em
                            # src-tauri/target/release/bundle/
```

`pnpm tauri build` precisa ser executado **no Windows** para gerar o instalador da plataforma.

## Estrutura

```
src/                 Interface React
  app/               App, rotas, tema, captura global de erros
  components/        Design system (ui, feedback, layout)
  pages/             13 telas
  services/          Única camada autorizada a chamar comandos Tauri
  schemas/           Validadores Zod das respostas do backend
  stores/            Zustand por domínio
  types/             Contratos espelhando os structs Rust

crates/elo-core/     Núcleo sem dependência do Tauri
  src/errors.rs      AppError, códigos e serialização
  src/db/            Banco local e migrations
  src/paths.rs       Mascaramento de dados sensíveis
  src/logging.rs     Log técnico com rotação
  migrations/        SQL versionado
  tests/             Instalação limpa e contrato de erros

src-tauri/           Aplicativo Tauri
  src/commands/      Comandos nomeados (a fronteira com a interface)
  src/scanner/       Motor de varredura somente leitura + uma fonte por área
  src/cleaner/       Engine de Limpeza: validator (PathGuard) · executor · engine
  src/traits/        Contrato `Cleanable`, com implementação padrão dos 4 verbos
  src/models/        Contratos de dados (Availability, resultados de análise)
  src/state.rs       Estado compartilhado (banco, pasta de dados)
  capabilities/      Permissões mínimas da janela
  icons/             Ícones do instalador

scripts/             Geração de ícones e capturas
screenshots/         Capturas versionadas das telas
docs/                Planejamento completo (11 documentos)
```

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [00 — Decisão técnica](docs/00-DECISAO-TECNICA.md) | Tauri × .NET/WinUI × Electron, placar ponderado e limitações declaradas |
| [01 — Arquitetura](docs/01-ARQUITETURA.md) | Camadas, fluxo obrigatório de ação, serviços, cancelamento |
| [02 — Estrutura de diretórios](docs/02-ESTRUTURA-DE-DIRETORIOS.md) | Árvore do repositório por escopo |
| [03 — Modelo de dados](docs/03-MODELO-DE-DADOS.md) | DDL SQLite, migrations, retenção e privacidade |
| [04 — Contratos IPC](docs/04-CONTRATOS-IPC.md) | Comandos, tipos TS/Rust e catálogo de erros |
| [05 — Plano de segurança](docs/05-PLANO-DE-SEGURANCA.md) | Ameaças, `PathGuard`, allowlist, CSP, itens protegidos |
| [06 — Permissões administrativas](docs/06-PERMISSOES-ADMINISTRATIVAS.md) | Elevação por operação e broker elevado |
| [07 — Backup e reversão](docs/07-BACKUP-E-REVERSAO.md) | Camadas de proteção e recuperação pós-crash |
| [08 — Wireframes](docs/08-WIREFRAMES.md) | Identidade visual, telas, modais e acessibilidade |
| [09 — Backlog e roadmap](docs/09-BACKLOG-E-ROADMAP.md) | MVP / v1.0 / futuro, épicos e definição de pronto |
| [10 — Riscos](docs/10-RISCOS.md) | Riscos técnicos, de produto e legais |

## Limitações conhecidas

- **Nenhuma funcionalidade que altera o sistema existe.** Limpeza, otimizações, inicialização,
  processos e aplicativos estão apenas planejados. O Épico 1 entregou somente **leitura**.
- **O aplicativo ainda não foi executado no Windows.** O ambiente de desenvolvimento atual é
  Linux; a compilação, os testes e a execução passam aqui, mas os campos exclusivos do Windows
  (edição, versão comercial, GPU via DXGI, estado de elevação) só podem ser validados naquela
  plataforma. Fora do Windows eles aparecem como "informação não suportada neste dispositivo" —
  que é o comportamento correto, e não um defeito.
- **Sensores de temperatura e ventoinha** não serão suportados sem driver em modo kernel — o
  aplicativo exibirá "Informação não suportada neste dispositivo" em vez de estimar valores.
- **O instalador ainda não é assinado.** O pipeline de assinatura Authenticode está previsto para
  o Épico 13.

## Avisos de segurança

- O eloBoost pede elevação **por operação**, nunca para a sessão inteira, e sempre explicando
  antes o que será feito.
- A interface não constrói caminhos de arquivo nem chaves de registro: ela manipula apenas
  identificadores opacos devolvidos pelo backend.
- O plugin de shell do Tauri **não** está nas capabilities do aplicativo, o que torna a execução
  de um comando arbitrário impossível a partir da interface — mesmo em caso de falha na camada web.
- Os logs mascaram nome de usuário e caminhos, e nunca registram senhas, tokens ou conteúdo de
  arquivos.

## Próxima etapa

**Épico 2 — Segurança de caminhos (`PathGuard`)**, conforme
[`docs/09-BACKLOG-E-ROADMAP.md`](docs/09-BACKLOG-E-ROADMAP.md). É pré-requisito inegociável do
Épico 3 (limpeza): nenhuma função que remove arquivos é escrita antes de a camada de proteção
existir e estar testada.
