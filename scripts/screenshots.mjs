/**
 * Captura screenshots de todas as telas do eloBoost.
 *
 * Roda contra o build de produção servido pelo `vite preview`, no navegador —
 * portanto sem o backend Tauri. As telas que dependem do núcleo aparecem com o
 * estado "Somente interface", que é o comportamento correto fora do aplicativo
 * instalado, e não um defeito da captura.
 *
 * Uso:
 *   pnpm build && pnpm preview --port 4173 &
 *   node scripts/screenshots.mjs [urlBase] [pastaDeSaida]
 */
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

import { launchChromium } from './browser.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:4173';
const outputDir = resolve(process.argv[3] ?? 'screenshots');

const FULL = { width: 1440, height: 900 };

/** Uma entrada por tela navegável, mais as variantes de tema e resolução. */
const SHOTS = [
  { name: '01-inicio', path: '/', ...FULL },
  { name: '02-limpeza', path: '/limpeza', ...FULL },
  { name: '03-otimizacoes', path: '/otimizacoes', ...FULL },
  { name: '04-inicializacao', path: '/inicializacao', ...FULL },
  { name: '05-aplicativos', path: '/aplicativos', ...FULL },
  { name: '06-processos', path: '/processos', ...FULL },
  { name: '07-armazenamento', path: '/armazenamento', ...FULL },
  { name: '08-monitoramento', path: '/monitoramento', ...FULL },
  { name: '09-restauracao', path: '/restauracao', ...FULL },
  { name: '10-historico', path: '/historico', ...FULL },
  { name: '11-configuracoes', path: '/configuracoes', ...FULL },
  { name: '12-sobre', path: '/sobre', width: 1440, height: 1080 },

  // Variantes: tema, resoluções mínimas e barra lateral recolhida.
  { name: '13-tema-claro', path: '/', ...FULL, theme: 'light' },
  { name: '14-sobre-tema-claro', path: '/sobre', width: 1440, height: 1080, theme: 'light' },
  { name: '15-1280x720', path: '/', width: 1280, height: 720 },
  { name: '16-1366x768', path: '/limpeza', width: 1366, height: 768 },
  { name: '17-1920x1080', path: '/', width: 1920, height: 1080 },
  { name: '18-sidebar-recolhida', path: '/', width: 1080, height: 800 },
];

await mkdir(outputDir, { recursive: true });

// Remove capturas antigas para que uma tela renomeada não deixe arquivo órfão.
for (const file of await readdir(outputDir)) {
  if (file.endsWith('.png')) await unlink(resolve(outputDir, file));
}

const browser = await launchChromium();
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
    });

    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });

    if (shot.theme === 'light') {
      // Aciona o botão pelo rótulo acessível — o mesmo caminho do usuário.
      await page.getByRole('button', { name: /tema claro/i }).click();
    }

    // Aguarda o fim das animações de entrada.
    await page.waitForTimeout(500);

    const file = resolve(outputDir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    console.log(`Capturado: ${shot.name}.png`);

    await page.close();
  }
  console.log(`\n${SHOTS.length} capturas em ${outputDir}`);
} finally {
  await browser.close();
}
