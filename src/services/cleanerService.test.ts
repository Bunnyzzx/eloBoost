import { describe, expect, it } from 'vitest';

import { categoryCleanResultSchema, cleanPreviewSchema } from '@/schemas/cleaner';
import {
  cleanProgressPercent,
  defaultSelection,
  formatCleanDuration,
  headlineForOutcome,
  labelForCleanStatus,
  labelForEligibility,
  selectionTotals,
  toneForCleanStatus,
  toneForHistoryResult,
  toneForOutcome,
} from '@/services/cleanerService';
import {
  CLEAN_OUTCOMES,
  CLEAN_STATUSES,
  isSelectable,
  totalCleanSkips,
  type CategoryPreview,
  type CleanPreview,
} from '@/types/cleaner';

const SEM_IGNORADOS = {
  accessDenied: 0,
  pathTooLong: 0,
  inUse: 0,
  links: 0,
  depthExceeded: 0,
  readErrors: 0,
};

const SEM_RESSALVAS = {
  accessDenied: 0,
  inUse: 0,
  pathTooLong: 0,
  alreadyGone: 0,
  links: 0,
  rejectedByGuard: 0,
  otherFailures: 0,
};

function previa(overrides: Partial<CategoryPreview> = {}): CategoryPreview {
  return {
    category: 'user_temp',
    name: 'Arquivos temporários',
    description: 'Sobras que programas criam.',
    eligibility: 'selectable',
    note: null,
    fileCount: 100,
    folderCount: 5,
    sizeBytes: 1_048_576,
    skipped: { ...SEM_IGNORADOS },
    ...overrides,
  };
}

function previaCompleta(categories: CategoryPreview[]): CleanPreview {
  const selecionaveis = categories.filter(isSelectable);
  return {
    previewId: 'prev-1',
    confirmationToken: 'tok-1',
    categories,
    removableBytes: selecionaveis.reduce((total, item) => total + item.sizeBytes, 0),
    removableFiles: selecionaveis.reduce((total, item) => total + item.fileCount, 0),
    selectableCategories: selecionaveis.length,
    durationMs: 40,
    createdAt: '2026-07-31T10:00:00Z',
  };
}

describe('seleção padrão', () => {
  it('marca todas as áreas selecionáveis', () => {
    const preview = previaCompleta([
      previa(),
      previa({ category: 'logs', name: 'Registros' }),
      previa({ category: 'downloads', name: 'Downloads', eligibility: 'read_only_area' }),
    ]);

    const selecao = defaultSelection(preview);

    expect(selecao.has('user_temp')).toBe(true);
    expect(selecao.has('logs')).toBe(true);
  });

  it('nunca marca uma área pessoal, nem por padrão nem por engano', () => {
    // A trava mais importante da tela: Downloads jamais entra na seleção.
    const preview = previaCompleta([
      previa({ category: 'downloads', name: 'Downloads', eligibility: 'read_only_area' }),
    ]);

    expect(defaultSelection(preview).size).toBe(0);
  });

  it('não marca áreas vazias nem indisponíveis', () => {
    const preview = previaCompleta([
      previa({ category: 'thumbnails', eligibility: 'empty', fileCount: 0, sizeBytes: 0 }),
      previa({ category: 'windows_temp', eligibility: 'unavailable', fileCount: 0, sizeBytes: 0 }),
    ]);

    expect(defaultSelection(preview).size).toBe(0);
  });
});

describe('totais da seleção', () => {
  it('soma apenas o que está marcado e é selecionável', () => {
    const preview = previaCompleta([
      previa({ sizeBytes: 1_000, fileCount: 10 }),
      previa({ category: 'logs', sizeBytes: 2_000, fileCount: 20 }),
      previa({
        category: 'downloads',
        eligibility: 'read_only_area',
        sizeBytes: 9_000,
        fileCount: 90,
      }),
    ]);

    const totais = selectionTotals(preview, new Set(['user_temp', 'downloads']));

    // Downloads foi "marcado", mas não é selecionável: não entra na conta.
    expect(totais.bytes).toBe(1_000);
    expect(totais.files).toBe(10);
    expect(totais.categories).toBe(1);
  });

  it('devolve zero quando nada está marcado', () => {
    const preview = previaCompleta([previa()]);
    const totais = selectionTotals(preview, new Set());

    expect(totais).toEqual({ bytes: 0, files: 0, categories: 0 });
  });
});

describe('rótulos e tons', () => {
  it('cobre todos os estados de limpeza do contrato', () => {
    for (const status of CLEAN_STATUSES) {
      expect(labelForCleanStatus(status).length).toBeGreaterThan(0);
      expect(toneForCleanStatus(status)).toBeTruthy();
    }
  });

  it('cobre todos os desfechos do contrato', () => {
    for (const outcome of CLEAN_OUTCOMES) {
      expect(headlineForOutcome(outcome).length).toBeGreaterThan(0);
      expect(toneForOutcome(outcome)).toBeTruthy();
    }
  });

  it('distingue concluído, parcial e falha pelo tom', () => {
    expect(toneForCleanStatus('completed')).toBe('ok');
    expect(toneForCleanStatus('partially_completed')).toBe('attention');
    expect(toneForCleanStatus('failed')).toBe('critical');
  });

  it('não rotula uma área selecionável — ela não precisa de justificativa', () => {
    expect(labelForEligibility(previa())).toBeNull();
    expect(labelForEligibility(previa({ eligibility: 'read_only_area' }))).toBe('Somente medido');
    expect(labelForEligibility(previa({ eligibility: 'empty' }))).toBe('Já está limpa');
  });

  it('traduz o resultado do histórico em tom', () => {
    expect(toneForHistoryResult('success')).toBe('ok');
    expect(toneForHistoryResult('partial')).toBe('attention');
    expect(toneForHistoryResult('failed')).toBe('critical');
    expect(toneForHistoryResult('cancelled')).toBe('unknown');
  });
});

describe('progresso e duração', () => {
  it('conta áreas concluídas, não bytes', () => {
    expect(cleanProgressPercent(0, 4)).toBe(0);
    expect(cleanProgressPercent(2, 4)).toBe(50);
    expect(cleanProgressPercent(4, 4)).toBe(100);
  });

  it('não divide por zero quando nada foi selecionado', () => {
    expect(cleanProgressPercent(0, 0)).toBe(0);
  });

  it('formata a duração em ms e em s', () => {
    expect(formatCleanDuration(430)).toBe('430 ms');
    expect(formatCleanDuration(2_150)).toBe('2,2 s');
    expect(formatCleanDuration(Number.NaN)).toBe('—');
  });
});

describe('contadores de ressalvas', () => {
  it('soma todos os motivos', () => {
    expect(totalCleanSkips({ ...SEM_RESSALVAS, inUse: 3, accessDenied: 2, links: 1 })).toBe(6);
  });

  it('é zero quando a limpeza saiu limpa', () => {
    expect(totalCleanSkips(SEM_RESSALVAS)).toBe(0);
  });
});

describe('contrato com o backend', () => {
  it('aceita uma prévia no formato do Rust', () => {
    expect(cleanPreviewSchema.safeParse(previaCompleta([previa()])).success).toBe(true);
  });

  it('recusa uma elegibilidade que o backend não produz', () => {
    const invalida = previaCompleta([previa({ eligibility: 'talvez' as never })]);
    expect(cleanPreviewSchema.safeParse(invalida).success).toBe(false);
  });

  it('recusa uma prévia sem token de confirmação', () => {
    // Sem token não existe execução — o schema recusa antes de a tela tentar.
    const invalida = { ...previaCompleta([previa()]), confirmationToken: '' };
    expect(cleanPreviewSchema.safeParse(invalida).success).toBe(false);
  });

  it('recusa um espaço liberado negativo', () => {
    const resultado = {
      category: 'user_temp',
      name: 'Arquivos temporários',
      status: 'completed',
      removedFiles: 1,
      removedFolders: 0,
      freedBytes: -1,
      skipped: SEM_RESSALVAS,
      durationMs: 1,
      message: null,
    };

    expect(categoryCleanResultSchema.safeParse(resultado).success).toBe(false);
  });

  it('o diagnóstico do resultado contém apenas contadores', () => {
    const comCaminho = {
      category: 'user_temp',
      name: 'Arquivos temporários',
      status: 'completed',
      removedFiles: 1,
      removedFolders: 0,
      freedBytes: 10,
      skipped: { ...SEM_RESSALVAS, caminho: 'C:\\Users\\ana\\a.txt' },
      durationMs: 1,
      message: null,
    };

    const parsed = categoryCleanResultSchema.safeParse(comCaminho);
    if (parsed.success) {
      expect(Object.values(parsed.data.skipped).every((v) => typeof v === 'number')).toBe(true);
      expect(parsed.data.skipped).not.toHaveProperty('caminho');
    }
  });
});
