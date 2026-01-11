import type { FrameName } from '../host/frame-types';
import {
  type GlobalSessionPipelineState,
  type GlobalSessionSnapshot,
  isCompatibleGlobalSessionPipelineState,
  isCompatibleGlobalSessionSnapshot,
} from './global-session';
import type { ActiveSurface } from './ui-state';
import {
  hasOptionalString,
  hasString,
  isRecord,
} from './validation';

export const HOST_EVENT_ENVELOPE_VERSION = 'host-event.v1' as const;
export const HOST_EVENT_ENVELOPE_EVENT = 'HOST_EVENT_ENVELOPE';
export const STYLER_UPDATE_PROP = 'styler.updateProp' as const;

export const COMPATIBLE_HOST_EVENT_ENVELOPE_VERSIONS = new Set<string>([
  HOST_EVENT_ENVELOPE_VERSION,
]);

export type HostEventType =
  | 'ui.setFrame'
  | 'ui.surface'
  | 'selection.set'
  | typeof STYLER_UPDATE_PROP
  | 'session.sync'
  | 'session.state'
  | 'pipeline.state'
  | 'ghost.trigger';

export type HostEventPayloadMap = {
  'ui.setFrame': { frame: FrameName };
  'ui.surface': { surface: ActiveSurface };
  'selection.set': {
    path: string;
    frame?: FrameName;
    rect?: DOMRect;
    hotspotId?: string;
    source?: string;
  };
  [STYLER_UPDATE_PROP]: { path: string; value: unknown; frame?: FrameName };
  'session.sync': { session: GlobalSessionSnapshot };
  'session.state': { session: GlobalSessionSnapshot; origin: 'local' | 'remote' };
  'pipeline.state': { pipeline: GlobalSessionPipelineState | null };
  'ghost.trigger': {
    type: string;
    payload?: unknown;
    path: string;
    rect?: DOMRect;
    hotspotId: string;
    source?: string;
  };
};

export type HostEventEnvelope<T extends HostEventType = HostEventType> = {
  schemaVersion: typeof HOST_EVENT_ENVELOPE_VERSION;
  id: string;
  createdAt: string;
  source: string;
  type: T;
  payload: HostEventPayloadMap[T];
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

const isSessionOrigin = (value: unknown): value is 'local' | 'remote' =>
  value === 'local' || value === 'remote';

const hasHostEventPayload = (
  type: HostEventType,
  payload: unknown
): payload is HostEventPayloadMap[HostEventType] => {
  if (!isRecord(payload)) return false;
  switch (type) {
    case 'ui.setFrame':
      return isFrameName(payload.frame);
    case 'ui.surface':
      return isActiveSurface(payload.surface);
    case 'selection.set':
      return (
        hasString(payload.path) &&
        (typeof payload.frame === 'undefined' || isFrameName(payload.frame))
      );
    case STYLER_UPDATE_PROP:
      return (
        hasString(payload.path) &&
        (typeof payload.frame === 'undefined' || isFrameName(payload.frame))
      );
    case 'session.sync':
      return isCompatibleGlobalSessionSnapshot(payload.session);
    case 'session.state':
      return (
        isCompatibleGlobalSessionSnapshot(payload.session) &&
        isSessionOrigin(payload.origin)
      );
    case 'pipeline.state':
      return (
        payload.pipeline === null ||
        isCompatibleGlobalSessionPipelineState(payload.pipeline)
      );
    case 'ghost.trigger':
      return hasString(payload.type) && hasString(payload.path) && hasString(payload.hotspotId);
    default:
      return false;
  }
};

export const isCompatibleHostEventEnvelope = (
  value?: unknown
): value is HostEventEnvelope => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_HOST_EVENT_ENVELOPE_VERSIONS.has(value.schemaVersion)) return false;
  if (!hasString(value.id)) return false;
  if (!hasString(value.createdAt)) return false;
  if (!hasString(value.source)) return false;
  if (!hasString(value.type)) return false;
  if (!hasHostEventPayload(value.type as HostEventType, value.payload)) return false;
  return true;
};

const createEnvelopeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createHostEventEnvelope = <T extends HostEventType>(
  type: T,
  payload: HostEventPayloadMap[T],
  source = 'nuwa-host'
): HostEventEnvelope<T> => ({
  schemaVersion: HOST_EVENT_ENVELOPE_VERSION,
  id: createEnvelopeId(),
  createdAt: new Date().toISOString(),
  source,
  type,
  payload,
});

export const getHostEventSource = (value?: unknown): string | undefined =>
  hasOptionalString(value) ? value : undefined;
