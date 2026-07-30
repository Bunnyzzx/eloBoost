/**
 * Serviço de infraestrutura do aplicativo.
 *
 * Expõe os dois comandos implementados no Épico 0: identificação do build e
 * diagnóstico do banco local. Nenhum acesso ao sistema operacional.
 */

import { appInfoSchema, databaseStatusSchema } from '@/schemas';
import { invokeCommand, isTauriAvailable } from '@/services/ipc';
import type { AppInfo, DatabaseStatus } from '@/types/app';

/**
 * Versão exibida quando a interface roda fora do Tauri (navegador, testes).
 * Vem do `package.json` via `define` do Vite — não é um dado inventado sobre
 * o sistema, apenas a identidade do próprio build do frontend.
 */
const WEB_FALLBACK: AppInfo = {
  name: 'eloBoost',
  version: __APP_VERSION__,
  buildProfile: import.meta.env.DEV ? 'debug' : 'release',
  runningInTauri: false,
};

export async function getAppInfo(): Promise<AppInfo> {
  if (!isTauriAvailable()) return WEB_FALLBACK;
  return invokeCommand('app_get_info', appInfoSchema);
}

export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  return invokeCommand('app_get_database_status', databaseStatusSchema);
}
