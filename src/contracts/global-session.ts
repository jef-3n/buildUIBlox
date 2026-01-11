import type { FrameName } from '../host/frame-types';
import type { ActiveSurface } from './ui-state';
import {
  hasNumber,
  hasOptionalString,
  hasString,
  isRecord,
} from './validation';

export const GLOBAL_SESSION_SCHEMA_VERSION = 'global-session.v1' as const;

export const COMPATIBLE_GLOBAL_SESSION_SCHEMA_VERSIONS = new Set<string>([
  GLOBAL_SESSION_SCHEMA_VERSION,
]);

export type GlobalPresenceState = {
  sessionId: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
  lastSeenAt: string;
  isLocal: boolean;
};

export type GlobalSessionSnapshot = {
  schemaVersion: typeof GLOBAL_SESSION_SCHEMA_VERSION;
  sessionId: string;
  revision: number;
  updatedAt: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
  presence: Record<string, GlobalPresenceState>;
};

export type GlobalSessionUpdate = {
  schemaVersion: typeof GLOBAL_SESSION_SCHEMA_VERSION;
  sessionId: string;
  revision: number;
  updatedAt: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
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

const isGlobalSessionUpdate = (value: unknown): value is GlobalSessionUpdate => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_GLOBAL_SESSION_SCHEMA_VERSIONS.has(value.schemaVersion)) return false;
  if (!hasString(value.sessionId)) return false;
  if (!hasNumber(value.revision)) return false;
  if (!hasString(value.updatedAt)) return false;
  if (!isFrameName(value.activeFrame)) return false;
  if (!hasOptionalString(value.selectionPath)) return false;
  if (!isActiveSurface(value.activeSurface)) return false;
  return true;
};

export const isCompatibleGlobalSessionUpdate = (
  value?: unknown
): value is GlobalSessionUpdate => isGlobalSessionUpdate(value);

const isGlobalPresenceState = (value: unknown): value is GlobalPresenceState => {
  if (!isRecord(value)) return false;
  if (!hasString(value.sessionId)) return false;
  if (!isFrameName(value.activeFrame)) return false;
  if (!hasOptionalString(value.selectionPath)) return false;
  if (!isActiveSurface(value.activeSurface)) return false;
  if (!hasString(value.lastSeenAt)) return false;
  if (typeof value.isLocal !== 'boolean') return false;
  return true;
};

export const isCompatibleGlobalSessionSnapshot = (
  value?: unknown
): value is GlobalSessionSnapshot => {
  if (!isGlobalSessionUpdate(value)) return false;
  if (!isRecord(value.presence)) return false;
  if (!Object.values(value.presence).every((entry) => isGlobalPresenceState(entry))) {
    return false;
  }
  return true;
};
