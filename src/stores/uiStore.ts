/**
 * Estado de interface: tema, escala, animações, barra lateral e toasts.
 *
 * Persistência real (SQLite via backend) entra no Épico 4 — por ora o estado
 * vive na sessão e os efeitos são aplicados diretamente no elemento raiz.
 */

import { create } from 'zustand';

export type Theme = 'dark' | 'light';
export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** ID de diagnóstico, exibido e copiável quando o toast reporta um erro. */
  diagnosticId?: string;
  /** Duração em ms; `null` mantém o toast até o usuário fechar. */
  durationMs: number | null;
}

export interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  reduceMotion: boolean;
  /** Escala da interface: 0.9 a 1.3 (docs/08 §6 — fonte ajustável). */
  uiScale: number;
  advancedMode: boolean;
  toasts: Toast[];

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setReduceMotion: (reduce: boolean) => void;
  setUiScale: (scale: number) => void;
  setAdvancedMode: (enabled: boolean) => void;

  pushToast: (toast: Omit<Toast, 'id' | 'durationMs'> & { durationMs?: number | null }) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

export const UI_SCALE_MIN = 0.9;
export const UI_SCALE_MAX = 1.3;

function nextId(): string {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.randomUUID === 'function') return cryptoRef.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, scale));
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'dark',
  sidebarCollapsed: false,
  reduceMotion: false,
  uiScale: 1,
  advancedMode: false,
  toasts: [],

  setTheme: (theme) => set({ theme }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  setUiScale: (scale) => set({ uiScale: clampScale(scale) }),
  setAdvancedMode: (advancedMode) => set({ advancedMode }),

  pushToast: (toast) => {
    const id = nextId();
    // Erros não somem sozinhos: o usuário precisa poder copiar o ID de diagnóstico.
    const defaultDuration = toast.tone === 'error' ? null : 5000;
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id, durationMs: toast.durationMs ?? defaultDuration },
      ],
    }));
    return id;
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clearToasts: () => set({ toasts: [] }),
}));
