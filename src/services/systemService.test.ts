import { describe, expect, it } from 'vitest';

import {
  mediaTypeLabel,
  primaryGpu,
  privilegeLabel,
  storageTotals,
  systemDisk,
} from '@/services/systemService';
import type { Availability, DiskInfo, GpuInfo } from '@/types/system';

function available<T>(value: T): Availability<T> {
  return { status: 'available', value };
}

function unavailable<T>(): Availability<T> {
  return {
    status: 'unavailable',
    reason: 'not_supported',
    message: 'Informação não suportada neste dispositivo.',
  };
}

function disk(overrides: Partial<DiskInfo> & Pick<DiskInfo, 'id' | 'mountPoint'>): DiskInfo {
  return {
    name: available('Volume'),
    fileSystem: available('NTFS'),
    totalBytes: 1000,
    usedBytes: 400,
    availableBytes: 600,
    usedPercent: 40,
    mediaType: 'ssd',
    isSystem: false,
    isRemovable: false,
    ...overrides,
  };
}

function gpu(name: string, isSoftware: boolean): GpuInfo {
  return {
    name,
    dedicatedMemoryBytes: available(0),
    sharedMemoryBytes: available(0),
    isSoftware,
  };
}

describe('primaryGpu', () => {
  it('prefere um adaptador de hardware ao de software', () => {
    const gpus = available([gpu('Microsoft Basic Render Driver', true), gpu('RTX 3060', false)]);
    expect(primaryGpu(gpus)?.name).toBe('RTX 3060');
  });

  it('devolve o adaptador de software quando é o único', () => {
    const gpus = available([gpu('Microsoft Basic Render Driver', true)]);
    expect(primaryGpu(gpus)?.name).toBe('Microsoft Basic Render Driver');
  });

  it('devolve null quando a GPU está indisponível', () => {
    expect(primaryGpu(unavailable<GpuInfo[]>())).toBeNull();
  });

  it('devolve null para uma lista vazia em vez de estourar', () => {
    expect(primaryGpu(available([]))).toBeNull();
  });
});

describe('systemDisk', () => {
  it('encontra o volume do sistema', () => {
    const disks = [
      disk({ id: 'D:', mountPoint: 'D:' }),
      disk({ id: 'C:', mountPoint: 'C:', isSystem: true }),
    ];
    expect(systemDisk(disks)?.mountPoint).toBe('C:');
  });

  it('cai no primeiro volume quando nenhum é marcado como sistema', () => {
    const disks = [disk({ id: 'E:', mountPoint: 'E:' })];
    expect(systemDisk(disks)?.mountPoint).toBe('E:');
  });

  it('devolve null sem volumes', () => {
    expect(systemDisk([])).toBeNull();
  });
});

describe('storageTotals', () => {
  it('soma capacidade, uso e espaço livre de todos os volumes', () => {
    const totals = storageTotals([
      disk({ id: 'C:', mountPoint: 'C:', totalBytes: 1000, usedBytes: 400, availableBytes: 600 }),
      disk({ id: 'D:', mountPoint: 'D:', totalBytes: 3000, usedBytes: 600, availableBytes: 2400 }),
    ]);

    expect(totals.totalBytes).toBe(4000);
    expect(totals.usedBytes).toBe(1000);
    expect(totals.availableBytes).toBe(3000);
    expect(totals.usedPercent).toBeCloseTo(25);
  });

  it('não divide por zero sem volumes', () => {
    const totals = storageTotals([]);
    expect(totals.totalBytes).toBe(0);
    expect(totals.usedPercent).toBe(0);
  });
});

describe('mediaTypeLabel', () => {
  it('traduz os tipos conhecidos', () => {
    expect(mediaTypeLabel('ssd')).toBe('SSD');
    expect(mediaTypeLabel('hdd')).toBe('HD');
  });

  it('não inventa um tipo quando o backend não determinou', () => {
    // Rotular como "SSD" um controlador que não reporta seria enganoso.
    expect(mediaTypeLabel('unknown')).toBe('Tipo não identificado');
  });
});

describe('privilegeLabel', () => {
  it('descreve o modo normal sem sugerir que elevar seria melhor', () => {
    const result = privilegeLabel(available(false));
    expect(result.label).toBe('Normal');
    expect(result.elevated).toBe(false);
    expect(result.detail).toContain('por operação');
  });

  it('descreve o modo elevado', () => {
    const result = privilegeLabel(available(true));
    expect(result.label).toBe('Administrador');
    expect(result.elevated).toBe(true);
  });

  it('não afirma "não elevado" quando o privilégio não foi medido', () => {
    const result = privilegeLabel(unavailable<boolean>());
    expect(result.label).toBe('Indeterminado');
    expect(result.elevated).toBeNull();
  });
});
