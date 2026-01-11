import type { FrameName } from '../host/frame-types';
import { hasOptionalString, hasString, isRecord } from './validation';

export type ActiveSelection = {
  path?: string;
  frame?: FrameName;
};

export const ACTIVE_SELECTION_SCHEMA_VERSION = 'active-selection.v1' as const;

export const COMPATIBLE_ACTIVE_SELECTION_SCHEMA_VERSIONS = new Set<string>([
  ACTIVE_SELECTION_SCHEMA_VERSION,
]);

export type ActiveSelectionSnapshot = ActiveSelection & {
  schemaVersion: typeof ACTIVE_SELECTION_SCHEMA_VERSION;
};

const VALID_FRAMES: FrameName[] = ['desktop', 'tablet', 'mobile'];

const isFrameName = (value: unknown): value is FrameName =>
  typeof value === 'string' && VALID_FRAMES.includes(value as FrameName);

export const isCompatibleActiveSelectionSnapshot = (
  value?: unknown
): value is ActiveSelectionSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_ACTIVE_SELECTION_SCHEMA_VERSIONS.has(value.schemaVersion)) return false;
  if (!hasOptionalString(value.path)) return false;
  if (typeof value.frame !== 'undefined' && !isFrameName(value.frame)) return false;
  return true;
};
