import type { FrameName } from '../host/frame-types';
import {
  type GlobalSessionSnapshot,
  isCompatibleGlobalSessionSnapshot,
} from './global-session';
import {
  hasOptionalString,
  hasString,
  isRecord,
} from './validation';

export const HOST_EVENT_ENVELOPE_VERSION = 'host-event.v1' as const;
export const HOST_EVENT_ENVELOPE_EVENT = 'HOST_EVENT_ENVELOPE';

export const COMPATIBLE_HOST_EVENT_ENVELOPE_VERSIONS = new Set<string>([
  HOST_EVENT_ENVELOPE_VERSION,
]);

export type HostEventType =
  | 'ui.setFrame'
  | 'selection.set'
  | 'artifact.pathEdit'
  | 'session.sync'
  | 'ghost.trigger';

export type HostEventPayloadMap = {
  'ui.setFrame': { frame: FrameName };
  'selection.set': {
    path: string;
    frame?: FrameName;
    rect?: DOMRect;
    hotspotId?: string;
    source?: string;
  };
  'artifact.pathEdit': { path: string; value: unknown; frame?: FrameName };
  'session.sync': { session: GlobalSessionSnapshot };
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

const isFrameName = (value: unknown): value is FrameName =>
  typeof value === 'string' && VALID_FRAMES.includes(value as FrameName);

const hasHostEventPayload = (
  type: HostEventType,
  payload: unknown
): payload is HostEventPayloadMap[HostEventType] => {
  if (!isRecord(payload)) return false;
  switch (type) {
    case 'ui.setFrame':
      return isFrameName(payload.frame);
    case 'selection.set':
      return (
        hasString(payload.path) &&
        (typeof payload.frame === 'undefined' || isFrameName(payload.frame))
      );
    case 'artifact.pathEdit':
      return (
        hasString(payload.path) &&
        (typeof payload.frame === 'undefined' || isFrameName(payload.frame))
      );
    case 'session.sync':
      return isCompatibleGlobalSessionSnapshot(payload.session);
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
