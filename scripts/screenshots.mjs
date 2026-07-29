/**
 * Captura screenshots da interface do eloBoost servida pelo Vite.
 *
 * Roda contra o build de produção (`pnpm build && pnpm preview`), no navegador
 * — portanto sem o backend Tauri. As telas que dependem do núcleo aparecem
 * com o estado "Somente interface", que é exatamente o comportamento correto
 * fora do aplicativo instalado.
 *
 * Uso: node scripts/screenshots.mjs [urlBase] [pastaDeSaida]
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { launchChromium } from './browser.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:4173';
const outputDir = resolve(process.argv[3] ?? 'screenshots');

/** Telas capturadas e o viewport de cada captura. */
const SHOTS = [
  { name: '01-dashboard', path: '/', width: 1440, height: 900 },
  { name: '02-limpeza', path: '/limpeza', width: 1440, height: 900 },
  { name: '03-sobre', path: '/sobre', width: 1440, height: 1000 },
  { name: '04-otimizacoes', path: '/otimizacoes', width: 1440, height: 900 },
  { name: '05-tema-claro', path: '/', width: 1440, height: 900, theme: 'light' },
  { name: '06-1280x720', path: '/', width: 1280, height: 720 },
  { name: '07-sidebar-recolhida', path: '/', width: 1080, height: 800 },
  { name: '08-monitoramento', path: '/monitoramento', width: 1440, height: 900 },
];

await mkdir(outputDir, { recursive: true });

const browser = await launchChromium();
try {
  for (const shot of SHOTS) {
    const page = await browser.newPage({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 2,
    });

    await page.goto(`${baseUrl}${shot.path}`, { waitUntil: 'networkidle' });

    if (shot.theme === 'light') {
      // Aciona o botão de tema pelo rótulo acessível — o mesmo caminho do usuário.
      await page.getByRole('button', { name: /tema claro/i }).click();
    }

    // Aguarda o fim das animações de entrada.
    await page.waitForTimeout(500);

    const file = resolve(outputDir, `${shot.name}.png`);
    await page.screenshot({ path: file });
    console.log(`Capturado: ${file}`);

    await page.close();
  }
} finally {
  await browser.close();
}
