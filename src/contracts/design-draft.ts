import { hasOptionalString, hasString, isRecord } from './validation';

export const DESIGN_DRAFT_SCHEMA_VERSION = 'design-draft.v1' as const;

export const COMPATIBLE_DESIGN_DRAFT_SCHEMA_VERSIONS = new Set<string>([
  DESIGN_DRAFT_SCHEMA_VERSION,
]);

export type DesignDraftMetadata = {
  draftId: string;
  appId: string;
  updatedAt: string;
  title?: string;
  summary?: string;
  [key: string]: unknown;
};

export type DesignDraft = {
  rootNodeId: string;
  nodes: Record<string, unknown>;
  frames: Record<string, unknown>;
  assets: Record<string, unknown>;
  metadata: DesignDraftMetadata;
};

export type DesignDraftSnapshot = DesignDraft & {
  schemaVersion: typeof DESIGN_DRAFT_SCHEMA_VERSION;
};

export const isCompatibleDesignDraftSnapshot = (
  value?: unknown
): value is DesignDraftSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_DESIGN_DRAFT_SCHEMA_VERSIONS.has(value.schemaVersion)) return false;
  if (!hasString(value.rootNodeId)) return false;
  if (!isRecord(value.nodes)) return false;
  if (!isRecord(value.frames)) return false;
  if (!isRecord(value.assets)) return false;
  if (!isRecord(value.metadata)) return false;
  if (!hasString(value.metadata.draftId)) return false;
  if (!hasString(value.metadata.appId)) return false;
  if (!hasString(value.metadata.updatedAt)) return false;
  if (!hasOptionalString(value.metadata.title)) return false;
  if (!hasOptionalString(value.metadata.summary)) return false;
  return true;
};
