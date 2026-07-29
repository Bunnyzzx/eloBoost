/**
 * Localiza o Chromium disponível no ambiente.
 *
 * Em ambientes onde o navegador do Playwright já vem pré-instalado (como o
 * runner de CI), a versão empacotada pode não corresponder à esperada pela
 * biblioteca. Nesse caso usamos o executável pré-instalado em vez de baixar
 * outro.
 */
import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

const PREINSTALLED = '/opt/pw-browsers/chromium';

export async function launchChromium(options = {}) {
  const launchOptions = { ...options };

  if (existsSync(PREINSTALLED)) {
    launchOptions.executablePath = PREINSTALLED;
  }

  return chromium.launch(launchOptions);
}
