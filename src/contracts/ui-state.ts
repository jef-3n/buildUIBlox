import type { FrameName } from '../host/frame-types';
import { hasString, isRecord } from './validation';

export type ActiveSurface = 'canvas' | 'frames' | 'metadata' | 'telemetry' | 'unknown';

export type UiState = {
  activeFrame: FrameName;
  activeSurface: ActiveSurface;
};

export const UI_STATE_SCHEMA_VERSION = 'ui-state.v1' as const;

export const COMPATIBLE_UI_STATE_SCHEMA_VERSIONS = new Set<string>([
  UI_STATE_SCHEMA_VERSION,
]);

export type UiStateSnapshot = UiState & {
  schemaVersion: typeof UI_STATE_SCHEMA_VERSION;
};

const VALID_FRAMES: FrameName[] = ['desktop', 'tablet', 'mobile'];
const VALID_SURFACES: ActiveSurface[] = [
  'canvas',
  'frames',
  'metadata',
  'telemetry',
  'unknown',
];

const isFrameName = (value: unknown): value is FrameName =>
  typeof value === 'string' && VALID_FRAMES.includes(value as FrameName);

const isActiveSurface = (value: unknown): value is ActiveSurface =>
  typeof value === 'string' && VALID_SURFACES.includes(value as ActiveSurface);

export const isCompatibleUiStateSnapshot = (
  value?: unknown
): value is UiStateSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_UI_STATE_SCHEMA_VERSIONS.has(value.schemaVersion)) return false;
  if (!isFrameName(value.activeFrame)) return false;
  if (!isActiveSurface(value.activeSurface)) return false;
  return true;
};
