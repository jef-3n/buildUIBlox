import type { FrameName } from './frame-types';
import type { CompiledArtifact } from './compiled-canvas';
import type { ObservationCategory, ObservationPacket } from './telemetry';
import type { ActiveSelection } from '../contracts/active-selection';
import type { HostEventEnvelope, HostEventType } from '../contracts/event-envelope';
import type { UiState } from '../contracts/ui-state';

export type HostState = {
  ui: UiState;
  selection: ActiveSelection;
  selectionsByFrame: Record<FrameName, string | undefined>;
  artifact: CompiledArtifact;
};

export const resolveObservationCategory = (
  event: HostEventEnvelope | HostEventType
): ObservationCategory => {
  const eventType = typeof event === 'string' ? event : event.type;
  switch (eventType) {
    case 'selection.set':
      return 'selection';
    case 'artifact.pathEdit':
      return 'artifact';
    case 'pipeline.state':
    case 'session.state':
    case 'ui.surface':
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
    case 'artifact.pathEdit':
      return {
        path: event.payload.path,
        frame: event.payload.frame ?? nextState.ui.activeFrame,
        compiledId: nextState.artifact.compiledId,
        draftId: nextState.artifact.draftId,
        activeSurface: nextState.ui.activeSurface,
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
