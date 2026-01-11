import { LitElement, html, css } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, state } from 'lit/decorators.js';
import './compiled-canvas';
import './selection-metadata';
import { sampleCompiledArtifact } from './sample-compiled';
import { sampleDraft } from './sample-draft';
import type { FrameName } from './frame-types';
import { elementPathPattern, getElementIdFromPath } from './paths';
import { normalizeDraftStylerPath, setDraftPathValue } from './path-edits';
import type { ObservationPacket } from './telemetry';
import './telemetry-sniffer';
import {
  HOST_EVENT_ENVELOPE_EVENT,
  STYLER_UPDATE_PROP,
  createHostEventEnvelope,
  isCompatibleHostEventEnvelope,
  type HostEventEnvelope,
  type HostEventPayloadMap,
  type HostEventType,
} from '../contracts/event-envelope';
import {
  getSlotReplacementInstruction,
  type HostSlotName,
  type HostSlotReplacementState,
} from './slot-replacement';
import {
  SHARED_SESSION_UPDATE_EVENT,
  type SharedSessionEventDetail,
  createSharedSession,
} from './shared-session';
import { type HostState, createObservationPacket } from './observation';
import {
  BUILDER_UI_REGISTRY_BOUNDARY,
  builderUiManifest,
  type BuilderUiComponentEntry,
} from '../system/components/builder-ui/manifest';
import { loadBuilderUiRegistry } from '../system/components/builder-ui/registry';


type HostSlotReplacementStateWithEntry = HostSlotReplacementState & {
  entry?: BuilderUiComponentEntry;
  error?: string;
};


@customElement('nuwa-host')
export class NuwaHost extends LitElement {
  private observationSequence = 0;
  private sharedSession = createSharedSession({
    appId: 'demo-app',
    activeFrame: 'desktop',
    selectionPath: undefined,
    activeSurface: 'canvas',
    draftId: sampleCompiledArtifact.draftId,
    compiledId: sampleCompiledArtifact.compiledId,
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
    draft: sampleDraft,
  };

  @state()
  private slotReplacementState: Record<HostSlotName, HostSlotReplacementStateWithEntry> = {
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
    this.addEventListener(
      HOST_EVENT_ENVELOPE_EVENT,
      this.handleHostEventEnvelope as EventListener
    );
    this.sharedSession.addEventListener(
      SHARED_SESSION_UPDATE_EVENT,
      this.handleSharedSessionUpdate as EventListener
    );
    this.sharedSession.connect();
    this.loadBuilderUiSlots();
  }

  disconnectedCallback() {
    this.removeEventListener(
      HOST_EVENT_ENVELOPE_EVENT,
      this.handleHostEventEnvelope as EventListener
    );
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
            .draft=${this.hostState.draft}
            .activeFrame=${activeFrame}
            .selectedPath=${this.hostState.selection.path}
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
              .draftId=${this.hostState.draft.draftId}
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
    const instruction = getSlotReplacementInstruction(slotName, slotState);
    if (instruction.kind === 'component') {
      const tagName = unsafeStatic(instruction.tagName);
      return staticHtml`<${tagName}></${tagName}>`;
    }

    return html`<slot name=${instruction.name}>${fallback}</slot>`;
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
                this.emitHostEvent('ui.setFrame', { frame }, 'nuwa-host')}
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

  private emitHostEvent<T extends HostEventType>(
    type: T,
    payload: HostEventPayloadMap[T],
    source = 'nuwa-host'
  ) {
    const envelope = createHostEventEnvelope(type, payload, source);
    this.dispatchEvent(
      new CustomEvent<HostEventEnvelope>(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSharedSessionUpdate(event: CustomEvent<SharedSessionEventDetail>) {
    const detail = event.detail;
    if (!detail) {
      return;
    }
    this.emitHostEvent(
      'session.state',
      { session: detail.state, origin: detail.origin },
      'shared-session'
    );
    if (detail.changes.pipeline) {
      this.emitHostEvent(
        'pipeline.state',
        { pipeline: detail.state.pipeline ?? null },
        'shared-session'
      );
    }
    if (detail.changes.surface) {
      this.emitHostEvent(
        'ui.surface',
        { surface: detail.state.activeSurface },
        'shared-session'
      );
    }
    if (detail.origin !== 'remote') {
      return;
    }
    this.emitHostEvent('session.sync', { session: detail.state }, 'shared-session');
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

  private handleHostEventEnvelope(event: Event) {
    const detail = (event as CustomEvent<HostEventEnvelope>).detail;
    if (!isCompatibleHostEventEnvelope(detail)) {
      return;
    }
    event.stopPropagation();
    this.applyHostEventEnvelope(detail);
  }

  private applyHostEventEnvelope(envelope: HostEventEnvelope) {
    const handler = hostEventHandlers[envelope.type];
    if (!handler) {
      return;
    }
    const prevState = this.hostState;
    const nextState = handler(this.hostState, envelope as never);
    if (nextState === this.hostState) {
      return;
    }
    this.hostState = nextState;
    this.emitObservationPacket(envelope, nextState, prevState);
    this.syncSharedSession(envelope, nextState);
  }

  private emitObservationPacket(
    event: HostEventEnvelope,
    nextState: HostState,
    prevState: HostState
  ) {
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

  private syncSharedSession(event: HostEventEnvelope, nextState: HostState) {
    if (event.type === 'session.sync') {
      return;
    }
    this.sharedSession.update({
      activeFrame: nextState.ui.activeFrame,
      selectionPath: nextState.selection.path,
      activeSurface: nextState.ui.activeSurface,
    });
  }
}

type HostEventHandlerMap = {
  [K in HostEventType]: (state: HostState, event: HostEventEnvelope<K>) => HostState;
};

const hostEventHandlers: HostEventHandlerMap = {
  // Active surface rules:
  // - ui.setFrame -> frames
  // - selection.set -> canvas
  // - styler.updateProp -> metadata
  // - session.sync -> use session-provided activeSurface
  'ui.setFrame': (state, event) => {
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
  },
  'ui.surface': (state) => state,
  'selection.set': (state, event) => {
    const path = event.payload.path;
    if (!path || !elementPathPattern.test(path)) {
      return state;
    }
    if (!isSelectionInFrame(state.artifact, state.ui.activeFrame, path)) {
      return state;
    }
    return {
      ...state,
      ui: { ...state.ui, activeSurface: 'canvas' },
      selection: { path },
      selectionsByFrame: {
        ...state.selectionsByFrame,
        [state.ui.activeFrame]: path,
      },
    };
  },
  [STYLER_UPDATE_PROP]: (state, event) => {
    const targetFrame = event.payload.frame ?? state.ui.activeFrame;
    const normalizedPath = normalizeDraftStylerPath(event.payload.path, targetFrame);
    if (!normalizedPath) {
      return state;
    }
    const nextDraft = setDraftPathValue(state.draft, normalizedPath, event.payload.value);
    if (!nextDraft) {
      return state;
    }
    return {
      ...state,
      ui: { ...state.ui, activeSurface: 'metadata' },
      draft: nextDraft,
    };
  },
  'session.sync': (state, event) => {
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
  },
  'session.state': (state) => state,
  'pipeline.state': (state) => state,
  'ghost.trigger': (state) => state,
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
