import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatRelative,
} from '@/utils/format';

describe('formatBytes', () => {
  it('formata zero e valores em bytes sem casas decimais', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
  });

  it('usa base 1024, como o Explorador de Arquivos do Windows', () => {
    expect(formatBytes(1024)).toBe('1,0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1,0 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1,0 GB');
  });

  it('omite casas decimais a partir de 100 na unidade', () => {
    expect(formatBytes(150 * 1024)).toBe('150 KB');
  });

  it('respeita a precisão explícita', () => {
    expect(formatBytes(1536, 2)).toBe('1,50 KB');
  });

  it('devolve traço para valores inválidos em vez de NaN na interface', () => {
    expect(formatBytes(Number.NaN)).toBe('—');
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—');
    expect(formatBytes(-1)).toBe('—');
  });

  it('não estoura a lista de unidades', () => {
    expect(formatBytes(Math.pow(1024, 8))).toContain('PB');
  });
});

describe('formatCount', () => {
  it('usa separador de milhar pt-BR', () => {
    expect(formatCount(4812)).toBe('4.812');
    expect(formatCount(0)).toBe('0');
  });

  it('devolve traço para valores inválidos', () => {
    expect(formatCount(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('formata com e sem casas decimais', () => {
    expect(formatPercent(23)).toBe('23%');
    expect(formatPercent(23.45, 1)).toBe('23,5%');
  });
});

describe('formatDateTime / formatDate', () => {
  it('formata datas ISO no padrão brasileiro', () => {
    const iso = '2026-07-29T14:02:11.412Z';
    expect(formatDate(iso)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(formatDateTime(iso)).toMatch(/^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/);
  });

  it('devolve traço para entrada inválida em vez de "Invalid Date"', () => {
    expect(formatDate('não é data')).toBe('—');
    expect(formatDateTime('')).toBe('—');
  });
});

describe('formatDuration', () => {
  it('formata segundos, minutos, horas e dias', () => {
    expect(formatDuration(45)).toBe('45 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(3900)).toBe('1 h 5 min');
    expect(formatDuration(86_400)).toBe('1 dia');
    expect(formatDuration(273_600)).toBe('3 dias, 4 h');
  });

  it('devolve traço para valores inválidos', () => {
    expect(formatDuration(-5)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-07-29T12:00:00.000Z');

  it('trata diferenças menores que um minuto como "agora"', () => {
    expect(formatRelative('2026-07-29T11:59:30.000Z', now)).toBe('agora');
  });

  it('formata dias atrás', () => {
    expect(formatRelative('2026-07-26T12:00:00.000Z', now)).toContain('3 dias');
  });

  it('devolve traço para entrada inválida', () => {
    expect(formatRelative('xxx', now)).toBe('—');
  });
});
