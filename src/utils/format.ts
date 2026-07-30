/**
 * Formatação de dados para exibição.
 *
 * Regra: o backend sempre entrega bytes e datas ISO-8601; a formatação
 * acontece somente aqui, na borda da interface (docs/03 §convenções).
 */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Formata bytes em unidade legível, base 1024 (a mesma que o Explorador de
 * Arquivos do Windows usa), com precisão adaptativa.
 */
export function formatBytes(bytes: number, fractionDigits?: number): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 0) return '—';
  if (bytes === 0) return '0 B';

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const unit = BYTE_UNITS[exponent] ?? 'B';

  // Sem casas decimais para bytes; uma casa a partir de KB, salvo pedido explícito.
  const digits = fractionDigits ?? (exponent === 0 ? 0 : value >= 100 ? 0 : 1);

  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${unit}`;
}

/** Formata um inteiro com separador de milhar pt-BR. */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Math.trunc(value).toLocaleString('pt-BR');
}

/** Formata percentual (0–100) com uma casa decimal opcional. */
export function formatPercent(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** Formata uma data ISO-8601 como `dd/MM/yyyy HH:mm`. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Formata uma data ISO-8601 como `dd/MM/yyyy`. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Formata uma duração em segundos como `3 dias, 4 h` / `12 min`. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '—';

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) {
    const dayLabel = days === 1 ? 'dia' : 'dias';
    return hours > 0 ? `${days} ${dayLabel}, ${hours} h` : `${days} ${dayLabel}`;
  }
  if (hours > 0) return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  if (minutes > 0) return `${minutes} min`;
  return `${Math.floor(totalSeconds)} s`;
}

/**
 * Formata frequência de processador a partir de MHz.
 *
 * Acima de 1000 MHz usa GHz, que é como o valor aparece na caixa do produto.
 */
export function formatFrequency(megahertz: number): string {
  if (!Number.isFinite(megahertz) || megahertz <= 0) return '—';

  if (megahertz >= 1000) {
    const gigahertz = megahertz / 1000;
    return `${gigahertz.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} GHz`;
  }

  return `${Math.round(megahertz).toLocaleString('pt-BR')} MHz`;
}

/** Tempo relativo curto em pt-BR: "há 3 dias", "agora". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (Math.abs(diffSeconds) < 60) return 'agora';

  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto', style: 'long' });
  const thresholds: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];

  for (const [unit, seconds] of thresholds) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(-Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'agora';
}
