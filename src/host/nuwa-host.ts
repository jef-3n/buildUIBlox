import { LitElement, html, css } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, state } from 'lit/decorators.js';
import './compiled-canvas';
import './selection-metadata';
import { sampleCompiledArtifact } from './sample-compiled';
import type { FrameName } from './frame-types';
import { elementPathPattern, getElementIdFromPath } from './paths';
import { normalizeFrameScopedPath, setPathValue } from './path-edits';
import type { ObservationPacket } from './telemetry';
import './telemetry-sniffer';
import {
  SHARED_SESSION_UPDATE_EVENT,
  type ActiveSurface,
  type SharedSessionEventDetail,
  createSharedSession,
} from './shared-session';
import {
  type HostEvent,
  type HostState,
  createObservationPacket,
} from './observation';
import {
  BUILDER_UI_REGISTRY_BOUNDARY,
  builderUiManifest,
  type BuilderUiComponentEntry,
} from '../system/components/builder-ui/manifest';
import { loadBuilderUiRegistry } from '../system/components/builder-ui/registry';


type HostSlotName = 'top' | 'left' | 'right' | 'bottom';

type HostSlotReplacementState = {
  status: 'idle' | 'loading' | 'ready' | 'failed';
  entry?: BuilderUiComponentEntry;
  tagName?: string;
  error?: string;
};


@customElement('nuwa-host')
export class NuwaHost extends LitElement {
  private observationSequence = 0;
  private sharedSession = createSharedSession({
    activeFrame: 'desktop',
    selectionPath: undefined,
    activeSurface: 'canvas',
  });
  private slotLoadSequence: Record<HostSlotName, number> = {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  @state()
  private hostState: HostState = {
    ui: { activeFrame: 'desktop', activeSurface: 'canvas' },
    selection: { path: undefined },
    selectionsByFrame: { desktop: undefined, tablet: undefined, mobile: undefined },
    artifact: sampleCompiledArtifact,
  };

  @state()
  private slotReplacementState: Record<HostSlotName, HostSlotReplacementState> = {
    top: { status: 'idle' },
    left: { status: 'idle' },
    right: { status: 'idle' },
    bottom: { status: 'idle' },
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

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('UI_SET_FRAME', this.handleFrameSwitch as EventListener);
    this.sharedSession.addEventListener(
      SHARED_SESSION_UPDATE_EVENT,
      this.handleSharedSessionUpdate as EventListener
    );
    this.sharedSession.connect();
    this.loadBuilderUiSlots();
  }

  disconnectedCallback() {
    this.removeEventListener('UI_SET_FRAME', this.handleFrameSwitch as EventListener);
    this.sharedSession.removeEventListener(
      SHARED_SESSION_UPDATE_EVENT,
      this.handleSharedSessionUpdate as EventListener
    );
    this.sharedSession.disconnect();
    super.disconnectedCallback();
  }

  render() {
    const activeFrame = this.hostState.ui.activeFrame;
    return html`
      <div class="drawer top">
        ${this.renderSlotReplacement(
          'top',
          html`<div class="stub">Top drawer</div>`
        )}
        ${this.renderFrameToggle(activeFrame)}
      </div>
      <div class="drawer left">
        ${this.renderSlotReplacement(
          'left',
          html`<div class="stub">Left drawer</div>`
        )}
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
        ${this.renderSlotReplacement(
          'right',
          html`
            <telemetry-sniffer
              .activeFrame=${activeFrame}
              .selectionPath=${this.hostState.selection.path ?? ''}
              .compiledId=${this.hostState.artifact.compiledId}
              .draftId=${this.hostState.artifact.draftId}
            ></telemetry-sniffer>
          `
        )}
      </div>
      <div class="drawer bottom">
        ${this.renderSlotReplacement(
          'bottom',
          html`<div class="stub">Bottom drawer</div>`
        )}
      </div>
    `;
  }

  private renderSlotReplacement(slotName: HostSlotName, fallback: unknown) {
    const slotState = this.slotReplacementState[slotName];
    if (slotState?.status === 'ready' && slotState.tagName) {
      const tagName = unsafeStatic(slotState.tagName);
      return staticHtml`<${tagName}></${tagName}>`;
    }

    return html`<slot name=${slotName}>${fallback}</slot>`;
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

  private handleSharedSessionUpdate(event: CustomEvent<SharedSessionEventDetail>) {
    const detail = event.detail;
    if (!detail || detail.origin !== 'remote') {
      return;
    }
    this.dispatch({ type: 'SESSION_SYNC', payload: { session: detail.state } });
  }

  private async loadBuilderUiSlots() {
    const registryResult = loadBuilderUiRegistry(builderUiManifest);
    if (!registryResult.ok) {
      return;
    }

    const { registry, boundary } = registryResult.snapshot;
    const entriesById = new Map(registry.entries.map((entry) => [entry.id, entry]));
    const slotReplacementOrder: HostSlotName[] = ['top', 'left', 'right', 'bottom'];
    const slotEntryMap: Partial<Record<HostSlotName, string>> = {
      top: `${BUILDER_UI_REGISTRY_BOUNDARY}toolbar`,
    };

    for (const slotName of slotReplacementOrder) {
      const entryId = slotEntryMap[slotName];
      if (!entryId) {
        continue;
      }
      const entry = entriesById.get(entryId);
      if (!entry) {
        continue;
      }
      await this.loadSlotReplacement(slotName, entry, boundary);
    }
  }

  private resolveSlotModulePath(modulePath: string, boundary: string) {
    if (modulePath.startsWith('http://') || modulePath.startsWith('https://')) {
      return modulePath;
    }
    if (modulePath.startsWith('/src/')) {
      return modulePath;
    }
    if (modulePath.startsWith(boundary)) {
      return `/src${modulePath}`;
    }
    return modulePath;
  }

  private resolveSlotTagName(
    module: Record<string, unknown>,
    entry: BuilderUiComponentEntry
  ): string | undefined {
    const exportKey = entry.exportName ?? 'default';
    const candidate =
      exportKey === 'default'
        ? module.default ?? module.elementTag ?? module.tagName
        : module[exportKey];
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private async loadSlotReplacement(
    slotName: HostSlotName,
    entry: BuilderUiComponentEntry,
    boundary: string
  ) {
    const loadSequence = ++this.slotLoadSequence[slotName];
    this.slotReplacementState = {
      ...this.slotReplacementState,
      [slotName]: { status: 'loading', entry },
    };

    try {
      const modulePath = this.resolveSlotModulePath(entry.modulePath, boundary);
      const loadedModule = (await import(/* @vite-ignore */ modulePath)) as Record<
        string,
        unknown
      >;
      const tagName = this.resolveSlotTagName(loadedModule, entry);
      if (!tagName) {
        throw new Error(`Missing exported tag for ${entry.id}`);
      }
      if (loadSequence !== this.slotLoadSequence[slotName]) {
        return;
      }
      this.slotReplacementState = {
        ...this.slotReplacementState,
        [slotName]: { status: 'ready', entry, tagName },
      };
    } catch (error) {
      if (loadSequence !== this.slotLoadSequence[slotName]) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.slotReplacementState = {
        ...this.slotReplacementState,
        [slotName]: { status: 'failed', entry, error: message },
      };
    }
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
    const prevState = this.hostState;
    const nextState = hostReducer(this.hostState, event);
    if (nextState === this.hostState) {
      return;
    }
    this.hostState = nextState;
    this.emitObservationPacket(event, nextState, prevState);
    this.syncSharedSession(event, nextState);
  }

  private emitObservationPacket(event: HostEvent, nextState: HostState, prevState: HostState) {
    const packet = createObservationPacket(
      event,
      nextState,
      prevState,
      ++this.observationSequence
    );
    this.dispatchEvent(
      new CustomEvent<ObservationPacket>('OBSERVATION_PACKET', {
        detail: packet,
        bubbles: true,
        composed: true,
      })
    );
  }

  private syncSharedSession(event: HostEvent, nextState: HostState) {
    if (event.type === 'SESSION_SYNC') {
      return;
    }
    this.sharedSession.update({
      activeFrame: nextState.ui.activeFrame,
      selectionPath: nextState.selection.path,
      activeSurface: nextState.ui.activeSurface,
    });
  }
}

const hostReducer = (state: HostState, event: HostEvent): HostState => {
  // Active surface rules:
  // - UI_SET_FRAME -> frames
  // - SELECTION_SET -> canvas
  // - ARTIFACT_PATH_EDIT -> metadata
  // - SESSION_SYNC -> use session-provided activeSurface
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
        ui: { activeFrame: nextFrame, activeSurface: 'frames' },
        selection: { path: nextSelection },
        selectionsByFrame: {
          ...state.selectionsByFrame,
          [nextFrame]: nextSelection,
        },
      };
    }
    case 'SELECTION_SET': {
      if (!isSelectionInFrame(state.artifact, state.ui.activeFrame, event.payload.path)) {
        return state;
      }
      return {
        ...state,
        ui: { ...state.ui, activeSurface: 'canvas' },
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
        ui: { ...state.ui, activeSurface: 'metadata' },
        artifact: nextArtifact,
      };
    }
    case 'SESSION_SYNC': {
      const { session } = event.payload;
      const nextFrame = session.activeFrame ?? state.ui.activeFrame;
      const nextUi = {
        activeFrame: nextFrame,
        activeSurface: session.activeSurface ?? state.ui.activeSurface,
      };

      let nextSelection = state.selection.path;
      let nextSelectionsByFrame = state.selectionsByFrame;

      if (nextFrame !== state.ui.activeFrame) {
        const candidates = [
          session.selectionPath,
          state.selectionsByFrame[nextFrame],
          state.selection.path,
        ];
        const resolvedSelection = candidates.find((selectionPath) =>
          isSelectionInFrame(state.artifact, nextFrame, selectionPath)
        );
        nextSelection = resolvedSelection;
        nextSelectionsByFrame = {
          ...state.selectionsByFrame,
          [nextFrame]: resolvedSelection,
        };
      }

      if (session.selectionPath !== nextSelection) {
        if (!session.selectionPath) {
          nextSelection = undefined;
          nextSelectionsByFrame = {
            ...nextSelectionsByFrame,
            [nextFrame]: undefined,
          };
        } else if (isSelectionInFrame(state.artifact, nextFrame, session.selectionPath)) {
          nextSelection = session.selectionPath;
          nextSelectionsByFrame = {
            ...nextSelectionsByFrame,
            [nextFrame]: session.selectionPath,
          };
        }
      }

      return {
        ...state,
        ui: nextUi,
        selection: { path: nextSelection },
        selectionsByFrame: nextSelectionsByFrame,
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
