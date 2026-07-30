/**
 * Validadores Zod das informações do sistema.
 *
 * Estes schemas são a única barreira entre o que o Rust serializa e o que a
 * interface renderiza: qualquer divergência de contrato vira `CONTRACT_MISMATCH`
 * com o caminho do campo, em vez de `undefined` propagado até a tela.
 */

import { z } from 'zod';

import { UNAVAILABLE_REASONS } from '@/types/system';

export const unavailableReasonSchema = z.enum(UNAVAILABLE_REASONS);

/**
 * Envolve um schema no formato `Availability<T>`.
 *
 * O `discriminatedUnion` no campo `status` faz o Zod escolher o ramo correto e
 * produzir um erro preciso — em vez de tentar os dois e reclamar dos dois.
 */
export function availabilitySchema<T extends z.ZodTypeAny>(value: T) {
  return z.discriminatedUnion('status', [
    z.object({ status: z.literal('available'), value }),
    z.object({
      status: z.literal('unavailable'),
      reason: unavailableReasonSchema,
      message: z.string(),
    }),
  ]);
}

/** Bytes: inteiro não negativo. Um valor negativo indicaria erro de leitura. */
const bytesSchema = z.number().int().nonnegative();

/** Percentual normalizado pelo backend. */
const percentSchema = z.number().min(0).max(100);

export const osInfoSchema = z.object({
  computerName: availabilitySchema(z.string()),
  userName: availabilitySchema(z.string()),
  name: availabilitySchema(z.string()),
  edition: availabilitySchema(z.string()),
  displayVersion: availabilitySchema(z.string()),
  build: availabilitySchema(z.number().int().nonnegative()),
  architecture: z.string().min(1),
  kernelVersion: availabilitySchema(z.string()),
});

export const cpuInfoSchema = z.object({
  brand: availabilitySchema(z.string()),
  vendor: availabilitySchema(z.string()),
  physicalCores: availabilitySchema(z.number().int().positive()),
  logicalCores: z.number().int().positive(),
  currentFrequencyMhz: availabilitySchema(z.number().int().positive()),
});

export const memoryInfoSchema = z.object({
  totalBytes: bytesSchema,
  usedBytes: bytesSchema,
  availableBytes: bytesSchema,
  usedPercent: percentSchema,
  swapTotalBytes: availabilitySchema(bytesSchema),
  swapUsedBytes: availabilitySchema(bytesSchema),
});

export const gpuInfoSchema = z.object({
  name: z.string().min(1),
  dedicatedMemoryBytes: availabilitySchema(bytesSchema),
  sharedMemoryBytes: availabilitySchema(bytesSchema),
  isSoftware: z.boolean(),
});

export const diskMediaTypeSchema = z.enum(['ssd', 'hdd', 'unknown']);

export const diskInfoSchema = z.object({
  id: z.string().min(1),
  name: availabilitySchema(z.string()),
  mountPoint: z.string().min(1),
  fileSystem: availabilitySchema(z.string()),
  // Um volume exibido no dashboard sempre tem capacidade: o backend filtra os
  // pseudo-sistemas de arquivos antes de responder.
  totalBytes: bytesSchema.positive(),
  usedBytes: bytesSchema,
  availableBytes: bytesSchema,
  usedPercent: percentSchema,
  mediaType: diskMediaTypeSchema,
  isSystem: z.boolean(),
  isRemovable: z.boolean(),
});

export const privilegeInfoSchema = z.object({
  isElevated: availabilitySchema(z.boolean()),
  canElevate: availabilitySchema(z.boolean()),
});

export const systemSnapshotSchema = z.object({
  os: osInfoSchema,
  cpu: cpuInfoSchema,
  memory: memoryInfoSchema,
  gpus: availabilitySchema(z.array(gpuInfoSchema)),
  disks: z.array(diskInfoSchema),
  uptimeSeconds: availabilitySchema(z.number().int().nonnegative()),
  privileges: privilegeInfoSchema,
  collectedAt: z.string().min(1),
  collectionMs: z.number().int().nonnegative(),
});

export const appRuntimeInfoSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  buildProfile: z.string().min(1),
  target: z.string().min(1),
  runningInTauri: z.boolean(),
});
