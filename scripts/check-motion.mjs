/**
 * Validação automatizada da camada de animações.
 *
 * Mede, num navegador real, o que testes de unidade não alcançam:
 *   • a navegação continua rápida;
 *   • nenhuma animação desloca o layout (o topo dos cards não se move);
 *   • a barra lateral tem largura fixa e navega corretamente;
 *   • `prefers-reduced-motion` efetivamente remove transições e deslocamentos.
 *
 * Uso:
 *   pnpm build && pnpm preview --port 4173 &
 *   node scripts/check-motion.mjs [urlBase]
 */
import { launchChromium } from './browser.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:4173';

let falhas = 0;
function verificar(descricao, condicao, detalhe = '') {
  const marca = condicao ? '  OK  ' : ' FALHA';
  console.log(`${marca}  ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
}

const browser = await launchChromium();

try {
  // ─────────────────────────────────────────────────────────────
  // 1. Navegação rápida e sem deslocamento de layout
  // ─────────────────────────────────────────────────────────────
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  const inicio = Date.now();
  await page.getByRole('link', { name: 'Sobre' }).click();
  await page.getByRole('heading', { level: 1, name: 'Sobre' }).waitFor();
  const tempoNavegacao = Date.now() - inicio;
  verificar(
    'navegação entre telas conclui rápido',
    tempoNavegacao < 600,
    `${tempoNavegacao} ms até o título aparecer`,
  );

  // O conteúdo precisa estar clicável durante a entrada, não só depois dela.
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  const clicavelDuranteAnimacao = await page
    .getByRole('link', { name: 'Limpeza' })
    .click({ timeout: 250, trial: true })
    .then(() => true)
    .catch(() => false);
  verificar('interação não é bloqueada durante a animação de entrada', clicavelDuranteAnimacao);

  // Estabilidade de layout: a posição final dos cards não muda depois de a
  // animação terminar. Deslocamento por transform não afeta o fluxo.
  await page.goto(`${baseUrl}/sobre`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const posicoesIniciais = await page.$$eval('[class*="rounded-card"]', (nodes) =>
    nodes.slice(0, 4).map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  await page.waitForTimeout(400);
  const posicoesFinais = await page.$$eval('[class*="rounded-card"]', (nodes) =>
    nodes.slice(0, 4).map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  verificar(
    'cards não se deslocam após a entrada escalonada',
    JSON.stringify(posicoesIniciais) === JSON.stringify(posicoesFinais),
    `${JSON.stringify(posicoesIniciais)} → ${JSON.stringify(posicoesFinais)}`,
  );

  // Hover no card interativo não pode empurrar o conteúdo vizinho.
  const antesHover = await page.$$eval('[class*="rounded-card"]', (nodes) =>
    nodes.slice(0, 3).map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  await page.locator('[class*="rounded-card"]').first().hover();
  await page.waitForTimeout(200);
  const durHover = await page.$$eval('[class*="rounded-card"]', (nodes) =>
    nodes.slice(1, 3).map((n) => Math.round(n.getBoundingClientRect().top)),
  );
  verificar(
    'hover em um card não desloca os vizinhos',
    JSON.stringify(antesHover.slice(1)) === JSON.stringify(durHover),
  );

  // ─────────────────────────────────────────────────────────────
  // 2. Barra lateral fixa e funcional
  // ─────────────────────────────────────────────────────────────
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

  const larguraInicial = await page.locator('aside').evaluate((n) => n.clientWidth);

  await page.getByRole('link', { name: 'Histórico' }).click();
  const navegou = await page
    .getByRole('heading', { level: 1, name: 'Histórico' })
    .waitFor({ timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  verificar('navegação pela barra lateral funciona', navegou);

  const larguraDepois = await page.locator('aside').evaluate((n) => n.clientWidth);
  verificar(
    'a barra lateral mantém largura fixa ao trocar de tela',
    larguraInicial === larguraDepois,
    `${larguraInicial}px → ${larguraDepois}px`,
  );

  const semBotaoRecolher = (await page.getByRole('button', { name: /Recolher/i }).count()) === 0;
  verificar('não existe mais controle de recolher a barra lateral', semBotaoRecolher);

  await page.close();

  // ─────────────────────────────────────────────────────────────
  // 3. prefers-reduced-motion
  // ─────────────────────────────────────────────────────────────
  const paginaReduzida = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  await paginaReduzida.goto(`${baseUrl}/sobre`, { waitUntil: 'networkidle' });
  await paginaReduzida.waitForTimeout(300);

  // O último card da página Sobre: se ele está visível sem rolagem nem
  // animação, nada ficou preso esperando um efeito que não vai acontecer.
  const conteudoVisivel = await paginaReduzida
    .getByRole('heading', { name: 'Transparência' })
    .isVisible();
  verificar('com movimento reduzido, todo o conteúdo permanece visível', conteudoVisivel);

  const duracoes = await paginaReduzida.$$eval('[class*="rounded-card"]', (nodes) =>
    nodes.slice(0, 4).map((n) => getComputedStyle(n).transitionDuration),
  );
  const todasZeradas = duracoes.every((d) => d.split(',').every((v) => parseFloat(v) < 0.05));
  verificar(
    'com movimento reduzido, as transições são efetivamente removidas',
    todasZeradas,
    duracoes.join(' | '),
  );

  const semDeslocamento = await paginaReduzida.$$eval('[data-revealed]', (nodes) =>
    nodes.every((n) => n.getAttribute('data-revealed') === 'true'),
  );
  verificar('com movimento reduzido, nada fica escondido esperando a rolagem', semDeslocamento);

  await paginaReduzida.close();
} finally {
  await browser.close();
}

console.log(
  `\n${falhas === 0 ? 'Todas as verificações passaram.' : `${falhas} verificação(ões) falharam.`}`,
);
process.exit(falhas === 0 ? 0 : 1);
