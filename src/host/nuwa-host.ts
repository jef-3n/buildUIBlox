import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './compiled-canvas';
import { sampleCompiledArtifact } from './sample-compiled';
import type { FrameName } from './frame-types';
import { elementPathPattern, getElementIdFromPath } from './paths';
import { normalizeFrameScopedPath, setPathValue } from './path-edits';
import type { CompiledArtifact } from './compiled-canvas';

type UiState = {
  activeFrame: FrameName;
};

type SelectionState = {
  path?: string;
};

type HostState = {
  ui: UiState;
  selection: SelectionState;
  selectionsByFrame: Record<FrameName, string | undefined>;
  artifact: CompiledArtifact;
};

type HostEvent =
  | { type: 'UI_SET_FRAME'; payload: { frame: FrameName } }
  | { type: 'SELECTION_SET'; payload: { path: string } }
  | {
      type: 'ARTIFACT_PATH_EDIT';
      payload: { path: string; value: unknown; frame?: FrameName };
    };

@customElement('nuwa-host')
export class NuwaHost extends LitElement {
  @state()
  private hostState: HostState = {
    ui: { activeFrame: 'desktop' },
    selection: { path: undefined },
    selectionsByFrame: { desktop: undefined, tablet: undefined, mobile: undefined },
    artifact: sampleCompiledArtifact,
  };

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'top top top'
        'left center right'
        'bottom bottom bottom';
      height: 100vh;
    }

    .drawer {
      display: flex;
    }

    .top {
      grid-area: top;
    }

    .left {
      grid-area: left;
    }

    .right {
      grid-area: right;
    }

    .bottom {
      grid-area: bottom;
    }

    .center {
      grid-area: center;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
    }

    .stub {
      color: #6b7280;
      font-size: 0.875rem;
      padding: 0.5rem 0.75rem;
      border: 1px dashed #cbd5f5;
      border-radius: 6px;
      background: #f8fafc;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('UI_SET_FRAME', this.handleFrameSwitch as EventListener);
  }

  disconnectedCallback() {
    this.removeEventListener('UI_SET_FRAME', this.handleFrameSwitch as EventListener);
    super.disconnectedCallback();
  }

  render() {
    const activeFrame = this.hostState.ui.activeFrame;
    return html`
      <div class="drawer top">
        <slot name="top"><div class="stub">Top drawer</div></slot>
        ${this.renderFrameToggle(activeFrame)}
      </div>
      <div class="drawer left">
        <slot name="left"><div class="stub">Left drawer</div></slot>
      </div>
      <main class="center">
        <slot>
          <compiled-canvas
            .artifact=${this.hostState.artifact}
            .activeFrame=${activeFrame}
            .selectedPath=${this.hostState.selection.path}
            @SELECTION_SET=${this.handleSelectionSet}
            @ARTIFACT_PATH_EDIT=${this.handleArtifactPathEdit}
          ></compiled-canvas>
        </slot>
      </main>
      <div class="drawer right">
        <slot name="right"><div class="stub">Right drawer</div></slot>
      </div>
      <div class="drawer bottom">
        <slot name="bottom"><div class="stub">Bottom drawer</div></slot>
      </div>
    `;
  }

  private renderFrameToggle(activeFrame: FrameName) {
    const frames: FrameName[] = ['desktop', 'tablet', 'mobile'];
    return html`
      <div class="stub">
        Frame:
        ${frames.map(
          (frame) => html`
            <button
              @click=${() =>
                this.dispatchEvent(
                  new CustomEvent('UI_SET_FRAME', {
                    detail: { frame },
                    bubbles: true,
                    composed: true,
                  })
                )}
              ?disabled=${activeFrame === frame}
            >
              ${frame}
            </button>
          `
        )}
      </div>
    `;
  }

  private handleFrameSwitch(event: CustomEvent<{ frame: FrameName }>) {
    event.stopPropagation();
    const frame = event.detail?.frame;
    if (!frame) {
      return;
    }
    this.dispatch({ type: 'UI_SET_FRAME', payload: { frame } });
  }

  private handleSelectionSet(event: CustomEvent<{ path: string }>) {
    event.stopPropagation();
    const path = event.detail?.path;
    if (!path || !elementPathPattern.test(path)) {
      return;
    }
    this.dispatch({ type: 'SELECTION_SET', payload: { path } });
  }

  private handleArtifactPathEdit(
    event: CustomEvent<{ path: string; value: unknown; frame?: FrameName }>
  ) {
    event.stopPropagation();
    const { path, value, frame } = event.detail ?? {};
    if (!path) {
      return;
    }
    this.dispatch({ type: 'ARTIFACT_PATH_EDIT', payload: { path, value, frame } });
  }

  private dispatch(event: HostEvent) {
    const nextState = hostReducer(this.hostState, event);
    if (nextState === this.hostState) {
      return;
    }
    this.hostState = nextState;
  }
}

const hostReducer = (state: HostState, event: HostEvent): HostState => {
  switch (event.type) {
    case 'UI_SET_FRAME': {
      if (state.ui.activeFrame === event.payload.frame) {
        return state;
      }
      const nextFrame = event.payload.frame;
      const selectionCandidates = [
        state.selectionsByFrame[nextFrame],
        state.selection.path,
      ];
      const nextSelection = selectionCandidates.find((selectionPath) =>
        isSelectionInFrame(state.artifact, nextFrame, selectionPath)
      );
      return {
        ...state,
        ui: { activeFrame: nextFrame },
        selection: { path: state.selectionsByFrame[nextFrame] },
      };
    }
    case 'SELECTION_SET': {
      if (!isSelectionInFrame(state.artifact, state.ui.activeFrame, event.payload.path)) {
        return state;
      }
      return {
        ...state,
        selection: { path: event.payload.path },
        selectionsByFrame: {
          ...state.selectionsByFrame,
          [state.ui.activeFrame]: event.payload.path,
        },
      };
    }
    case 'ARTIFACT_PATH_EDIT': {
      const targetFrame = event.payload.frame ?? state.ui.activeFrame;
      const normalizedPath = normalizeFrameScopedPath(event.payload.path, targetFrame);
      if (!normalizedPath) {
        return state;
      }
      const nextArtifact = setPathValue(state.artifact, normalizedPath, event.payload.value);
      if (!nextArtifact) {
        return state;
      }
      return {
        ...state,
        artifact: nextArtifact,
      };
    }
    default:
      return state;
  }
};

const isSelectionInFrame = (
  artifact: CompiledArtifact,
  frameName: FrameName,
  selectionPath?: string
) => {
  if (!selectionPath) return false;
  const nodeId = getElementIdFromPath(selectionPath);
  const frame = artifact.runtime.layout.frames[frameName];
  if (!frame) return false;
  return frame.order.includes(nodeId) || nodeId in frame.placements;
};
