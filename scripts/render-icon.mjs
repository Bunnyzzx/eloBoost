/**
 * Renderiza a marca do eloBoost em PNG 1024×1024, para alimentar o
 * `tauri icon`, que gera o conjunto completo de ícones do instalador.
 *
 * Uso: node scripts/render-icon.mjs [saida.png]
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { launchChromium } from './browser.mjs';

const output = resolve(process.argv[2] ?? 'src-tauri/icons/source.png');
const SIZE = 1024;

/** Marca do eloBoost — mesma geometria de src/components/layout/Logo.tsx. */
const html = `<!doctype html>
<html>
  <head>
    <style>
      html, body { margin: 0; padding: 0; background: transparent; }
      svg { display: block; }
    </style>
  </head>
  <body>
    <svg width="${SIZE}" height="${SIZE}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#5B93FF" />
          <stop offset="100%" stop-color="#8B5CF6" />
        </linearGradient>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#131C32" />
          <stop offset="100%" stop-color="#070B14" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="32" height="32" rx="7" fill="url(#bg)" />
      <path d="M16 4.6 25.6 10.2v11.6L16 27.4 6.4 21.8V10.2Z"
            fill="none" stroke="url(#mark)" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M11.2 19.4l3.5-4 2.6 2.3 3.6-5.2"
            fill="none" stroke="#3D7EFF" stroke-width="1.9"
            stroke-linecap="round" stroke-linejoin="round" />
      <circle cx="20.9" cy="12.5" r="1.6" fill="#3D7EFF" />
    </svg>
  </body>
</html>`;

const browser = await launchChromium();
try {
  const page = await browser.newPage({
    viewport: { width: SIZE, height: SIZE },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: 'load' });

  await mkdir(dirname(output), { recursive: true });
  await page.locator('svg').screenshot({ path: output, omitBackground: true });

  console.log(`Ícone gerado: ${output}`);
} finally {
  await browser.close();
}
