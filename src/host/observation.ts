import type { FrameName } from './frame-types';
import type { CompiledArtifact } from './compiled-canvas';
import type { ObservationCategory, ObservationPacket } from './telemetry';
import type { SharedSessionSnapshot } from './shared-session';

export type UiState = {
  activeFrame: FrameName;
  activeSurface: 'canvas' | 'frames' | 'metadata' | 'telemetry' | 'unknown';
};

export type SelectionState = {
  path?: string;
};

export type HostState = {
  ui: UiState;
  selection: SelectionState;
  selectionsByFrame: Record<FrameName, string | undefined>;
  artifact: CompiledArtifact;
};

export type HostEvent =
  | { type: 'UI_SET_FRAME'; payload: { frame: FrameName } }
  | { type: 'SELECTION_SET'; payload: { path: string } }
  | {
      type: 'ARTIFACT_PATH_EDIT';
      payload: { path: string; value: unknown; frame?: FrameName };
    }
  | { type: 'SESSION_SYNC'; payload: { session: SharedSessionSnapshot } };

export const resolveObservationCategory = (event: HostEvent): ObservationCategory => {
  switch (event.type) {
    case 'SELECTION_SET':
      return 'selection';
    case 'ARTIFACT_PATH_EDIT':
      return 'artifact';
    default:
      return 'pipeline';
  }
};

export const buildObservationPayload = (
  event: HostEvent,
  nextState: HostState,
  prevState: HostState
) => {
  switch (event.type) {
    case 'UI_SET_FRAME':
      return {
        frame: nextState.ui.activeFrame,
        previousFrame: prevState.ui.activeFrame,
        activeSurface: nextState.ui.activeSurface,
      };
    case 'SELECTION_SET':
      return {
        path: nextState.selection.path,
        frame: nextState.ui.activeFrame,
        activeSurface: nextState.ui.activeSurface,
      };
    case 'ARTIFACT_PATH_EDIT':
      return {
        path: event.payload.path,
        frame: event.payload.frame ?? nextState.ui.activeFrame,
        compiledId: nextState.artifact.compiledId,
        draftId: nextState.artifact.draftId,
        activeSurface: nextState.ui.activeSurface,
      };
    case 'SESSION_SYNC':
      return {
        frame: nextState.ui.activeFrame,
        path: nextState.selection.path,
        activeSurface: nextState.ui.activeSurface,
        sessionId: event.payload.session.sessionId,
      };
    default:
      return {};
  }
};

export const createObservationPacket = (
  event: HostEvent,
  nextState: HostState,
  prevState: HostState,
  sequence: number
): ObservationPacket => ({
  id: `${Date.now()}-${sequence}`,
  sequence,
  emittedAt: new Date().toISOString(),
  source: 'nuwa-host',
  category: resolveObservationCategory(event),
  event: event.type,
  payload: buildObservationPayload(event, nextState, prevState),
});
