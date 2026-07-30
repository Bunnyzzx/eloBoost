/**
 * Rotas do eloBoost.
 *
 * A ordem deste array define a ordem da barra lateral. `group` separa as
 * seções (ferramentas × registros × sistema) com um divisor visual.
 */

import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  Activity,
  BarChart3,
  Boxes,
  Cpu,
  Gauge,
  History,
  Info,
  ListTree,
  Power,
  RotateCcw,
  Settings,
  Sparkles,
  Zap,
} from 'lucide-react';

export const ROUTES = {
  dashboard: '/',
  cleanup: '/limpeza',
  optimizations: '/otimizacoes',
  startup: '/inicializacao',
  apps: '/aplicativos',
  processes: '/processos',
  storage: '/armazenamento',
  monitoring: '/monitoramento',
  restore: '/restauracao',
  history: '/historico',
  settings: '/configuracoes',
  about: '/sobre',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export type NavGroup = 'tools' | 'records' | 'system';

export interface NavEntry {
  path: RoutePath;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Descrição curta da tela, exibida no cabeçalho e no estado vazio. */
  description: string;
  /** Épico que entrega a funcionalidade real desta tela. */
  plannedIn: string;
}

export const NAV_ENTRIES: readonly NavEntry[] = [
  {
    path: ROUTES.dashboard,
    label: 'Início',
    icon: Gauge,
    group: 'tools',
    description: 'Visão geral do computador e saúde do sistema',
    plannedIn: 'Épico 1 e 5',
  },
  {
    path: ROUTES.cleanup,
    label: 'Limpeza',
    icon: Sparkles,
    group: 'tools',
    description: 'Análise e remoção segura de arquivos temporários',
    plannedIn: 'Épico 3',
  },
  {
    path: ROUTES.optimizations,
    label: 'Otimizações',
    icon: Zap,
    group: 'tools',
    description: 'Ajustes de desempenho reversíveis',
    plannedIn: 'Épico 9',
  },
  {
    path: ROUTES.startup,
    label: 'Inicialização',
    icon: Power,
    group: 'tools',
    description: 'Programas que iniciam com o Windows',
    plannedIn: 'Épico 8',
  },
  {
    path: ROUTES.apps,
    label: 'Aplicativos',
    icon: Boxes,
    group: 'tools',
    description: 'Programas instalados e desinstalação oficial',
    plannedIn: 'Épico 8',
  },
  {
    path: ROUTES.processes,
    label: 'Processos',
    icon: ListTree,
    group: 'tools',
    description: 'Processos em execução e consumo de recursos',
    plannedIn: 'Épico 12',
  },
  {
    path: ROUTES.storage,
    label: 'Armazenamento',
    icon: BarChart3,
    group: 'tools',
    description: 'Uso do disco, pastas grandes e duplicados',
    plannedIn: 'Épico 11',
  },
  {
    path: ROUTES.monitoring,
    label: 'Monitoramento',
    icon: Activity,
    group: 'tools',
    description: 'CPU, memória, disco e rede em tempo real',
    plannedIn: 'Épico 12',
  },
  {
    path: ROUTES.restore,
    label: 'Restauração',
    icon: RotateCcw,
    group: 'records',
    description: 'Pontos de restauração e backups do eloBoost',
    plannedIn: 'Épico 10',
  },
  {
    path: ROUTES.history,
    label: 'Histórico',
    icon: History,
    group: 'records',
    description: 'Tudo o que o eloBoost já fez neste computador',
    plannedIn: 'Épico 4',
  },
  {
    path: ROUTES.settings,
    label: 'Configurações',
    icon: Settings,
    group: 'system',
    description: 'Preferências do aplicativo',
    plannedIn: 'Épico 4',
  },
  {
    path: ROUTES.about,
    label: 'Sobre',
    icon: Info,
    group: 'system',
    description: 'O que é o eloBoost e os compromissos do produto',
    plannedIn: 'Épico 0',
  },
] as const;

/** Ícone usado no cabeçalho quando nenhuma rota corresponde. */
export const FALLBACK_ICON: LucideIcon = Cpu;
export const APP_WINDOW_ICON: LucideIcon = AppWindow;
