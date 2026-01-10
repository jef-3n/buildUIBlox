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

    .metadata-panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-left: 1px solid #e2e8f0;
      min-width: 240px;
    }

    .metadata-title {
      font-size: 0.9rem;
      font-weight: 600;
      color: #0f172a;
    }

    .metadata-list {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.5rem 0.75rem;
      font-size: 0.85rem;
      color: #1f2937;
    }

    .metadata-label {
      font-weight: 600;
      color: #475569;
    }

    .metadata-value {
      word-break: break-word;
    }

    .metadata-props {
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
      padding: 0.75rem;
      font-size: 0.75rem;
      line-height: 1.4;
      white-space: pre-wrap;
      margin: 0;
    }
  `;

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
        <slot name="right">${this.renderSelectionMetadata(activeFrame)}</slot>
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
              @click=${() => this.dispatch({
                type: 'UI_SET_FRAME',
                payload: { frame },
              })}
              ?disabled=${activeFrame === frame}
            >
              ${frame}
            </button>
          `
        )}
      </div>
    `;
  }

  private renderSelectionMetadata(activeFrame: FrameName) {
    const selectionPath = this.hostState.selection.path;
    if (!selectionPath) {
      return html`<div class="stub">Select a node to view metadata.</div>`;
    }

    const nodeId = getElementIdFromPath(selectionPath);
    const node = this.hostState.artifact.runtime.nodes[nodeId];
    if (!node) {
      return html`<div class="stub">No metadata found for ${nodeId}.</div>`;
    }

    const frame =
      this.hostState.artifact.runtime.layout.frames[activeFrame] ??
      this.hostState.artifact.runtime.layout.frames.desktop;
    const placement = frame?.placements?.[nodeId];
    const propsSummary = node.props ? JSON.stringify(node.props, null, 2) : 'No props';
    const childCount = node.children?.length ?? 0;

    return html`
      <div class="metadata-panel">
        <div class="metadata-title">Selected node metadata</div>
        <div class="metadata-list">
          <div class="metadata-label">Path</div>
          <div class="metadata-value">${selectionPath}</div>
          <div class="metadata-label">Node ID</div>
          <div class="metadata-value">${nodeId}</div>
          <div class="metadata-label">Type</div>
          <div class="metadata-value">${node.type}</div>
          <div class="metadata-label">Frame</div>
          <div class="metadata-value">${activeFrame}</div>
          <div class="metadata-label">Placement</div>
          <div class="metadata-value">${placement?.area ?? 'Unplaced'}</div>
          <div class="metadata-label">Children</div>
          <div class="metadata-value">${childCount}</div>
        </div>
        <div>
          <div class="metadata-label">Props</div>
          <pre class="metadata-props">${propsSummary}</pre>
        </div>
      </div>
    `;
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
      return {
        ...state,
        ui: { activeFrame: nextFrame },
        selection: { path: state.selectionsByFrame[nextFrame] },
      };
    }
    case 'SELECTION_SET': {
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
