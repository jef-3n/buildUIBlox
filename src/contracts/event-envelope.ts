import type { FrameName } from '../host/frame-types';
import {
  type GlobalSessionPipelineState,
  type GlobalSessionSnapshot,
  isCompatibleGlobalSessionPipelineState,
  isCompatibleGlobalSessionSnapshot,
} from './global-session';
import type { ActiveSurface } from './ui-state';
import {
  hasNumber,
  hasOptionalString,
  hasString,
  isRecord,
} from './validation';

export const HOST_EVENT_ENVELOPE_VERSION = 'host-event.v1' as const;
export const HOST_EVENT_ENVELOPE_EVENT = 'HOST_EVENT_ENVELOPE';
export const STYLER_UPDATE_PROP = 'styler.updateProp' as const;
export const BINDING_UPDATE_PROP = 'binding.updateProp' as const;
export const UI_SET_SCALE = 'ui.setScale' as const;
export const UI_DRAWER_OPEN = 'ui.drawer.open' as const;
export const UI_DRAWER_CLOSE = 'ui.drawer.close' as const;
export const UI_TOGGLE_DRAWER = 'ui.drawer.toggle' as const;
export const UI_RESET_LAYOUT = 'ui.layout.reset' as const;
export const UI_FOCUS_SURFACE = 'ui.surface.focus' as const;
export const WAREHOUSE_ADD_INTENT = 'warehouse.addIntent' as const;
export const WAREHOUSE_MOVE_INTENT = 'warehouse.moveIntent' as const;
export const PIPELINE_TRIGGER_BUILD = 'PIPELINE_TRIGGER_BUILD' as const;
export const PIPELINE_ABORT_BUILD = 'PIPELINE_ABORT_BUILD' as const;
export const PIPELINE_PUBLISH_VERSION = 'PIPELINE_PUBLISH_VERSION' as const;
export const GHOST_MAP_EDIT = 'ghostMap.edit' as const;
export const GHOST_RESIZE_FRAME = 'ghostMap.resizeFrame' as const;
export const BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY =
  'builderUi.bootstrap.toggleRegistry' as const;
export const BUILDER_UI_BOOTSTRAP_PUBLISH = 'builderUi.bootstrap.publish' as const;
export const BUILDER_UI_BOOTSTRAP_ROLLBACK = 'builderUi.bootstrap.rollback' as const;
export const BUILDER_UI_BOOTSTRAP_VERSION_PIN = 'builderUi.bootstrap.versionPin' as const;

export const COMPATIBLE_HOST_EVENT_ENVELOPE_VERSIONS = new Set<string>([
  HOST_EVENT_ENVELOPE_VERSION,
]);

export type HostEventType =
  | 'ui.setFrame'
  | 'ui.surface'
  | 'selection.set'
  | typeof UI_SET_SCALE
  | typeof UI_DRAWER_OPEN
  | typeof UI_DRAWER_CLOSE
  | typeof UI_TOGGLE_DRAWER
  | typeof UI_RESET_LAYOUT
  | typeof UI_FOCUS_SURFACE
  | typeof STYLER_UPDATE_PROP
  | typeof BINDING_UPDATE_PROP
  | 'session.sync'
  | 'session.state'
  | 'pipeline.state'
  | typeof PIPELINE_TRIGGER_BUILD
  | typeof PIPELINE_ABORT_BUILD
  | typeof PIPELINE_PUBLISH_VERSION
  | typeof GHOST_MAP_EDIT
  | typeof GHOST_RESIZE_FRAME
  | 'ghost.trigger'
  | typeof WAREHOUSE_ADD_INTENT
  | typeof WAREHOUSE_MOVE_INTENT
  | typeof BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY
  | typeof BUILDER_UI_BOOTSTRAP_PUBLISH
  | typeof BUILDER_UI_BOOTSTRAP_ROLLBACK
  | typeof BUILDER_UI_BOOTSTRAP_VERSION_PIN;

type BuilderUiRegistryKey = 'local' | 'remote';

export type GhostEmitterPayload =
  | string
  | {
      type: string;
      payload?: unknown;
    };

export type GhostHotspotPayload = {
  id: string;
  rect: DOMRect;
  path?: string;
  frame?: FrameName;
  emitter?: GhostEmitterPayload;
  payload?: unknown;
};

export type GhostHotspotEditAction = 'draw' | 'resize' | 'update';

export type GhostHotspotEditPayload = {
  action: GhostHotspotEditAction;
  hotspot: GhostHotspotPayload;
};

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
  [UI_SET_SCALE]: { scale: number };
  [UI_DRAWER_OPEN]: { drawer: 'top' | 'left' | 'right' | 'bottom'; size?: number };
  [UI_DRAWER_CLOSE]: { drawer: 'top' | 'left' | 'right' | 'bottom' };
  [UI_TOGGLE_DRAWER]: { drawer: 'top' | 'left' | 'right' | 'bottom'; size?: number };
  [UI_RESET_LAYOUT]: Record<string, never>;
  [UI_FOCUS_SURFACE]: { surface: ActiveSurface };
  [STYLER_UPDATE_PROP]: { path: string; value: unknown; frame?: FrameName };
  [BINDING_UPDATE_PROP]: { path: string; value: unknown };
  'session.sync': { session: GlobalSessionSnapshot };
  'session.state': { session: GlobalSessionSnapshot; origin: 'local' | 'remote' };
  'pipeline.state': { pipeline: GlobalSessionPipelineState | null };
  [PIPELINE_TRIGGER_BUILD]: { draftId: string };
  [PIPELINE_ABORT_BUILD]: { reason?: string };
  [PIPELINE_PUBLISH_VERSION]: {
    tag: string;
    notes?: string;
    compiledId?: string;
    draftId?: string;
  };
  [GHOST_MAP_EDIT]: GhostHotspotEditPayload;
  [GHOST_RESIZE_FRAME]: GhostHotspotEditPayload;
  'ghost.trigger': {
    type: string;
    payload?: unknown;
    path: string;
    rect?: DOMRect;
    hotspotId: string;
    source?: string;
  };
  [WAREHOUSE_ADD_INTENT]: {
    itemId: string;
    label: string;
    kind: 'primitive' | 'template';
    target?: string;
  };
  [WAREHOUSE_MOVE_INTENT]: {
    itemId: string;
    label: string;
    kind: 'primitive' | 'template';
    from?: string;
    to?: string;
  };
  [BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY]: {
    registry?: BuilderUiRegistryKey;
  };
  [BUILDER_UI_BOOTSTRAP_PUBLISH]: {
    version: string;
    tag: string;
    notes?: string;
    publishedAt?: string;
  };
  [BUILDER_UI_BOOTSTRAP_ROLLBACK]: {
    version: string;
    reason?: string;
    rolledBackAt?: string;
  };
  [BUILDER_UI_BOOTSTRAP_VERSION_PIN]: {
    versionPin?: string;
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
const VALID_DRAWERS = ['top', 'left', 'right', 'bottom'] as const;
const BUILDER_UI_REGISTRY_KEYS: BuilderUiRegistryKey[] = ['local', 'remote'];

const isFrameName = (value: unknown): value is FrameName =>
  typeof value === 'string' && VALID_FRAMES.includes(value as FrameName);

const isActiveSurface = (value: unknown): value is ActiveSurface =>
  typeof value === 'string' && VALID_SURFACES.includes(value as ActiveSurface);

const isSessionOrigin = (value: unknown): value is 'local' | 'remote' =>
  value === 'local' || value === 'remote';

const isDomRect = (value: unknown): value is DOMRect =>
  isRecord(value) &&
  hasNumber(value.x) &&
  hasNumber(value.y) &&
  hasNumber(value.width) &&
  hasNumber(value.height);

const GHOST_EDIT_ACTIONS: GhostHotspotEditAction[] = ['draw', 'resize', 'update'];

const isGhostEditAction = (value: unknown): value is GhostHotspotEditAction =>
  typeof value === 'string' && GHOST_EDIT_ACTIONS.includes(value as GhostHotspotEditAction);

const isGhostEmitterPayload = (value: unknown): value is GhostEmitterPayload =>
  typeof value === 'string' || (isRecord(value) && hasString(value.type));

const isGhostHotspotPayload = (value: unknown): value is GhostHotspotPayload => {
  if (!isRecord(value)) return false;
  if (!hasString(value.id)) return false;
  if (!isDomRect(value.rect)) return false;
  if (typeof value.path !== 'undefined' && !hasString(value.path)) return false;
  if (typeof value.frame !== 'undefined' && !isFrameName(value.frame)) return false;
  if (typeof value.emitter !== 'undefined' && !isGhostEmitterPayload(value.emitter)) {
    return false;
  }
  return true;
};

const isGhostHotspotEditPayload = (value: unknown): value is GhostHotspotEditPayload => {
  if (!isRecord(value)) return false;
  return isGhostEditAction(value.action) && isGhostHotspotPayload(value.hotspot);
};

const isBuilderUiRegistryKey = (value: unknown): value is BuilderUiRegistryKey =>
  typeof value === 'string' && BUILDER_UI_REGISTRY_KEYS.includes(value as BuilderUiRegistryKey);

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
    case UI_SET_SCALE:
      return hasNumber(payload.scale);
    case UI_DRAWER_OPEN:
      return (
        hasString(payload.drawer) &&
        VALID_DRAWERS.includes(payload.drawer) &&
        (typeof payload.size === 'undefined' || hasNumber(payload.size))
      );
    case UI_DRAWER_CLOSE:
      return hasString(payload.drawer) && VALID_DRAWERS.includes(payload.drawer);
    case UI_TOGGLE_DRAWER:
      return (
        hasString(payload.drawer) &&
        VALID_DRAWERS.includes(payload.drawer) &&
        (typeof payload.size === 'undefined' || hasNumber(payload.size))
      );
    case UI_RESET_LAYOUT:
      return true;
    case UI_FOCUS_SURFACE:
      return isActiveSurface(payload.surface);
    case STYLER_UPDATE_PROP:
      return (
        hasString(payload.path) &&
        (typeof payload.frame === 'undefined' || isFrameName(payload.frame))
      );
    case BINDING_UPDATE_PROP:
      return hasString(payload.path);
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
    case PIPELINE_TRIGGER_BUILD:
      return hasString(payload.draftId);
    case PIPELINE_ABORT_BUILD:
      return typeof payload.reason === 'undefined' || hasString(payload.reason);
    case PIPELINE_PUBLISH_VERSION:
      return (
        hasString(payload.tag) &&
        (typeof payload.notes === 'undefined' || hasString(payload.notes)) &&
        (typeof payload.compiledId === 'undefined' || hasString(payload.compiledId)) &&
        (typeof payload.draftId === 'undefined' || hasString(payload.draftId))
      );
    case GHOST_MAP_EDIT:
    case GHOST_RESIZE_FRAME:
      return isGhostHotspotEditPayload(payload);
    case 'ghost.trigger':
      return hasString(payload.type) && hasString(payload.path) && hasString(payload.hotspotId);
    case WAREHOUSE_ADD_INTENT:
      return (
        hasString(payload.itemId) &&
        hasString(payload.label) &&
        (payload.kind === 'primitive' || payload.kind === 'template')
      );
    case WAREHOUSE_MOVE_INTENT:
      return (
        hasString(payload.itemId) &&
        hasString(payload.label) &&
        (payload.kind === 'primitive' || payload.kind === 'template')
      );
    case BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY:
      return (
        typeof payload.registry === 'undefined' || isBuilderUiRegistryKey(payload.registry)
      );
    case BUILDER_UI_BOOTSTRAP_PUBLISH:
      return (
        hasString(payload.version) &&
        hasString(payload.tag) &&
        (typeof payload.notes === 'undefined' || hasString(payload.notes)) &&
        (typeof payload.publishedAt === 'undefined' || hasString(payload.publishedAt))
      );
    case BUILDER_UI_BOOTSTRAP_ROLLBACK:
      return (
        hasString(payload.version) &&
        (typeof payload.reason === 'undefined' || hasString(payload.reason)) &&
        (typeof payload.rolledBackAt === 'undefined' || hasString(payload.rolledBackAt))
      );
    case BUILDER_UI_BOOTSTRAP_VERSION_PIN:
      return typeof payload.versionPin === 'undefined' || hasString(payload.versionPin);
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
