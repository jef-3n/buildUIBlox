import { hasOptionalString, hasString, isRecord } from './validation';

export const DESIGN_DRAFT_SCHEMA_VERSION = 'design-draft.v1' as const;

export const COMPATIBLE_DESIGN_DRAFT_SCHEMA_VERSIONS = new Set<string>([
  DESIGN_DRAFT_SCHEMA_VERSION,
]);

export type DesignDraft = {
  draftId: string;
  appId: string;
  updatedAt: string;
  title?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
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
  if (!hasString(value.draftId)) return false;
  if (!hasString(value.appId)) return false;
  if (!hasString(value.updatedAt)) return false;
  if (!hasOptionalString(value.title)) return false;
  if (!hasOptionalString(value.summary)) return false;
  if (typeof value.metadata !== 'undefined' && !isRecord(value.metadata)) return false;
  return true;
};
