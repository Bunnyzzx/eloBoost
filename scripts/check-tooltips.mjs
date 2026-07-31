/**
 * Validação automatizada de tudo o que "aparece por cima": tooltips, o diálogo
 * modal e o painel de erro.
 *
 * Testes de unidade provam a aritmética do posicionamento; só um navegador de
 * verdade prova que o balão não é **recortado** por um ancestral com
 * `overflow`, nem encoberto por um vizinho com `z-index` maior. É exatamente
 * esse o defeito que motivou o portal: o tooltip nascia dentro do card, e o
 * `<main>` rolável cortava o que passasse dos seus limites.
 *
 * Para cada gatilho de tooltip de cada tela, verifica:
 *   • o balão inteiro cabe na janela;
 *   • nenhum ancestral rolável recorta qualquer um dos quatro cantos;
 *   • o ponto central do balão pertence ao próprio balão no teste de acerto
 *     (`elementFromPoint`) — ou seja, nada foi desenhado por cima.
 *
 * Uso:
 *   pnpm build && pnpm preview --port 4173 &
 *   node scripts/check-tooltips.mjs [urlBase]
 */
import { launchChromium } from './browser.mjs';
import { RESPOSTAS, STUB } from './demo-backend.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:4173';

let falhas = 0;
function verificar(descricao, condicao, detalhe = '') {
  const marca = condicao ? '  OK  ' : ' FALHA';
  console.log(`${marca}  ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

// ─────────────────────────────────────────────────────────────
// Medições feitas dentro da página
// ─────────────────────────────────────────────────────────────

/**
 * Devolve, para o tooltip aberto: retângulo, se cabe na janela, se algum
 * ancestral rolável o recorta e se o centro dele está no topo da pilha.
 */
const INSPECIONAR = `(() => {
  const balao = document.querySelector('[role="tooltip"]');
  if (balao == null) return { existe: false };

  const r = balao.getBoundingClientRect();

  // Recuo maior que o raio da borda (8px): o teste de acerto respeita o
  // arredondamento, e um ponto a 1px da quina cai FORA do balão — devolvendo
  // o elemento de trás e acusando um encobrimento que não existe.
  const RECUO = 10;
  const cantos = [
    [r.left + RECUO, r.top + RECUO],
    [r.right - RECUO, r.top + RECUO],
    [r.left + RECUO, r.bottom - RECUO],
    [r.right - RECUO, r.bottom - RECUO],
  ];

  const naJanela =
    r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;

  // Recorte: qualquer ancestral com overflow diferente de visible cujo
  // retângulo não contenha o balão inteiro o estaria cortando.
  let recortadoPor = null;
  for (let pai = balao.parentElement; pai != null; pai = pai.parentElement) {
    const estilo = getComputedStyle(pai);
    const corta = [estilo.overflowX, estilo.overflowY].some((v) => v !== 'visible');
    if (!corta) continue;
    const c = pai.getBoundingClientRect();
    if (r.left < c.left || r.right > c.right || r.top < c.top || r.bottom > c.bottom) {
      recortadoPor = pai.tagName.toLowerCase() + '.' + (pai.className || '').slice(0, 40);
      break;
    }
  }

  // Teste de acerto: quem está desenhado no topo em cada canto e no centro do
  // balão? O balão é 'pointer-events: none' para não roubar o hover do
  // gatilho, então o teste precisa reativá-lo por um instante — do contrário
  // 'elementFromPoint' devolveria sempre o que está por baixo, e a verificação
  // não diria nada.
  balao.style.pointerEvents = 'auto';
  const pontos = [...cantos, [r.left + r.width / 2, r.top + r.height / 2]];
  const encobertoPor = pontos
    .map(([x, y]) => document.elementFromPoint(Math.round(x), Math.round(y)))
    .filter((alvo) => alvo == null || !(alvo === balao || balao.contains(alvo)))
    .map((alvo) => (alvo == null ? '(fora da janela)' : alvo.tagName.toLowerCase()))[0];
  // Devolve o controle à classe: a regra do componente é 'pointer-events-none'.
  balao.style.pointerEvents = '';

  const acimaDeTudo = encobertoPor === undefined;

  return {
    existe: true,
    texto: (balao.textContent || '').slice(0, 60),
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    naJanela,
    recortadoPor,
    acimaDeTudo,
    encobertoPor: encobertoPor ?? null,
    zIndex: getComputedStyle(balao).zIndex,
    cantosVisiveis: cantos.every(([x, y]) => x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight),
  };
})()`;

/** Percorre todos os gatilhos de tooltip da tela atual e valida cada um. */
async function validarTelaAtual(page, tela) {
  // O gatilho é o `span.relative.inline-flex` que o componente monta.
  const gatilhos = page.locator('span.relative.inline-flex');
  const total = await gatilhos.count();

  if (total === 0) {
    console.log(`        (${tela}: nenhum tooltip nesta tela)`);
    return 0;
  }

  let validados = 0;
  for (let i = 0; i < total; i += 1) {
    const gatilho = gatilhos.nth(i);
    if (!(await gatilho.isVisible())) continue;

    await gatilho.hover();
    const info = await page.evaluate(INSPECIONAR);
    if (!info.existe) continue; // nem todo span assim é um gatilho de tooltip

    validados += 1;
    const rotulo = `${tela} · "${info.texto.trim()}…"`;
    verificar(
      `${rotulo} cabe inteiro na janela`,
      info.naJanela && info.cantosVisiveis,
      `${Math.round(info.rect.left)},${Math.round(info.rect.top)} ${Math.round(info.rect.width)}×${Math.round(info.rect.height)}`,
    );
    verificar(
      `${rotulo} não é recortado por nenhum ancestral`,
      info.recortadoPor == null,
      info.recortadoPor ?? '',
    );
    verificar(
      `${rotulo} não é encoberto por outro elemento`,
      info.acimaDeTudo,
      info.encobertoPor ?? `z-index ${info.zIndex}`,
    );

    // Solta o ponteiro antes do próximo, para não abrir dois balões.
    await page.mouse.move(2, 2);
  }

  return validados;
}

const browser = await launchChromium();

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(STUB);
  await page.addInitScript(
    (respostas) => {
      window.__ELO_RESPOSTAS__ = Object.fromEntries(
        Object.entries(respostas).map(([nome, valor]) => [nome, () => valor]),
      );
    },
    Object.fromEntries(Object.entries(RESPOSTAS).map(([nome, fn]) => [nome, fn()])),
  );

  // A ficha técnica (com os campos "não disponível") é uma seção do Início.
  const TELAS = [
    ['Início', '/'],
    ['Análise', '/analise'],
    ['Limpeza', '/limpeza'],
    ['Histórico', '/historico'],
    ['Armazenamento', '/armazenamento'],
    ['Sobre', '/sobre'],
  ];

  let totalValidado = 0;

  for (const [nome, caminho] of TELAS) {
    await page.goto(`${baseUrl}${caminho}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // As telas de Análise e Limpeza só mostram cards depois de agir.
    const analisar = page.getByRole('button', { name: /Analisar computador/i });
    if (await analisar.isVisible().catch(() => false)) {
      await analisar.click();
      await page.waitForTimeout(700);
    }

    totalValidado += await validarTelaAtual(page, nome);
  }

  verificar(
    'todas as telas foram percorridas com pelo menos um tooltip',
    totalValidado > 0,
    `${totalValidado} tooltips inspecionados`,
  );

  // ─────────────────────────────────────────────────────────────
  // O caso mais difícil: tooltip dentro do diálogo de confirmação.
  // O diálogo é um portal com z-index próprio; se o balão ficasse abaixo dele,
  // apareceria atrás do véu — visível no DOM e invisível na tela.
  // ─────────────────────────────────────────────────────────────
  await page.goto(`${baseUrl}/limpeza`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const analisar = page.getByRole('button', { name: /Analisar computador/i });
  if (await analisar.isVisible().catch(() => false)) {
    await analisar.click();
    await page.waitForTimeout(800);
  }

  const confirmar = page.getByRole('button', { name: /Limpar selecionadas/i }).first();
  if (await confirmar.isVisible().catch(() => false)) {
    await confirmar.click();
    await page.waitForTimeout(400);
    const dialogoAberto = await page
      .getByRole('dialog')
      .isVisible()
      .catch(() => false);

    if (dialogoAberto) {
      const dentro = page.getByRole('dialog').locator('span.relative.inline-flex');
      const quantos = await dentro.count();
      if (quantos > 0) {
        await dentro.first().hover();
        const info = await page.evaluate(INSPECIONAR);
        verificar(
          'tooltip dentro do diálogo fica acima do véu',
          info.existe && info.acimaDeTudo,
          `z-index ${info?.zIndex}`,
        );
      } else {
        console.log('        (o diálogo de confirmação não tem tooltip próprio)');
      }

      // Independentemente disso, a camada do diálogo precisa estar abaixo da
      // camada do tooltip — é o que a escala de z-index promete.
      const camadas = await page.evaluate(() => {
        const dialogo = document.querySelector('[role="dialog"]')?.parentElement;
        return {
          dialogo: dialogo == null ? null : getComputedStyle(dialogo).zIndex,
          tooltip: getComputedStyle(document.documentElement)
            .getPropertyValue('--elo-z-tooltip')
            .trim(),
          overlay: getComputedStyle(document.documentElement)
            .getPropertyValue('--elo-z-overlay')
            .trim(),
        };
      });
      verificar(
        'a camada do tooltip está acima da camada do diálogo',
        Number(camadas.tooltip) > Number(camadas.overlay),
        `tooltip ${camadas.tooltip} > overlay ${camadas.overlay}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Nenhuma tela pode rolar na horizontal.
  // ─────────────────────────────────────────────────────────────
  for (const [nome, caminho] of TELAS) {
    await page.goto(`${baseUrl}${caminho}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const largura = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      janela: document.documentElement.clientWidth,
      principal: document.querySelector('main')?.scrollWidth ?? 0,
      principalVisivel: document.querySelector('main')?.clientWidth ?? 0,
    }));
    verificar(
      `${nome} não rola na horizontal`,
      largura.documento <= largura.janela && largura.principal <= largura.principalVisivel,
      `${largura.documento}/${largura.janela} · main ${largura.principal}/${largura.principalVisivel}`,
    );
  }

  // Janela estreita: o pior caso para o deslize lateral do balão.
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await validarTelaAtual(page, 'Início @1024');
} finally {
  await browser.close();
}

console.log(
  falhas === 0
    ? '\nTodos os tooltips aparecem por inteiro.'
    : `\n${falhas} verificação(ões) falharam.`,
);
process.exit(falhas === 0 ? 0 : 1);
