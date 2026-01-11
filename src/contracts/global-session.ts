import type { FrameName } from '../host/frame-types';
import type { ActiveSurface, UiDrawersState } from './ui-state';
import {
  hasNumber,
  hasOptionalBoolean,
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
  scale: number;
  drawers: UiDrawersState;
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
  scale: number;
  drawers: UiDrawersState;
  presence: Record<string, GlobalPresenceState>;
  draftId?: string;
  compiledId?: string;
  compiled?: GlobalSessionCompiledShadow;
  pipeline?: GlobalSessionPipelineState;
  draftLock?: GlobalSessionDraftLock;
};

export type GlobalSessionUpdate = {
  schemaVersion: typeof GLOBAL_SESSION_SCHEMA_VERSION;
  sessionId: string;
  revision: number;
  updatedAt: string;
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
  scale: number;
  drawers: UiDrawersState;
  draftId?: string;
  compiledId?: string;
  compiled?: GlobalSessionCompiledShadow;
  pipeline?: GlobalSessionPipelineState;
  draftLock?: GlobalSessionDraftLock;
};

export type GlobalSessionPipelineStatus = 'idle' | 'compiling' | 'error' | 'success';

export type GlobalSessionPipelineState = {
  status: GlobalSessionPipelineStatus;
  triggeredAt?: string;
  abortedAt?: string;
  publishedAt?: string;
  draftId?: string;
  compiledId?: string;
  error?: GlobalSessionPipelineError;
};

export type GlobalSessionPipelineError = {
  code: string;
  message: string;
};

export type GlobalSessionDraftLock = {
  locked: boolean;
  draftId?: string;
  lockedAt?: string;
  releasedAt?: string;
};

export type GlobalSessionCompiledShadow = {
  compiledId: string;
  draftId: string;
  publishedAt?: string;
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

const isUiDrawerState = (value: unknown): value is UiDrawersState => {
  if (!isRecord(value)) return false;
  return (
    hasDrawerState(value.top) &&
    hasDrawerState(value.left) &&
    hasDrawerState(value.right) &&
    hasDrawerState(value.bottom)
  );
};

const hasDrawerState = (value: unknown) => {
  if (!isRecord(value)) return false;
  if (typeof value.open !== 'boolean') return false;
  if (!hasNumber(value.size)) return false;
  return true;
};

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
  if (!hasNumber(value.scale)) return false;
  if (!isUiDrawerState(value.drawers)) return false;
  if (!hasOptionalString(value.draftId)) return false;
  if (!hasOptionalString(value.compiledId)) return false;
  if (!isOptionalPipelineState(value.pipeline)) return false;
  if (!isOptionalDraftLock(value.draftLock)) return false;
  if (!isOptionalCompiledShadow(value.compiled)) return false;
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
  if (!hasNumber(value.scale)) return false;
  if (!isUiDrawerState(value.drawers)) return false;
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

const isPipelineStatus = (value: unknown): value is GlobalSessionPipelineStatus =>
  typeof value === 'string' &&
  (value === 'idle' || value === 'compiling' || value === 'error' || value === 'success');

const isPipelineError = (value: unknown): value is GlobalSessionPipelineError => {
  if (!isRecord(value)) return false;
  if (!hasString(value.code)) return false;
  if (!hasString(value.message)) return false;
  return true;
};

const isPipelineState = (value: unknown): value is GlobalSessionPipelineState => {
  if (!isRecord(value)) return false;
  if (!isPipelineStatus(value.status)) return false;
  if (!hasOptionalString(value.triggeredAt)) return false;
  if (!hasOptionalString(value.abortedAt)) return false;
  if (!hasOptionalString(value.publishedAt)) return false;
  if (!hasOptionalString(value.draftId)) return false;
  if (!hasOptionalString(value.compiledId)) return false;
  if (typeof value.error !== 'undefined' && !isPipelineError(value.error)) return false;
  return true;
};

const isOptionalPipelineState = (
  value: unknown
): value is GlobalSessionPipelineState | undefined =>
  typeof value === 'undefined' || isPipelineState(value);

const isDraftLock = (value: unknown): value is GlobalSessionDraftLock => {
  if (!isRecord(value)) return false;
  if (!hasOptionalBoolean(value.locked)) return false;
  if (typeof value.locked === 'undefined') return false;
  if (!hasOptionalString(value.draftId)) return false;
  if (!hasOptionalString(value.lockedAt)) return false;
  if (!hasOptionalString(value.releasedAt)) return false;
  return true;
};

const isOptionalDraftLock = (
  value: unknown
): value is GlobalSessionDraftLock | undefined =>
  typeof value === 'undefined' || isDraftLock(value);

const isCompiledShadow = (value: unknown): value is GlobalSessionCompiledShadow => {
  if (!isRecord(value)) return false;
  if (!hasString(value.compiledId)) return false;
  if (!hasString(value.draftId)) return false;
  if (!hasOptionalString(value.publishedAt)) return false;
  return true;
};

const isOptionalCompiledShadow = (
  value: unknown
): value is GlobalSessionCompiledShadow | undefined =>
  typeof value === 'undefined' || isCompiledShadow(value);

export const isCompatibleGlobalSessionPipelineState = (
  value?: unknown
): value is GlobalSessionPipelineState => isPipelineState(value);

export const isCompatibleGlobalSessionDraftLock = (
  value?: unknown
): value is GlobalSessionDraftLock => isDraftLock(value);

export const isCompatibleGlobalSessionCompiledShadow = (
  value?: unknown
): value is GlobalSessionCompiledShadow => isCompiledShadow(value);
