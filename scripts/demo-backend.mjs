/**
 * Backend simulado para os scripts de apoio que rodam a interface num
 * navegador comum (validação de tooltips e capturas de tela).
 *
 * O objetivo não é testar o backend — é fazer a interface renderizar os mesmos
 * estados que ela mostra na máquina do usuário, inclusive os campos
 * indisponíveis e os volumes quase cheios, que são justamente os que carregam
 * tooltip.
 */

const disponivel = (value) => ({ status: 'available', value });
const indisponivel = (message = 'Informação não suportada neste dispositivo.') => ({
  status: 'unavailable',
  reason: 'not_supported',
  message,
});

const SEM_IGNORADOS = {
  accessDenied: 0,
  pathTooLong: 0,
  inUse: 0,
  links: 0,
  depthExceeded: 0,
  readErrors: 0,
};

function categoria(category, name, description, extras = {}) {
  return {
    category,
    name,
    description,
    removalPolicy: category === 'downloads' ? 'manual_selection_only' : 'cleanable',
    fileCount: 128,
    folderCount: 4,
    sizeBytes: 512_000_000,
    durationMs: 12,
    status: 'completed',
    message: null,
    skipped: SEM_IGNORADOS,
    ...extras,
  };
}

const CATEGORIAS = [
  categoria('user_temp', 'Temporários do usuário', 'Arquivos que programas deixaram para trás.'),
  categoria('windows_temp', 'Temporários do Windows', 'Área temporária do sistema.'),
  categoria('recycle_bin', 'Lixeira', 'Itens que você já enviou para a lixeira.', {
    status: 'completed_with_warnings',
    skipped: { ...SEM_IGNORADOS, accessDenied: 3 },
  }),
  categoria('thumbnails', 'Miniaturas', 'Cache de miniaturas do Explorador.'),
  categoria('logs', 'Registros temporários', 'Registros de diagnóstico já antigos.', {
    status: 'not_found',
    fileCount: 0,
    folderCount: 0,
    sizeBytes: 0,
  }),
  categoria(
    'browser_cache',
    'Cache dos navegadores',
    'Páginas guardadas por Chrome, Edge e Firefox.',
  ),
  categoria('downloads', 'Downloads', 'São arquivos seus — medidos, nunca removidos em lote.'),
];

export const RESPOSTAS = {
  system_get_snapshot: () => ({
    os: {
      computerName: disponivel('DESKTOP-K7M2P1'),
      userName: disponivel('Ana'),
      name: disponivel('Windows'),
      // Indisponíveis de propósito: é este par que rende os tooltips longos
      // da ficha técnica, os que apareciam cortados pelo card.
      edition: indisponivel(),
      displayVersion: indisponivel(),
      build: indisponivel(),
      architecture: 'x86_64',
      kernelVersion: disponivel('10.0.22631'),
    },
    cpu: {
      brand: disponivel('AMD Ryzen 5 5600X'),
      vendor: disponivel('AuthenticAMD'),
      physicalCores: disponivel(6),
      logicalCores: 12,
      currentFrequencyMhz: disponivel(4150),
    },
    memory: {
      totalBytes: 17_179_869_184,
      usedBytes: 15_492_281_856,
      availableBytes: 1_687_587_328,
      usedPercent: 90.2,
      swapTotalBytes: disponivel(4_294_967_296),
      swapUsedBytes: disponivel(1_073_741_824),
    },
    gpus: indisponivel(),
    disks: [
      {
        id: 'C:',
        name: disponivel('Windows'),
        mountPoint: 'C:',
        fileSystem: disponivel('NTFS'),
        totalBytes: 511_000_000_000,
        usedBytes: 480_000_000_000,
        availableBytes: 31_000_000_000,
        usedPercent: 93.9,
        mediaType: 'ssd',
        isSystem: true,
        isRemovable: false,
      },
    ],
    uptimeSeconds: disponivel(273_600),
    privileges: { isElevated: disponivel(false), canElevate: disponivel(true) },
    collectedAt: new Date().toISOString(),
    collectionMs: 42,
  }),

  app_get_runtime_info: () => ({
    name: 'eloBoost',
    version: '0.1.0',
    buildProfile: 'release',
    target: 'x86_64-pc-windows-msvc',
    runningInTauri: true,
  }),

  app_get_info: () => ({ name: 'eloBoost', version: '0.1.0' }),

  app_get_database_status: () => ({
    schemaVersion: 1,
    expectedVersion: 1,
    appliedMigrations: [{ version: 1, name: 'init', appliedAt: '2026-07-29T12:00:00Z' }],
    databasePathMasked: 'C:\\Users\\%USER%\\%APPDATA%\\eloBoost\\eloboost.db',
    sizeBytes: 131_072,
    healthy: true,
  }),

  scanner_list_categories: () =>
    CATEGORIAS.map(({ category, name, description, removalPolicy }) => ({
      category,
      name,
      description,
      removalPolicy,
    })),

  scanner_scan_all: () => ({
    scanId: 'scan-demo',
    categories: CATEGORIAS,
    reclaimableBytes: 2_048_000_000,
    measuredBytes: 2_560_000_000,
    totalFiles: 768,
    totalFolders: 24,
    durationMs: 86,
    measuredCategories: 6,
    finishedAt: new Date().toISOString(),
  }),

  cleaner_preview: () => ({
    previewId: 'preview-demo',
    confirmationToken: 'token-demo',
    categories: CATEGORIAS.map((c) => ({
      category: c.category,
      name: c.name,
      description: c.description,
      eligibility:
        c.category === 'downloads'
          ? 'read_only_area'
          : c.status === 'not_found'
            ? 'unavailable'
            : 'selectable',
      note: null,
      fileCount: c.fileCount,
      folderCount: c.folderCount,
      sizeBytes: c.sizeBytes,
      skipped: c.skipped,
    })),
    removableBytes: 2_048_000_000,
    removableFiles: 640,
    selectableCategories: 5,
    durationMs: 74,
    createdAt: new Date().toISOString(),
  }),

  history_list_recent: () => [
    {
      id: '1',
      operationId: 'op-1',
      actionType: 'clean',
      message: 'Limpeza de 5 áreas',
      result: 'success',
      affectedCount: 640,
      releasedBytes: 2_048_000_000,
      createdAt: new Date().toISOString(),
      details: '640 arquivos removidos · 3 itens mantidos por acesso negado',
    },
  ],
};

/** Instala o stub antes de qualquer script da página rodar. */
export const STUB = `
window.__TAURI_INTERNALS__ = {
  invoke: (comando) => {
    const resposta = window.__ELO_RESPOSTAS__[comando];
    if (resposta == null) return Promise.reject('comando inesperado: ' + comando);
    return Promise.resolve(resposta());
  },
  transformCallback: (cb) => { const id = Math.random(); window[id] = cb; return id; },
};
`;
