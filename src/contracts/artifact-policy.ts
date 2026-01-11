export type ArtifactAccessRole =
  | 'editor'
  | 'compiler'
  | 'preview'
  | 'ghost'
  | 'pipeline'
  | 'runtime';

export type ArtifactResource = 'globalSession' | 'draft' | 'compiled';

export const ARTIFACT_PATHS = {
  globalSession: (appId: string) => `/artifacts/${appId}/public/data/globalSession`,
  draft: (appId: string, draftId: string) => `/artifacts/${appId}/public/data/drafts/${draftId}`,
  compiled: (_appId: string, compiledId: string) => `/compiled/${compiledId}`,
} as const;

export const ARTIFACT_ACCESS_POLICIES: Record<
  ArtifactResource,
  { read: ArtifactAccessRole[]; write: ArtifactAccessRole[] }
> = {
  globalSession: {
    read: ['editor', 'compiler', 'preview', 'ghost', 'pipeline'],
    write: ['editor', 'compiler', 'pipeline'],
  },
  draft: {
    read: ['editor', 'compiler', 'preview'],
    write: ['editor', 'pipeline'],
  },
  compiled: {
    read: ['preview', 'ghost', 'pipeline', 'runtime'],
    write: ['compiler'],
  },
};

export const OFFLINE_POLICY = {
  requiredCache: ['globalSession', 'draft'],
  forbidDirectWrites: true,
  replayStrategy: 'ordered-envelopes',
  onMismatch: 'request-fresh-sync',
} as const;

export const ERROR_POLICY = {
  pipelineErrorState: 'error',
  preserveLastCompiled: true,
  clearRequiresExplicitEvent: true,
} as const;
