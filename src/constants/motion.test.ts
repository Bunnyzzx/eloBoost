import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DURATION,
  DURATION_S,
  EASE,
  OFFSET,
  STAGGER_MAX_ITEMS,
  STAGGER_STEP_S,
  staggerDelay,
} from '@/constants/motion';

/** O CSS é a outra metade da fonte de verdade — lido aqui para comparar. */
const themeCss = readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8');

function cssToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(themeCss);
  expect(match, `token --${name} não existe em theme.css`).not.toBeNull();
  return match?.[1]?.trim() ?? '';
}

describe('tokens de movimento', () => {
  it('mantém todas as durações na faixa de 120 a 250 ms', () => {
    for (const [nome, valor] of Object.entries(DURATION)) {
      expect(valor, `${nome} fora da faixa`).toBeGreaterThanOrEqual(120);
      expect(valor, `${nome} fora da faixa`).toBeLessThanOrEqual(250);
    }
  });

  it('converte durações para segundos corretamente', () => {
    expect(DURATION_S.instant).toBeCloseTo(DURATION.instant / 1000);
    expect(DURATION_S.base).toBeCloseTo(DURATION.base / 1000);
    expect(DURATION_S.slow).toBeCloseTo(DURATION.slow / 1000);
  });

  it('não divergem dos tokens CSS — as duas metades da fonte única', () => {
    expect(cssToken('elo-duration-instant')).toBe(`${DURATION.instant}ms`);
    expect(cssToken('elo-duration-base')).toBe(`${DURATION.base}ms`);
    expect(cssToken('elo-duration-slow')).toBe(`${DURATION.slow}ms`);
    expect(cssToken('elo-offset-subtle')).toBe(`${OFFSET.subtle}px`);
    expect(cssToken('elo-offset-page')).toBe(`${OFFSET.page}px`);
    expect(cssToken('elo-ease')).toBe(`cubic-bezier(${EASE.join(', ')})`);
  });

  it('usa deslocamentos discretos — nada de movimento exagerado', () => {
    expect(OFFSET.subtle).toBeLessThanOrEqual(8);
    expect(OFFSET.page).toBeLessThanOrEqual(8);
  });

  it('usa easing sem overshoot', () => {
    // Uma curva com y > 1 passaria do valor final e voltaria (efeito "mola").
    const [, y1, , y2] = EASE;
    expect(y1).toBeLessThanOrEqual(1);
    expect(y2).toBeLessThanOrEqual(1);
  });
});

describe('staggerDelay', () => {
  it('cresce um passo por item', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1)).toBeCloseTo(STAGGER_STEP_S);
    expect(staggerDelay(3)).toBeCloseTo(STAGGER_STEP_S * 3);
  });

  it('tem teto, para que listas longas não pareçam lentas', () => {
    const teto = STAGGER_MAX_ITEMS * STAGGER_STEP_S;
    expect(staggerDelay(STAGGER_MAX_ITEMS)).toBeCloseTo(teto);
    expect(staggerDelay(50)).toBeCloseTo(teto);
    expect(staggerDelay(500)).toBeCloseTo(teto);
  });

  it('mantém a entrada total abaixo de meio segundo', () => {
    const total = staggerDelay(999) + DURATION_S.base;
    expect(total).toBeLessThan(0.5);
  });
});
