# 08 — Wireframes Textuais e Identidade Visual

Status: **Entrega 1 — planejamento**.

---

## 1. Identidade visual do eloBoost

Identidade **própria**, criada para este produto. Nenhum ativo, nome, ícone, texto ou paleta
copiado de outro aplicativo.

### Conceito
"Núcleo de energia" — um utilitário que revela o estado real da máquina. Sóbrio, técnico,
sem estética de "turbo/racing". A confiança vem da clareza, não de promessas.

### Logotipo
Marca geométrica: um **hexágono de traço fino** (o "core") com um traço interno ascendente que
sugere um gráfico e, ao mesmo tempo, a letra "B". Monocromático em azul elétrico sobre fundo
escuro; versão em branco puro para uso monocromático. Wordmark: `eloBoost` em Inter SemiBold,
com "Core" em peso menor e cor secundária.

### Tokens de cor (CSS custom properties)

```css
:root[data-theme="dark"] {
  /* superfícies — azul-marinho quase preto */
  --bg-base:        #070B14;
  --bg-surface:     #0D1425;
  --bg-elevated:    #131C32;
  --bg-overlay:     #0A0F1Ccc;

  /* bordas e traços */
  --border-subtle:  #1C2942;
  --border-strong:  #2A3B5C;

  /* texto */
  --text-primary:   #EAF0FA;
  --text-secondary: #9CAFCB;
  --text-muted:     #647695;

  /* marca e destaques */
  --accent:         #3D7EFF;   /* azul elétrico — ação primária */
  --accent-hover:   #5B93FF;
  --accent-soft:    #3D7EFF1F;
  --violet:         #8B5CF6;   /* dados secundários em gráficos */

  /* semântica de status — nunca é o ÚNICO indicador (ver acessibilidade) */
  --ok:             #2ED47A;
  --attention:      #F5A524;
  --critical:       #F2545B;

  --focus-ring:     #7AA7FF;
}
```

Tema claro previsto desde o início (tokens espelhados), mas o **escuro é o padrão**.

### Tipografia
Inter (variável), embarcada localmente — nenhuma fonte remota (a CSP proíbe). Escala:
`11 / 12 / 14 / 16 / 20 / 24 / 32 / 40`. Números tabulares (`font-variant-numeric: tabular-nums`)
em toda métrica, para não "dançar" durante atualizações em tempo real.

### Forma e movimento
- Raio: `8px` (controles), `14px` (cards), `20px` (modais).
- Sombras suaves e frias: `0 1px 2px #0006, 0 8px 24px #0004`.
- Ícones: Lucide, traço 1.5px, 20px padrão.
- **Nada pulsa, brilha ou faz contagem regressiva falsa.** Barras de progresso refletem trabalho
  real; se não sabemos o total, usamos indeterminado honesto.

#### Camada de movimento

Tokens em `src/constants/motion.ts` e `src/styles/theme.css` — as duas metades da mesma fonte de
verdade, com um teste que falha se divergirem.

| Token | Valor | Uso |
|---|---|---|
| `instant` | 120 ms | hover, pressionar, troca de cor |
| `base` | 180 ms | entrada de elemento, fade, transição de página |
| `slow` | 240 ms | abrir modal, barra de progresso |
| `ease` | `cubic-bezier(0.2, 0, 0, 1)` | único easing do sistema, sem overshoot |
| `offset.subtle` | 6 px | entrada de card |
| `offset.page` | 8 px | entrada de página e de seção |
| stagger | 40 ms/item, teto em 6 | entrada escalonada |

Regras:

- **Faixa de 120–250 ms.** Nada mais lento; a última animação de uma tela termina em 420 ms.
- **Nenhuma animação bloqueia interação.** Nada recebe `pointer-events: none` durante a entrada.
- **Nenhuma animação desloca o layout.** Elevação de card e entradas usam `transform`, que não
  participa do fluxo; o indicador do item ativo é posicionado em absoluto.
- **Uma única animação contínua** em todo o sistema: a barra de progresso indeterminada, reservada
  a operações cujo total é genuinamente desconhecido. Barra com valor conhecido só anima quando o
  valor muda.
- **Sem animação de saída de página.** Animar a saída exigiria manter a tela antiga montada, o que
  produz piscada, salto de rolagem e duas telas chamando o backend ao mesmo tempo.
- Todo movimento respeita `prefers-reduced-motion` **e** a configuração interna "reduzir
  animações": qualquer uma das duas remove deslocamentos e zera transições. Opacidade e cor
  permanecem, e nenhum estado é comunicado só por movimento.

---

## 2. Estrutura global

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ⬡ eloBoost          Dashboard                     🛡 Normal   🔔   ⚙   ─ □ ✕ │  Header 56px
├───────────┬────────────────────────────────────────────────────────────────────┤
│           │                                                                    │
│ ⌂ Início  │                                                                    │
│ ✧ Limpeza │                       ÁREA PRINCIPAL                               │
│ ⚡ Otimiz. │                    (rolagem própria, max-w 1440)                   │
│ ⏻ Inicial.│                                                                    │
│ ▤ Apps    │                                                                    │
│ ▦ Process.│                                                                    │
│ ◍ Armaz.  │                                                                    │
│ ∿ Monitor │                                                                    │
├───────────┤                                                                    │
│ ↺ Restaur.│                                                                    │
│ ≡ Histór. │                                                                    │
│ ⚙ Config. │                                                                    │
│ ⓘ Sobre   │                                                                    │
│           │                                                                    │
│           │                                                                    │
└───────────┴────────────────────────────────────────────────────────────────────┘
  224px, largura fixa — a navegação é curta o bastante para caber sempre, e um
  segundo estado da barra custaria mais em complexidade do que devolve em espaço.
```

O chip `🛡 Normal` no header mostra o nível de privilégio atual; vira `🛡 Elevado (4:32)` com
contagem regressiva durante uma sessão elevada, com ação "Encerrar agora".

### Responsividade
| Resolução | Comportamento |
|---|---|
| 1280×720 | Sidebar 224px, grid de cards 2 colunas, header compacto |
| 1366×768 | Idem, grid 3 colunas em telas de listagem |
| 1920×1080 | Grid 4 colunas, conteúdo centralizado com `max-w: 1440px` |
| 2K/4K | Mesmo layout; tipografia em `rem` acompanha a escala do Windows |
| Escala 125% / 150% | Testado: nenhuma unidade em `px` fixo para texto; ícones em `em`; alturas mínimas em `rem` |
| Janela mínima | 1024×640 (definida no `tauri.conf.json`); a sidebar mantém os 224px e as tabelas rolam horizontalmente |

---

## 3. Telas

### 3.1 Dashboard

```
Boa tarde, Ana                                       Última limpeza: há 3 dias
DESKTOP-K7M2P1 · Windows 11 Pro 23H2 (build 22631)

┌─ SAÚDE DO SISTEMA ─────────────────────┐ ┌─ AÇÃO ────────────────────────────┐
│                                        │ │                                   │
│           ◐ 78 / 100                   │ │   Nenhuma análise recente.        │
│           Atenção                       │ │                                   │
│                                        │ │   ┌───────────────────────────┐   │
│  ● Espaço livre em C:      12%   ⚠     │ │   │   Analisar computador     │   │
│  ● Apps na inicialização    14   ⚠     │ │   └───────────────────────────┘   │
│  ● Arquivos temporários   6,2 GB ⚠     │ │   Leva ~40s · não altera nada     │
│  ● Ponto de restauração   há 2d  ✓     │ │                                   │
│  ● Uso de recursos        normal ✓     │ │                                   │
│  ○ Atualizações pendentes  n/d          │ │                                   │
│                                        │ │                                   │
│  Como calculamos ▸                     │ │                                   │
└────────────────────────────────────────┘ └───────────────────────────────────┘

┌─ CPU ───────────┐ ┌─ MEMÓRIA ───────┐ ┌─ DISCO C: ──────┐ ┌─ ATIVIDADE ─────┐
│  23%            │ │  9,4 / 16 GB    │ │  418 / 476 GB   │ │  12%            │
│  ▁▂▅▃▂▁▂▄       │ │  ▃▃▄▄▄▅▅▄       │ │  SSD NVMe       │ │  ▁▁▂▁▁▃▁▁       │
│  Ryzen 5 5600X  │ │  59% em uso     │ │  12% livre  ⚠   │ │  leitura/escrita│
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘

┌─ SEU COMPUTADOR ───────────────────────────────────────────────────────────┐
│  Processador   AMD Ryzen 5 5600X · 6 núcleos / 12 threads                  │
│  Placa de vídeo NVIDIA GeForce RTX 3060 · 12 GB · driver 552.22            │
│  Memória       16 GB                                                       │
│  Discos        C: 476 GB SSD NVMe (418 GB usados) · D: 1 TB HDD            │
│  Ligado há     3 dias, 4 horas                                             │
└────────────────────────────────────────────────────────────────────────────┘

┌─ RESUMO ───────────────────────────────────────────────────────────────────┐
│ Temporários 6,2 GB   │ Inicialização 14 apps │ Ajustes ativos 0            │
│ Última limpeza 3d    │ Último ponto 2d       │ Estado: Atenção             │
└────────────────────────────────────────────────────────────────────────────┘
```

Regras: cada fator de saúde exibe **o valor observado**, não só a cor. `○ n/d` é usado quando
um fator não pôde ser avaliado — e ele **sai do cálculo**, sem penalizar. "Como calculamos ▸"
abre um painel com peso e fórmula de cada critério.

**Após "Analisar computador":** o card de ação vira o resultado — espaço liberável, itens
encontrados por categoria, ajustes recomendados, apps de alto impacto na inicialização, alertas e
recomendações, cada um com "Ver" que leva à tela correspondente já filtrada.

### 3.2 Limpeza

```
Limpeza                                   [ Modo simulação (Dry Run) ⓘ  ○ ]

Estado inicial (nada é analisado ao abrir a tela):
┌────────────────────────────────────────────────────────────────────────────┐
│                          ✧                                                 │
│        Selecione o que deseja analisar e clique em Analisar.               │
│        Nenhum arquivo é removido durante a análise.                        │
└────────────────────────────────────────────────────────────────────────────┘

┌ Sistema ─────────────────────────────────────────────────────────────────┐
│ ☑ Arquivos temporários do usuário            Baixo risco     — não analisado│
│   %LOCALAPPDATA%\Temp                                          [detalhes ▸]│
│ ☑ Arquivos temporários do Windows            Baixo · admin   — não analisado│
│ ☑ Miniaturas e cache do Explorador           Baixo           — não analisado│
│ ☑ Relatórios de erro                         Baixo           — não analisado│
│ ☐ Logs antigos do Windows                    Médio · admin   — não analisado│
│ ☐ Arquivos de despejo de memória             Médio · admin   — não analisado│
│   ⚠ Úteis para diagnosticar telas azuis.                                   │
│ ☐ Cache do Windows Update (já liberado)      Médio · admin   — não analisado│
│ ☐ Lixeira                                    Médio           — não analisado│
│   ⚠ Não é possível desfazer.                                               │
├ Navegadores ─────────────────────────────────────────────────────────────┤
│ ☑ Google Chrome · Perfil 1        [cache ☑] [cookies ☐] [histórico ☐]      │
│   ⚠ Aberto agora — escolha ao analisar: cancelar ou ignorar                 │
│ ☑ Microsoft Edge                  [cache ☑] [cookies ☐] [histórico ☐]      │
│   ⚠ Limpar cookies e sessões desconecta você dos sites.                    │
├ Jogos e aplicativos ─────────────────────────────────────────────────────┤
│ ☑ Cache de shaders (DirectX/NVIDIA)          Baixo           — não analisado│
│ ☐ Instaladores antigos órfãos                Médio           — não analisado│
├ Sugestões (nunca selecionadas automaticamente) ──────────────────────────┤
│ ☐ Downloads antigos (> 90 dias)              Alto · manual   — não analisado│
│   ⚠ São seus arquivos. Revise item por item antes de remover.              │
└──────────────────────────────────────────────────────────────────────────┘

                                   [ Analisar selecionados ]
```

Após a análise, cada linha mostra `1.482 arquivos · 3,1 GB` e habilita `[detalhes ▸]` (lista
paginada com caminho, tamanho, data e risco). O botão vira **`Revisar e limpar`**, que abre o
modal de confirmação. Em Dry Run o botão vira `Simular limpeza` e o resultado final é rotulado
`SIMULAÇÃO — nenhum arquivo foi removido`.

### 3.3 Otimizações

```
Otimizações        [Todas][Desempenho][Aparência][Gaming][Privacidade][Rede][Energia]
                                                       Modo avançado ○   Laboratório 🔒

┌──────────────────────────────────────────────────────────────────────────┐
│ Reduzir animações da interface                       ● Baixo risco       │
│ Desativa animações de janelas e menus do Windows.                        │
│ Atual: Ativado          →   Recomendado: Desativado                      │
│ Benefício: interface responde mais rápido em máquinas modestas.          │
│ Efeitos: a interface fica menos suave visualmente.                       │
│ Não exige administrador · Não exige reiniciar · Reversível               │
│ Como funciona ▸                                     [    Aplicar    ]    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Plano de energia de alto desempenho                  ▲ Médio · admin     │
│ Mantém o processador em frequências altas.                               │
│ Atual: Equilibrado      →   Recomendado: Alto desempenho                 │
│ Benefício: menor latência de resposta sob carga.                         │
│ Efeitos: maior consumo de energia; em notebooks, menos bateria e mais    │
│          aquecimento.                                                    │
│ Exige administrador · Não exige reiniciar · Reversível                   │
│ Como funciona ▸                                     [    Aplicar    ]    │
└──────────────────────────────────────────────────────────────────────────┘

┌── Aplicado ──────────────────────────────────────────────────────────────┐
│ ✓ Modo de jogo ativado          aplicado há 2 dias        [ Desfazer ]   │
└──────────────────────────────────────────────────────────────────────────┘
```

A aba **Laboratório** vem desabilitada, com cadeado, e ao ser ativada exige ler um aviso e
marcar "Entendo os riscos". Ajustes vetados (Defender, firewall, Update) simplesmente não
existem em lugar nenhum da tela.

### 3.4 Inicialização

```
Inicialização                    🔍 buscar   [Todos ▾] [Impacto ▾]   ⓘ 14 itens, 9 ativos

  NOME              EDITOR            IMPACTO   ORIGEM        ASSINATURA   STATUS
┌────────────────────────────────────────────────────────────────────────────────┐
│ ▸ Spotify         Spotify AB        ▲ Alto    HKCU\Run      ✓ válida     [ ●  ]│
│ ▸ Discord         Discord Inc.      ▲ Alto    Pasta Startup ✓ válida     [ ●  ]│
│ ▸ Steam           Valve Corp.       ● Médio   HKLM\Run 🛡    ✓ válida     [ ●  ]│
│ ▸ OneDrive        Microsoft         ● Médio   HKCU\Run      ✓ válida     [ ●  ]│
│ ▸ SecurityHealth  Microsoft         ○ Baixo   HKLM\Run      ✓ válida     [🔒 ]│
│   🔒 Componente de segurança do Windows — não pode ser desativado aqui.        │
└────────────────────────────────────────────────────────────────────────────────┘
  Linha expandida (▸): caminho completo, linha de comando, data de instalação,
  ações [Abrir local] [Propriedades]

▾ Serviços e tarefas agendadas (avançado)     🛡 exige administrador      [ mostrar ]
```

### 3.5 Aplicativos instalados

```
Aplicativos            🔍 buscar    [Tamanho ▾] [Todos ▾]      142 apps · 186 GB

┌───────────────────────────────────────────────────────────────────────────┐
│ 🎮  Steam                      Valve       v1.0.0.79   62,4 GB  12/03/2024│
│     C:\Program Files (x86)\Steam                                          │
│                              [Abrir local] [Reparar] [Desinstalar]        │
├───────────────────────────────────────────────────────────────────────────┤
│ 🌐  Google Chrome              Google      v126.0      412 MB   04/01/2025│
│                              [Abrir local]           [Desinstalar]        │
└───────────────────────────────────────────────────────────────────────────┘

ⓘ A desinstalação usa o desinstalador oficial de cada programa.
  O eloBoost nunca apaga a pasta de um aplicativo por conta própria.
```

Filtros: nome, tamanho, data, desenvolvedor, "apps grandes (> 1 GB)", "componentes do sistema
(ocultos por padrão)". Campo "frequência de uso" só aparece quando há fonte confiável.

### 3.6 Processos

```
Processos          🔍 buscar     Atualizar a cada [2s ▾]    ⏸    108 processos

 NOME              PID    CPU↓    MEMÓRIA   DISCO    USUÁRIO     ASSINATURA
┌─────────────────────────────────────────────────────────────────────────┐
│ chrome.exe       8124   12,4%   1,2 GB    0,4 MB/s  Ana        ✓ Google │
│ Discord.exe      4412    6,1%   410 MB    —         Ana        ✓ Discord│
│ MsMpEng.exe      2280    4,0%   280 MB    2,1 MB/s  SYSTEM  🔒 ✓ MS     │
│ dwm.exe          1044    1,8%   120 MB    —         SYSTEM  🔒 ✓ MS     │
└─────────────────────────────────────────────────────────────────────────┘
 Selecionado: chrome.exe (8124)
 [Abrir local] [Propriedades] [Encerrar]  [Encerrar árvore (3 filhos)]

 🔒 = processo protegido. Encerrar pode desestabilizar o Windows.
```

Painel lateral de detalhes: caminho, editor, assinatura, nível de integridade, threads, início,
árvore de filhos.

### 3.7 Armazenamento

```
Armazenamento    [C: SSD 476 GB] [D: HDD 1 TB]     Análise: (•) Rápida ( ) Profunda

┌─ C: ────────────────────────────────────────────────────────────────────┐
│ ████████████████████████████████████░░░░  418 GB usados · 58 GB livres  │
│ ■ Aplicativos 186 GB  ■ Vídeos 92 GB  ■ Sistema 48 GB  ■ Imagens 31 GB  │
│ ■ Documentos 22 GB    ■ Downloads 18 GB ■ Temporários 6 GB ■ Outros 15GB│
└─────────────────────────────────────────────────────────────────────────┘

┌ Maiores pastas ─────────────┐ ┌ Arquivos grandes (> 1 GB) ──────────────┐
│ Steam\steamapps    62,4 GB  │ │ pagefile.sys       16 GB   sistema 🔒   │
│ Users\Ana\Videos   41,2 GB  │ │ backup-2024.zip     8,2 GB  há 412 dias │
│ Windows\WinSxS     11,8 GB🔒│ │ projeto-final.mp4   4,1 GB  há 12 dias  │
└─────────────────────────────┘ └─────────────────────────────────────────┘

┌ Possíveis duplicados (análise profunda) ────────────────────────────────┐
│ Grupo · 3 cópias · 4,1 GB cada · desperdício 8,2 GB                      │
│  (•) D:\Videos\ferias.mp4        modificado 2024-01-02   manter          │
│  ( ) C:\Users\Ana\Downloads\ferias.mp4                   [abrir local]   │
│  ( ) D:\Backup\ferias.mp4                                [abrir local]   │
│  ⚠ Comparados por tamanho e hash SHA-256 do conteúdo, não pelo nome.     │
│  ⚠ Nada é removido automaticamente. Você escolhe o que manter.           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.8 Monitoramento

```
Monitoramento                         Janela: [ 60s ] [ 5 min ] [ 15 min ]

┌ CPU 23%  4,15 GHz ──────────────┐ ┌ Memória 9,4/16 GB ─────────────────┐
│      ╱╲    ╱╲                    │ │  ▁▂▃▄▄▄▅▅▅▄▄▄▃▃▃▄▄▄               │
│   ╱─╯  ╰──╯  ╰──                 │ │  fonte: Win32 GlobalMemoryStatusEx │
│  fonte: PDH \Processor Information│ └────────────────────────────────────┘
└──────────────────────────────────┘
┌ GPU 41% · VRAM 3,2/12 GB ───────┐ ┌ Disco C: leitura 12 MB/s ──────────┐
│  fonte: PDH \GPU Engine          │ │  fonte: PDH \LogicalDisk           │
└──────────────────────────────────┘ └────────────────────────────────────┘
┌ Rede ↓ 8,2 Mb/s ↑ 0,4 Mb/s ─────┐ ┌ Temperaturas ──────────────────────┐
│  fonte: PDH \Network Interface   │ │  Informação não suportada neste    │
└──────────────────────────────────┘ │  dispositivo.                  ⓘ  │
                                     └────────────────────────────────────┘
┌ Maiores consumidores ───────────────────────────────────────────────────┐
│ chrome.exe 12,4% CPU · 1,2 GB │ Discord.exe 6,1% · 410 MB               │
└─────────────────────────────────────────────────────────────────────────┘
```

Cada card declara a **fonte da métrica** (requisito 14). Sensores indisponíveis mostram a frase
padrão, nunca um valor plausível inventado.

### 3.9 Restauração

```
Restauração

┌ Pontos de restauração do Windows ───────────────────── [ Criar ponto 🛡 ] ┐
│ 27/07/2026 14:02  eloBoost — antes de otimizações      Sistema  [Restaurar]│
│ 25/07/2026 09:10  Windows Update                        Sistema  [Restaurar]│
│ ⓘ Restaurar abre a ferramenta oficial do Windows.                          │
└────────────────────────────────────────────────────────────────────────────┘

┌ Backups do eloBoost ──────────────────────────────────────────────────────┐
│ 27/07 14:02  Otimizações (3 alterações)   ✓ válido                         │
│              MenuShowDelay, Modo de jogo, Efeitos visuais                  │
│                            [Ver alterações] [Restaurar] [Exportar] [Excluir]│
│ 26/07 20:41  Sessão de jogo               ✓ restaurado                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.10 Histórico

```
Histórico          [Tudo ▾] [Últimos 30 dias ▾]   🔍            [ Exportar ]

 27/07 14:20  Limpeza          4.812 arquivos · 6,1 GB liberados   ✓  [detalhes]
              ⓘ Remoção de arquivos não pode ser desfeita
 27/07 14:02  Otimização       "Reduzir animações" aplicada        ✓  [desfazer]
 27/07 14:01  Ponto de restaur. "antes de otimizações"             ✓  [detalhes]
 26/07 21:15  Inicialização    Spotify desativado                  ✓  [desfazer]
 26/07 18:30  Limpeza          parcial: 12 arquivos em uso         ⚠  [detalhes]
```

### 3.11 Configurações

Seções: **Geral** (iniciar com o Windows, minimizar para a bandeja, verificar atualizações) ·
**Aparência** (tema, idioma, escala 90–130%, animações, tamanho de fonte) ·
**Segurança** (criar ponto de restauração automaticamente, confirmar antes de limpar, usar
Lixeira para arquivos de risco médio, modo avançado) · **Limpeza** (frequência da limpeza
automática, exclusões de pastas, exclusões de aplicativos) · **Dados** (diretório de logs,
telemetria — **desativada por padrão**, com lista exata do que seria enviado; apagar dados
locais; restaurar padrões).

### 3.12 Sobre
O que o eloBoost é e para quem, seguido dos três princípios do produto — segurança, privacidade e
transparência — cada um com os compromissos concretos que o sustentam. Mais versão, changelog,
licenças de terceiros e links locais para a documentação. A página é escrita para o usuário final:
diagnóstico técnico (banco de dados, schema, caminhos, alvo de compilação) vive no dashboard e nos
logs, não aqui, e os compromissos são afirmações do que o aplicativo faz — não uma lista do que ele
deixa de prometer.

### 3.13 Autenticação (opcional)
Tela existe apenas para a conta Pro futura. **Todas as funções locais funcionam sem conta.**
Nenhum bloqueio, nenhum pop-up recorrente. Um único link discreto em Configurações.

---

## 4. Modais

### 4.1 Confirmação de limpeza
```
┌ Revisar limpeza ───────────────────────────────────────────────┐
│  Serão removidos 4.812 arquivos, liberando cerca de 6,1 GB.    │
│                                                                │
│  Temporários do usuário       3.204 arquivos      3,1 GB       │
│  Cache do Chrome                982 arquivos      1,8 GB       │
│  Miniaturas                     614 arquivos      0,9 GB       │
│  Lixeira                         12 arquivos      0,3 GB  ⚠    │
│                                                                │
│  ⚠ A Lixeira será esvaziada. Isso não pode ser desfeito.       │
│  ⚠ O Chrome está aberto. Ação escolhida: ignorar o Chrome.     │
│                                                                │
│  ☐ Entendi que os itens marcados com ⚠ não podem ser desfeitos │
│                                                                │
│                       [ Cancelar ]  [ Simular ]  [ Limpar ]    │
└────────────────────────────────────────────────────────────────┘
```
`Limpar` só habilita após marcar a caixa (apenas quando há itens irreversíveis).

### 4.2 Progresso
Categoria atual, contador de arquivos, bytes liberados, barra real, `[ Cancelar ]` sempre ativo
(cancelamento seguro entre arquivos).

### 4.3 Análise concluída
Resumo por categoria, espaço liberável, avisos, `[ Ver detalhes ]` / `[ Revisar e limpar ]`.

### 4.4 Permissões administrativas
Ver `docs/06-PERMISSOES-ADMINISTRATIVAS.md` §2 — inclui "o que será feito" e "o que NÃO será
feito".

### 4.5 Criação de ponto de restauração
```
┌ Criar ponto de restauração ────────────────────────────────────┐
│  Descrição: [ eloBoost — antes de otimizações            ]    │
│  Disco: C: · Proteção do Sistema: ativada                      │
│  Espaço reservado: 12 GB de 476 GB                             │
│  ⓘ Pode levar alguns minutos. Exige administrador.             │
│  ⓘ O Windows cria no máximo um ponto a cada 24 h.              │
│                                [ Cancelar ]  [ Criar ponto 🛡 ]│
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Estados obrigatórios de cada tela

| Estado | Tratamento |
|---|---|
| Carregando | Skeleton com a forma do conteúdo real (nunca spinner solto em tela cheia) |
| Vazio | Ilustração leve + explicação + ação sugerida |
| Erro | `ErrorState` com mensagem amigável, sugestão, `diagnosticId` copiável, `[Tentar novamente]` quando `retryable` |
| Parcial | Banner "alguns itens não puderam ser acessados" + link para detalhes |
| Sem permissão | Ação desabilitada com tooltip explicando, em vez de falhar após o clique |
| Não suportado | "Informação não suportada neste dispositivo." com ⓘ explicando por quê |

---

## 6. Acessibilidade (requisito 19)

- Navegação completa por teclado: `Tab` percorre a ordem visual; `Ctrl+1..9` alterna páginas;
  `Esc` fecha modais; `Enter/Space` ativa; setas navegam listas e tabelas.
- Foco visível sempre (`--focus-ring`, 2px, offset 2px) — nunca `outline: none` sem substituto.
- Contraste mínimo 4.5:1 para texto e 3:1 para elementos gráficos; a paleta foi escolhida com
  isso verificado (`--text-secondary` sobre `--bg-surface` = 7.1:1).
- **Risco nunca é indicado só por cor**: sempre acompanha ícone (`○ ● ▲`) e o rótulo textual
  ("Baixo risco", "Médio", "Alto").
- Modais com `role="dialog"`, `aria-modal`, focus trap e retorno de foco ao gatilho.
- Tabelas semânticas (`<table>` real, `<th scope>`), listas em `<ul>`, botões são `<button>`.
- Regiões `aria-live="polite"` para progresso e toasts; `assertive` apenas para erros.
- `prefers-reduced-motion` + toggle interno; com animações reduzidas, transições viram 0ms
  (nenhuma funcionalidade depende de animação).
- Escala de fonte ajustável (90–130%) sem quebra de layout — validada nos testes de responsividade.
- Textos alternativos em todos os ícones informativos; ícones decorativos com `aria-hidden`.
