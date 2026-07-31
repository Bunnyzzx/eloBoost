/**
 * Localiza o Chromium usado pelos scripts de apoio (ícones e capturas).
 *
 * Em máquinas de desenvolvimento normais, o Playwright usa o navegador que ele
 * mesmo baixou — nenhuma configuração é necessária. Alguns ambientes de CI já
 * trazem o Chromium pré-instalado em um caminho fixo, e às vezes numa versão
 * diferente da esperada pela biblioteca; nesse caso, `ELOBOOST_CHROMIUM_PATH`
 * (ou o caminho padrão desses ambientes) evita um download desnecessário.
 */
import { existsSync } from 'node:fs';

import { chromium } from 'playwright';

/** Caminhos verificados, em ordem de precedência. */
const CANDIDATES = [process.env.ELOBOOST_CHROMIUM_PATH, '/opt/pw-browsers/chromium'];

export async function launchChromium(options = {}) {
  const launchOptions = { ...options };
  const preinstalled = CANDIDATES.find((path) => path != null && existsSync(path));

  if (preinstalled != null) {
    launchOptions.executablePath = preinstalled;
  }

  return chromium.launch(launchOptions);
}
