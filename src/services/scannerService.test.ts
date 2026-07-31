import { describe, expect, it } from 'vitest';

import { categoryScanSchema, scanSummarySchema } from '@/schemas/scanner';
import {
  detailForScan,
  formatScanDuration,
  isPersonalArea,
  labelForStatus,
  scanProgress,
  skippedCount,
  toneForStatus,
} from '@/services/scannerService';
import { SCAN_STATUSES, type CategoryScan, hasMeasurement } from '@/types/scanner';

const SEM_IGNORADOS = {
  accessDenied: 0,
  pathTooLong: 0,
  inUse: 0,
  links: 0,
  depthExceeded: 0,
  readErrors: 0,
};

function categoria(overrides: Partial<CategoryScan> = {}): CategoryScan {
  return {
    category: 'user_temp',
    name: 'Arquivos temporários',
    description: 'Sobras que programas criam enquanto funcionam.',
    removalPolicy: 'cleanable',
    fileCount: 120,
    folderCount: 8,
    sizeBytes: 1_048_576,
    durationMs: 42,
    status: 'completed',
    message: null,
    skipped: { ...SEM_IGNORADOS },
    ...overrides,
  };
}

describe('toneForStatus', () => {
  it('trata uma área ausente como neutra, não como problema', () => {
    // Não ter cache do Firefox não é algo que o usuário precise resolver.
    expect(toneForStatus('not_found')).toBe('unknown');
    expect(toneForStatus('not_supported')).toBe('unknown');
  });

  it('distingue análise completa, parcial e falha', () => {
    expect(toneForStatus('completed')).toBe('ok');
    expect(toneForStatus('completed_with_warnings')).toBe('attention');
    expect(toneForStatus('failed')).toBe('critical');
  });

  it('cobre todos os status do contrato', () => {
    for (const status of SCAN_STATUSES) {
      expect(toneForStatus(status)).toBeTruthy();
      expect(labelForStatus(status).length).toBeGreaterThan(0);
    }
  });
});

describe('detailForScan', () => {
  it('prefere a explicação vinda do backend', () => {
    const scan = categoria({
      status: 'completed_with_warnings',
      message: 'Analisada com 3 itens sem permissão de leitura.',
    });
    expect(detailForScan(scan)).toContain('permissão');
  });

  it('avisa quando a área existe e está vazia', () => {
    expect(detailForScan(categoria({ fileCount: 0, sizeBytes: 0 }))).toBe(
      'Nada encontrado nesta área.',
    );
  });

  it('não inventa texto para uma análise limpa e com conteúdo', () => {
    expect(detailForScan(categoria())).toBeNull();
  });
});

describe('áreas pessoais', () => {
  it('reconhece a política de seleção manual', () => {
    const downloads = categoria({ category: 'downloads', removalPolicy: 'manual_selection_only' });

    expect(isPersonalArea(downloads)).toBe(true);
    expect(isPersonalArea(categoria())).toBe(false);
  });
});

describe('skippedCount', () => {
  it('soma todos os motivos', () => {
    const scan = categoria({
      skipped: { ...SEM_IGNORADOS, accessDenied: 4, inUse: 2, links: 1 },
    });
    expect(skippedCount(scan)).toBe(7);
  });

  it('é zero quando nada foi ignorado', () => {
    expect(skippedCount(categoria())).toBe(0);
  });
});

describe('scanProgress', () => {
  it('conta categorias concluídas, não bytes', () => {
    expect(scanProgress(0, 7)).toBe(0);
    expect(scanProgress(7, 7)).toBe(100);
    expect(scanProgress(3, 7)).toBe(43);
  });

  it('não divide por zero antes de a lista chegar', () => {
    expect(scanProgress(0, 0)).toBe(0);
  });

  it('nunca ultrapassa 100', () => {
    expect(scanProgress(9, 7)).toBe(100);
  });
});

describe('formatScanDuration', () => {
  it('usa milissegundos abaixo de um segundo', () => {
    expect(formatScanDuration(820)).toBe('820 ms');
  });

  it('usa segundos com uma casa acima disso', () => {
    expect(formatScanDuration(1_430)).toBe('1,4 s');
  });

  it('não formata um valor inválido', () => {
    expect(formatScanDuration(Number.NaN)).toBe('—');
    expect(formatScanDuration(-1)).toBe('—');
  });
});

describe('contrato com o backend', () => {
  it('aceita um resultado de categoria no formato do Rust', () => {
    const bruto = {
      category: 'recycle_bin',
      name: 'Lixeira',
      description: 'O que você já apagou e ainda ocupa espaço no disco.',
      removalPolicy: 'cleanable',
      fileCount: 12,
      folderCount: 0,
      sizeBytes: 40_960,
      durationMs: 3,
      status: 'completed',
      message: null,
      skipped: SEM_IGNORADOS,
    };

    expect(categoryScanSchema.safeParse(bruto).success).toBe(true);
  });

  it('recusa um status que o backend não produz', () => {
    const invalido = { ...categoria(), status: 'quase_pronto' };
    expect(categoryScanSchema.safeParse(invalido).success).toBe(false);
  });

  it('recusa um tamanho negativo', () => {
    const invalido = { ...categoria(), sizeBytes: -1 };
    expect(categoryScanSchema.safeParse(invalido).success).toBe(false);
  });

  it('valida o resumo completo', () => {
    const resumo = {
      scanId: '0192-abc',
      categories: [categoria()],
      reclaimableBytes: 1_048_576,
      measuredBytes: 1_048_576,
      totalFiles: 120,
      totalFolders: 8,
      durationMs: 55,
      measuredCategories: 1,
      finishedAt: '2026-07-30T17:00:00Z',
    };

    expect(scanSummarySchema.safeParse(resumo).success).toBe(true);
  });

  it('o diagnóstico do backend contém apenas contadores', () => {
    // Trava de privacidade espelhando a do Rust: se um campo de caminho
    // aparecesse no evento, o schema o rejeitaria como desconhecido.
    const comCaminho = {
      ...categoria(),
      skipped: { ...SEM_IGNORADOS, caminho: 'C:\\Users\\ana\\segredo.txt' },
    };

    const parsed = categoryScanSchema.safeParse(comCaminho);
    if (parsed.success) {
      expect(Object.values(parsed.data.skipped).every((v) => typeof v === 'number')).toBe(true);
      expect(parsed.data.skipped).not.toHaveProperty('caminho');
    }
  });
});

describe('hasMeasurement', () => {
  it('só considera medida uma análise que percorreu a área', () => {
    expect(hasMeasurement('completed')).toBe(true);
    expect(hasMeasurement('completed_with_warnings')).toBe(true);
    expect(hasMeasurement('not_found')).toBe(false);
    expect(hasMeasurement('not_supported')).toBe(false);
    expect(hasMeasurement('failed')).toBe(false);
  });
});
