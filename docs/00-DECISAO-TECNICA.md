# 00 — Comparação de Stacks e Decisão Técnica

Status: **Entrega 1 — planejamento**. Nenhuma linha de código de produção foi escrita ainda.

---

## 1. Critérios de avaliação

Os critérios foram derivados dos requisitos do produto, com peso maior para aquilo que é
inegociável em um utilitário de manutenção de sistema:

| # | Critério | Peso | Por quê |
|---|----------|------|---------|
| C1 | Consumo de memória e CPU em repouso | Alto | Um otimizador que consome 500 MB de RAM se contradiz. O app fica aberto/monitorando. |
| C2 | Acesso nativo ao Windows (Win32, Registro, WMI/CIM, VSS, PDH) | Alto | Praticamente todo o valor do produto está em APIs nativas. |
| C3 | Segurança e superfície de ataque | Alto | O app manipula arquivos e registro com elevação eventual. |
| C4 | Capacidade de impedir "shell genérico" (requisito 22) | Alto | Requisito explícito: nada de `execute_shell_command(cmd)`. |
| C5 | Qualidade/velocidade de UI premium (dark, animações, gráficos) | Alto | Requisito 18. |
| C6 | Elevação granular (UAC por operação, não sessão inteira) | Alto | Requisito 17. |
| C7 | Tamanho do instalador e experiência de distribuição | Médio | Percepção de qualidade + banda. |
| C8 | Testabilidade (unit + integração + E2E) | Médio | Requisito 28. |
| C9 | Ecossistema/velocidade de desenvolvimento | Médio | Prazo. |
| C10 | Atualização automática assinada + rollback | Médio | Requisito 21. |

---

## 2. Comparação

### 2.1 Tauri 2 + Rust + React/TypeScript

| Aspecto | Avaliação |
|---------|-----------|
| C1 Memória | **Excelente.** ~60–140 MB RSS típico (WebView2 é compartilhado com o SO, não embutido). Instalador 3–12 MB. |
| C2 Nativo | **Excelente.** `windows-rs` expõe o Win32 completo com bindings gerados pela Microsoft: Registro, `IFileOperation`, WMI via COM, PDH (Performance Counters), `SetupAPI`, `WinTrust` (assinatura digital), `SRSetRestorePoint` (pontos de restauração), `DeviceIoControl` (TRIM/SSD), `NtQuerySystemInformation`. Sem P/Invoke manual. |
| C3 Segurança | **Excelente.** Sem runtime Node no processo de UI. CSP restritiva por padrão. Sistema de *capabilities/permissions* do Tauri 2 permite negar explicitamente FS/shell no frontend. Rust elimina classes inteiras de bugs de memória em código que percorre árvores de diretório. |
| C4 Anti-shell | **Excelente.** O único caminho frontend→SO é `#[tauri::command]`. Se não existe comando genérico, ele não existe. Podemos ainda remover totalmente o plugin `shell`. |
| C5 UI | **Excelente.** React + Tailwind + Framer Motion + Recharts rodam idênticos ao web. |
| C6 UAC granular | **Bom (com desenho explícito).** Rust não eleva o próprio processo em runtime; a solução é um *broker* elevado separado (ver §4). Mesmo custo no Electron. |
| C7 Distribuição | **Excelente.** NSIS e MSI nativos no `tauri build`, assinatura via `signtool` no pipeline. Dependência: WebView2 Runtime — já presente em todo Win11 e na maioria dos Win10 atualizados; o instalador NSIS pode embutir o *bootstrapper* oficial. |
| C8 Testes | **Bom.** `cargo test` para a lógica de domínio (excelente), Vitest/RTL no frontend, Playwright limitado (WebView2 exige WebDriver do Edge — funciona, mas é o ponto mais frágil). |
| C9 Ecossistema | **Médio-alto.** Frontend maduro; no lado Rust, algumas coisas exigem escrever a camada COM/Win32 na mão (WMI, WinTrust). |
| C10 Updater | **Excelente.** `tauri-plugin-updater` com verificação de assinatura minisign nativa. |

### 2.2 C# + .NET 8 + WinUI 3 (Windows App SDK)

| Aspecto | Avaliação |
|---------|-----------|
| C1 Memória | **Bom.** ~90–200 MB. Melhor que Electron, pior que Tauri. |
| C2 Nativo | **Excelente (o melhor).** `System.Management` (WMI), `Microsoft.Win32.Registry`, `System.Diagnostics.PerformanceCounter`, `TaskScheduler`, CsWin32 para o resto. Menos código de plumbing que Rust. |
| C3 Segurança | **Bom.** Runtime gerenciado, sem `unsafe` por padrão. Mas a facilidade de `Process.Start("powershell")` historicamente leva o time exatamente ao anti-padrão proibido — é disciplina, não barreira arquitetural. |
| C4 Anti-shell | **Médio.** Não há fronteira física entre "UI" e "SO": tudo é o mesmo processo/assembly. A regra vira convenção de code review. |
| C5 UI | **Médio.** WinUI 3 é capaz, mas o custo de produzir o visual premium descrito (cards, gráficos animados, skeletons, toasts) é significativamente maior: XAML + Composition API, ecossistema de gráficos pobre (LiveCharts2/SkiaSharp), poucas bibliotecas de animação declarativa. |
| C6 UAC granular | **Bom.** Mesma solução de broker elevado, mais fácil de implementar (`ProcessStartInfo.Verb = "runas"` + IPC). |
| C7 Distribuição | **Médio.** Windows App SDK *unpackaged* funciona, mas exige o runtime instalado ou *self-contained* (instalador de ~120–180 MB). MSIX traz virtualização de registro/FS que **atrapalha** um app de manutenção do sistema. |
| C8 Testes | **Bom.** xUnit maduro; UI Automation para E2E. |
| C9 Ecossistema | **Alto** no backend, **baixo** no frontend moderno. |
| C10 Updater | **Médio.** Sem updater oficial de primeira classe fora do MSIX/Store; requer Velopack/Squirrel. |

### 2.3 Electron + React

| Aspecto | Avaliação |
|---------|-----------|
| C1 Memória | **Ruim.** 250–600 MB com Chromium embutido + processo Node. Instalador 90–160 MB. Contradiz a proposta do produto. |
| C2 Nativo | **Médio-ruim.** Node não tem acesso nativo ao Win32; exige (a) *native addons* em C++/node-ffi — trabalhosos e frágeis de compilar/assinar — ou (b) **shell out para PowerShell/WMIC**, que é literalmente o anti-padrão vetado no requisito 22. |
| C3 Segurança | **Médio.** Superfície grande: Chromium + Node + IPC. Exige `contextIsolation`, `sandbox`, `nodeIntegration: false` e disciplina permanente; CVEs de Chromium exigem re-release frequente. |
| C4 Anti-shell | **Ruim.** `child_process` está sempre a uma linha de distância no processo main. |
| C5 UI | **Excelente.** Igual ao Tauri. |
| C6 UAC granular | **Médio.** Normalmente resolvido com `sudo-prompt`/elevate.exe → costuma degenerar em "eleve o app inteiro". |
| C7 Distribuição | **Bom** (electron-builder maduro), mas pesado. |
| C8 Testes | **Excelente.** Playwright tem suporte first-class a Electron. |
| C9 Ecossistema | **Excelente.** |
| C10 Updater | **Excelente.** electron-updater. |

### 2.4 Placar

Escala 0–5, ponderada pelos pesos da §1 (Alto=3, Médio=2).

| Critério | Peso | Tauri | .NET/WinUI | Electron |
|---|---|---|---|---|
| C1 Memória | 3 | 5 | 4 | 1 |
| C2 Nativo | 3 | 5 | 5 | 2 |
| C3 Segurança | 3 | 5 | 4 | 3 |
| C4 Anti-shell | 3 | 5 | 3 | 1 |
| C5 UI premium | 3 | 5 | 3 | 5 |
| C6 UAC granular | 3 | 4 | 4 | 3 |
| C7 Distribuição | 2 | 5 | 3 | 4 |
| C8 Testes | 2 | 4 | 4 | 5 |
| C9 Ecossistema | 2 | 4 | 4 | 5 |
| C10 Updater | 2 | 5 | 3 | 5 |
| **Total ponderado** | | **139** | **112** | **99** |

---

## 3. Decisão

> **Escolhida: Tauri 2 + Rust (`windows-rs`) + React 18 + TypeScript 5 + Vite + Tailwind + Framer Motion + Recharts + SQLite (`rusqlite`) + Zustand + Zod.**

### Justificativa

1. **Coerência com o produto.** Um app de otimização não pode ser o processo mais pesado da
   máquina. Tauri entrega ~1/4 da memória do Electron e um instalador ~10× menor.
2. **O requisito 22 vira arquitetura, não disciplina.** Com Tauri, a fronteira frontend↔SO é
   física: apenas comandos `#[tauri::command]` nomeados e tipados atravessam. Removendo o plugin
   `shell` das *capabilities*, torna-se **impossível** o frontend executar um comando arbitrário —
   é o único stack dos três em que a proibição é estrutural.
3. **Acesso nativo sem intermediários.** `windows-rs` cobre 100% do Win32 necessário
   (Registro, VSS/`SRSetRestorePoint`, WMI via COM, PDH, WinTrust, IFileOperation) sem depender de
   PowerShell — o que também elimina falhas por *Execution Policy*, AMSI e antivírus reagindo a
   scripts.
4. **UI premium sem penalidade.** O requisito 18 pede exatamente o que o ecossistema React
   entrega melhor. WinUI 3 custaria semanas a mais para o mesmo resultado visual.
5. **Rust é a linguagem certa para o núcleo perigoso.** O código que caminha em árvores de
   diretórios, resolve *reparse points* e apaga arquivos se beneficia diretamente de tipos como
   `Result<T, E>` obrigatório, ausência de exceções silenciosas e ownership.

### Custos aceitos conscientemente

| Custo | Mitigação |
|---|---|
| Dependência do WebView2 Runtime | Instalador NSIS embute o bootstrapper oficial da Microsoft; detecta e instala se ausente. Win11 já vem com ele. |
| WMI/WinTrust exigem plumbing COM em Rust | Encapsular em `src-tauri/src/system/wmi.rs` e `security/signature.rs` com testes; usar `wmi` crate onde couber. |
| E2E via Playwright é frágil no WebView2 | Estratégia de teste: Vitest+RTL cobrem componentes/fluxos com backend *mockado* via camada `services/`; Playwright fica para um smoke test opcional. Não bloqueia a entrega. |
| Curva de Rust | Módulos pequenos, `clippy -D warnings`, revisão focada em `unsafe` (isolado apenas em `system/ffi.rs`). |
| Sensores de temperatura/fan | Ver §5 — limitação declarada, não contornada. |

### Quando reconsideraríamos .NET

Se surgirem requisitos de **integração profunda com WinUI/Shell** (extensões de menu de contexto,
serviços Windows persistentes, drivers) ou se a equipe não tiver capacidade de manter Rust. Nesse
cenário o caminho é migrar **apenas o broker elevado** para .NET, mantendo a UI — a arquitetura de
§4 permite isso porque o broker é um processo separado com contrato IPC estável.

---

## 4. Decisão arquitetural associada: o broker elevado

Requisito 17 exige que o app **não rode elevado o tempo todo** e que a elevação seja **por
operação**. No Windows um processo não pode elevar a si mesmo em runtime — o token é fixo na
criação. Portanto:

```
BoostCore.exe            (integridade média, usuário comum)   ← UI + 95% das funções
        │  IPC local: named pipe com ACL restrita ao SID do usuário,
        │  protocolo JSON tipado, mensagens de operação nomeadas (nunca comando livre)
        ▼
BoostCore.Elevator.exe   (integridade alta, disparado via ShellExecute "runas" → UAC)
                          ← binário separado, assinado, com um catálogo FECHADO de operações
```

Regras do Elevator:
- Recebe **apenas** `{ operation: "CreateRestorePoint" | "SetRegistryValue" | ... , params }` de um
  enum fechado. Não existe operação "executar isto".
- Valida novamente **tudo** do lado elevado (nunca confia no chamador, mesmo sendo nós).
- Verifica a assinatura Authenticode do processo chamador antes de aceitar conexões.
- Vive só durante a operação (ou uma janela curta de sessão elevada explicitamente consentida) e
  encerra.
- Cada invocação registra `operation_id` no log de atividades.

**Alternativa avaliada e descartada:** manifest com `requireAdministrator` no app inteiro — viola
o requisito 17 e o princípio do menor privilégio; além disso quebra drag-and-drop e faz o app rodar
elevado durante navegação trivial.

**Ponto que precisa da sua validação:** o Elevator adiciona um segundo binário ao instalador e um
segundo certificado a assinar. É a opção correta em segurança; confirme antes de eu implementar.

---

## 5. Limitações que serão declaradas ao usuário, não contornadas

| Assunto | Situação real | O que o app fará |
|---|---|---|
| Temperatura de CPU/GPU | Requer driver em modo kernel (LibreHardwareMonitor carrega `WinRing0`, que é bloqueado por HVCI/Core Isolation e sinalizado por antivírus) | **Não embarcaremos driver.** Tentaremos `MSAcpi_ThermalZoneTemperature` (WMI) e a API do fabricante da GPU quando disponível; caso contrário exibimos *"Informação não suportada neste dispositivo."* |
| Rotação de ventoinhas | Idem | Mesmo tratamento. |
| Uso de GPU/VRAM | Disponível via contadores de desempenho `GPU Engine`/`GPU Process Memory` (PDH) — funciona no Win10 1709+ | Implementado via PDH, com fallback declarado. |
| "Frequência de uso" de apps instalados | Não há fonte pública confiável e estável | Só exibido se derivável de fonte legítima (ex.: `LastAccessTime` do executável quando a política do volume o mantém); caso contrário o campo simplesmente não aparece. |
| Atualizações pendentes do Windows | API `WUApi` COM disponível, mas consulta pode demorar e exige rede | Consulta opcional, assíncrona, nunca bloqueante, e o critério de saúde a ignora se indisponível. |
| Ganho de FPS | Não é mensurável de forma honesta por um utilitário | O app **nunca** promete FPS. Mostra apenas métricas reais coletadas antes/depois. |
