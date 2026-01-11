import type { FrameName } from './frame-types';
import type { CompiledArtifact } from './compiled-canvas';
import type { ObservationCategory, ObservationPacket } from './telemetry';
import type { ActiveSelection } from '../contracts/active-selection';
import {
  BINDING_UPDATE_PROP,
  STYLER_UPDATE_PROP,
  UI_DRAWER_CLOSE,
  UI_DRAWER_OPEN,
  UI_SET_SCALE,
  type HostEventEnvelope,
  type HostEventType,
  WAREHOUSE_ADD_INTENT,
  WAREHOUSE_MOVE_INTENT,
} from '../contracts/event-envelope';
import type { GlobalSessionDraftLock } from '../contracts/global-session';
import type { DraftArtifact } from './draft-contract';
import type { UiState } from '../contracts/ui-state';

export type HostState = {
  ui: UiState;
  selection: ActiveSelection;
  selectionsByFrame: Record<FrameName, string | undefined>;
  artifact: CompiledArtifact;
  draft: DraftArtifact;
  draftLock: GlobalSessionDraftLock;
};

export const resolveObservationCategory = (
  event: HostEventEnvelope | HostEventType
): ObservationCategory => {
  const eventType = typeof event === 'string' ? event : event.type;
  switch (eventType) {
    case 'selection.set':
      return 'selection';
    case STYLER_UPDATE_PROP:
    case BINDING_UPDATE_PROP:
      return 'draft';
    case UI_SET_SCALE:
    case UI_DRAWER_OPEN:
    case UI_DRAWER_CLOSE:
    case 'pipeline.state':
    case 'session.state':
    case 'ui.surface':
    case WAREHOUSE_ADD_INTENT:
    case WAREHOUSE_MOVE_INTENT:
    default:
      return 'pipeline';
  }
};

export const buildObservationPayload = (
  event: HostEventEnvelope,
  nextState: HostState,
  prevState: HostState
) => {
  switch (event.type) {
    case 'ui.setFrame':
      return {
        frame: nextState.ui.activeFrame,
        previousFrame: prevState.ui.activeFrame,
        activeSurface: nextState.ui.activeSurface,
      };
    case 'selection.set':
      return {
        path: nextState.selection.path,
        frame: nextState.ui.activeFrame,
        activeSurface: nextState.ui.activeSurface,
      };
    case STYLER_UPDATE_PROP:
      return {
        path: event.payload.path,
        frame: event.payload.frame ?? nextState.ui.activeFrame,
        compiledId: nextState.artifact.compiledId,
        draftId: nextState.draft.draftId,
        activeSurface: nextState.ui.activeSurface,
      };
    case BINDING_UPDATE_PROP:
      return {
        path: event.payload.path,
        compiledId: nextState.artifact.compiledId,
        draftId: nextState.draft.draftId,
        activeSurface: nextState.ui.activeSurface,
      };
    case UI_SET_SCALE:
      return {
        scale: nextState.ui.scale,
      };
    case UI_DRAWER_OPEN:
      return {
        drawer: event.payload.drawer,
        size: event.payload.size ?? nextState.ui.drawers[event.payload.drawer].size,
      };
    case UI_DRAWER_CLOSE:
      return {
        drawer: event.payload.drawer,
      };
    case 'session.sync':
      return {
        frame: nextState.ui.activeFrame,
        path: nextState.selection.path,
        activeSurface: nextState.ui.activeSurface,
        sessionId: event.payload.session.sessionId,
      };
    case 'session.state':
      return {
        sessionId: event.payload.session.sessionId,
        origin: event.payload.origin,
        activeSurface: event.payload.session.activeSurface,
        activeFrame: event.payload.session.activeFrame,
      };
    case 'pipeline.state':
      return {
        status: event.payload.pipeline?.status ?? 'unknown',
        draftId: event.payload.pipeline?.draftId,
        compiledId: event.payload.pipeline?.compiledId,
      };
    case 'ui.surface':
      return {
        surface: event.payload.surface,
      };
    case WAREHOUSE_ADD_INTENT:
      return {
        itemId: event.payload.itemId,
        kind: event.payload.kind,
        target: event.payload.target ?? 'canvas',
      };
    case WAREHOUSE_MOVE_INTENT:
      return {
        itemId: event.payload.itemId,
        kind: event.payload.kind,
        from: event.payload.from ?? 'warehouse',
        to: event.payload.to ?? 'canvas',
      };
    default:
      return {};
  }
};

export const createObservationPacket = (
  event: HostEventEnvelope,
  nextState: HostState,
  prevState: HostState,
  sequence: number
): ObservationPacket => ({
  id: `${Date.now()}-${sequence}`,
  sequence,
  emittedAt: new Date().toISOString(),
  source: event.source,
  category: resolveObservationCategory(event),
  event: event.type,
  payload: buildObservationPayload(event, nextState, prevState),
});
