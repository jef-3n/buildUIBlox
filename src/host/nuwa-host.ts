import { LitElement, html, css } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { customElement, state } from 'lit/decorators.js';
import './compiled-canvas';
import './inspector-panel';
import { sampleCompiledArtifact } from './sample-compiled';
import { sampleDraft } from './sample-draft';
import type { FrameName } from './frame-types';
import type { DraftArtifact } from './draft-contract';
import type { CompiledArtifact } from './compiled-contract';
import { elementPathPattern, getElementIdFromPath } from './paths';
import {
  normalizeDraftBindingPath,
  normalizeDraftStylerPath,
  setDraftPathValue,
} from './path-edits';
import type { ObservationPacket } from './telemetry';
import './telemetry-sniffer';
import {
  BINDING_UPDATE_PROP,
  HOST_EVENT_ENVELOPE_EVENT,
  PIPELINE_ABORT,
  PIPELINE_PUBLISH,
  PIPELINE_TRIGGER,
  STYLER_UPDATE_PROP,
  createHostEventEnvelope,
  isCompatibleHostEventEnvelope,
  UI_DRAWER_CLOSE,
  UI_DRAWER_OPEN,
  UI_SET_SCALE,
  type HostEventEnvelope,
  type HostEventPayloadMap,
  type HostEventType,
  WAREHOUSE_ADD_INTENT,
  WAREHOUSE_MOVE_INTENT,
  BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY,
  BUILDER_UI_BOOTSTRAP_PUBLISH,
  BUILDER_UI_BOOTSTRAP_ROLLBACK,
  BUILDER_UI_BOOTSTRAP_VERSION_PIN,
} from '../contracts/event-envelope';
import {
  getSlotReplacementInstruction,
  isValidSlotReplacementTagName,
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
  DEFAULT_UI_SCALE,
  createUiDrawersState,
  type DrawerName,
} from '../contracts/ui-state';
import {
  BUILDER_UI_REGISTRY_BOUNDARY,
  getBuilderUiManifest,
  setBuilderUiManifest,
  type BuilderUiComponentEntry,
} from '../system/components/builder-ui/manifest';
import {
  applyBuilderUiBootstrapFullClosure,
  loadBuilderUiRegistry,
  pinBuilderUiBootstrapVersion,
  rollbackBuilderUiBootstrapVersion,
  switchBuilderUiRegistry,
} from '../system/components/builder-ui/registry';
import './warehouse-drawer';
import { compileDraftArtifact } from './compiler';
import { DraftArtifactStore } from './draft-store';
import { CompiledArtifactStore } from './compiled-store';


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
    scale: DEFAULT_UI_SCALE,
    drawers: createUiDrawersState(),
    draftId: sampleCompiledArtifact.draftId,
    compiledId: sampleCompiledArtifact.compiledId,
  });
  private draftStore = new DraftArtifactStore(
    sampleDraft.appId,
    sampleDraft
  );
  private compiledStore = new CompiledArtifactStore(
    sampleCompiledArtifact.appId,
    sampleCompiledArtifact
  );
  private draftStoreUnsubscribe?: () => void;
  private compiledStoreUnsubscribe?: () => void;
  private slotLoadSequence: Record<HostSlotName, number> = {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  @state()
  private hostState: HostState = {
    ui: {
      activeFrame: 'desktop',
      activeSurface: 'canvas',
      scale: DEFAULT_UI_SCALE,
      drawers: createUiDrawersState(),
    },
    selection: { path: undefined },
    selectionsByFrame: { desktop: undefined, tablet: undefined, mobile: undefined },
    artifact: sampleCompiledArtifact,
    draft: sampleDraft,
    draftLock: this.sharedSession.state.draftLock,
  };

  @state()
  private slotReplacementState: Record<HostSlotName, HostSlotReplacementStateWithEntry> = {
    top: { status: 'idle' },
    left: { status: 'idle' },
    right: { status: 'idle' },
    bottom: { status: 'idle' },
  };

  @state()
  private ghostEditMode = false;

  static styles = css`
    :host {
      display: grid;
      grid-template-rows:
        var(--drawer-top-size, auto)
        minmax(0, 1fr)
        var(--drawer-bottom-size, auto);
      grid-template-columns:
        var(--drawer-left-size, auto)
        minmax(0, 1fr)
        var(--drawer-right-size, auto);
      grid-template-areas:
        'top top top'
        'left center right'
        'bottom bottom bottom';
      height: 100vh;
    }

    .drawer {
      display: flex;
      overflow: hidden;
    }

    .top {
      grid-area: top;
      height: var(--drawer-top-size, auto);
      visibility: var(--drawer-top-visibility, visible);
      pointer-events: var(--drawer-top-pointer, auto);
    }

    .left {
      grid-area: left;
      width: var(--drawer-left-size, auto);
      visibility: var(--drawer-left-visibility, visible);
      pointer-events: var(--drawer-left-pointer, auto);
    }

    .right {
      grid-area: right;
      width: var(--drawer-right-size, auto);
      visibility: var(--drawer-right-visibility, visible);
      pointer-events: var(--drawer-right-pointer, auto);
    }

    .bottom {
      grid-area: bottom;
      height: var(--drawer-bottom-size, auto);
      visibility: var(--drawer-bottom-visibility, visible);
      pointer-events: var(--drawer-bottom-pointer, auto);
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
    this.addEventListener(
      HOST_EVENT_ENVELOPE_EVENT,
      this.handleHostEventEnvelope as EventListener
    );
    this.sharedSession.addEventListener(
      SHARED_SESSION_UPDATE_EVENT,
      this.handleSharedSessionUpdate as EventListener
    );
    this.addEventListener(
      'INSPECTOR_GHOST_EDIT_TOGGLE',
      this.handleGhostEditToggle as EventListener
    );
    this.sharedSession.connect();
    this.connectArtifactStores();
    this.loadBuilderUiSlots();
    this.applyUiCssVars();
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
    this.removeEventListener(
      'INSPECTOR_GHOST_EDIT_TOGGLE',
      this.handleGhostEditToggle as EventListener
    );
    this.sharedSession.disconnect();
    this.disconnectArtifactStores();
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
          html`<warehouse-drawer></warehouse-drawer>`
        )}
      </div>
      <main class="center">
        <slot>
          <compiled-canvas
            .artifact=${this.hostState.artifact}
            .draft=${this.hostState.draft}
            .activeFrame=${activeFrame}
            .selectedPath=${this.hostState.selection.path}
            .scale=${this.hostState.ui.scale}
            .ghostEditMode=${this.ghostEditMode}
          ></compiled-canvas>
        </slot>
      </main>
      <div class="drawer right">
        ${this.renderSlotReplacement(
          'right',
          html`
            <inspector-panel
              .artifact=${this.hostState.artifact}
              .draft=${this.hostState.draft}
              .selectedPath=${this.hostState.selection.path}
              .activeFrame=${activeFrame}
              .ghostEditMode=${this.ghostEditMode}
            ></inspector-panel>
          `
        )}
      </div>
      <div class="drawer bottom">
        ${this.renderSlotReplacement(
          'bottom',
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
    `;
  }

  private renderSlotReplacement(slotName: HostSlotName, fallback: unknown) {
    const slotState = this.slotReplacementState[slotName];
    const instruction = getSlotReplacementInstruction(slotName, slotState);
    if (instruction.kind === 'component') {
      return this.renderSlotComponent(slotName, instruction.tagName);
    }

    return html`<slot name=${instruction.name}>${fallback}</slot>`;
  }

  private renderSlotComponent(slotName: HostSlotName, tagName: string) {
    const tag = unsafeStatic(tagName);
    switch (slotName) {
      case 'right':
        return staticHtml`<${tag}
          .artifact=${this.hostState.artifact}
          .draft=${this.hostState.draft}
          .selectedPath=${this.hostState.selection.path}
          .activeFrame=${this.hostState.ui.activeFrame}
          .ghostEditMode=${this.ghostEditMode}
        ></${tag}>`;
      case 'bottom':
        return staticHtml`<${tag}
          .activeFrame=${this.hostState.ui.activeFrame}
          .selectionPath=${this.hostState.selection.path ?? ''}
          .compiledId=${this.hostState.artifact.compiledId}
          .draftId=${this.hostState.draft.draftId}
        ></${tag}>`;
      case 'top':
      case 'left':
      default:
        return staticHtml`<${tag}></${tag}>`;
    }
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

  private handleGhostEditToggle(event: CustomEvent<{ enabled: boolean }>) {
    if (typeof event.detail?.enabled !== 'boolean') {
      return;
    }
    this.ghostEditMode = event.detail.enabled;
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);
    if (changedProperties.has('hostState')) {
      this.applyUiCssVars();
    }
  }

  private applyUiCssVars() {
    const { drawers } = this.hostState.ui;
    this.style.setProperty(
      '--drawer-top-size',
      `${drawers.top.open ? drawers.top.size : 0}px`
    );
    this.style.setProperty(
      '--drawer-left-size',
      `${drawers.left.open ? drawers.left.size : 0}px`
    );
    this.style.setProperty(
      '--drawer-right-size',
      `${drawers.right.open ? drawers.right.size : 0}px`
    );
    this.style.setProperty(
      '--drawer-bottom-size',
      `${drawers.bottom.open ? drawers.bottom.size : 0}px`
    );
    this.style.setProperty(
      '--drawer-top-visibility',
      drawers.top.open ? 'visible' : 'hidden'
    );
    this.style.setProperty(
      '--drawer-left-visibility',
      drawers.left.open ? 'visible' : 'hidden'
    );
    this.style.setProperty(
      '--drawer-right-visibility',
      drawers.right.open ? 'visible' : 'hidden'
    );
    this.style.setProperty(
      '--drawer-bottom-visibility',
      drawers.bottom.open ? 'visible' : 'hidden'
    );
    this.style.setProperty(
      '--drawer-top-pointer',
      drawers.top.open ? 'auto' : 'none'
    );
    this.style.setProperty(
      '--drawer-left-pointer',
      drawers.left.open ? 'auto' : 'none'
    );
    this.style.setProperty(
      '--drawer-right-pointer',
      drawers.right.open ? 'auto' : 'none'
    );
    this.style.setProperty(
      '--drawer-bottom-pointer',
      drawers.bottom.open ? 'auto' : 'none'
    );
  }

  private resetSlotReplacementState() {
    const idleState: HostSlotReplacementStateWithEntry = { status: 'idle' };
    const nextState = { ...this.slotReplacementState };
    (['top', 'left', 'right', 'bottom'] as HostSlotName[]).forEach((slotName) => {
      this.slotLoadSequence[slotName] += 1;
      nextState[slotName] = idleState;
    });
    this.slotReplacementState = nextState;
  }

  private async loadBuilderUiSlots() {
    const registryResult = loadBuilderUiRegistry(getBuilderUiManifest());
    if (!registryResult.ok) {
      this.resetSlotReplacementState();
      return;
    }

    const { registry, boundary } = registryResult.snapshot;
    const entriesById = new Map(registry.entries.map((entry) => [entry.id, entry]));
    const slotReplacementOrder: HostSlotName[] = ['top', 'left', 'right', 'bottom'];
    const slotEntryMap: Partial<Record<HostSlotName, string>> = {
      top: `${BUILDER_UI_REGISTRY_BOUNDARY}toolbar`,
      left: `${BUILDER_UI_REGISTRY_BOUNDARY}left-drawer`,
      right: `${BUILDER_UI_REGISTRY_BOUNDARY}right-panel`,
      bottom: `${BUILDER_UI_REGISTRY_BOUNDARY}bottom-panel`,
    };

    this.resetSlotReplacementState();

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
      if (!tagName || !isValidSlotReplacementTagName(tagName)) {
        throw new Error(`Missing exported tag for ${entry.id}`);
      }
      if (globalThis.customElements && !globalThis.customElements.get(tagName)) {
        throw new Error(`Missing custom element definition for ${tagName}`);
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
    this.applyBuilderUiBootstrapEvent(envelope);
    if (this.applyPipelineEvent(envelope)) {
      return;
    }
    if (this.hostState.draftLock.locked && isDraftLockGuardedEvent(envelope.type)) {
      return;
    }
    const handler = hostEventHandlers[envelope.type];
    if (!handler) {
      return;
    }
    const prevState = this.hostState;
    const nextState = handler(this.hostState, envelope as never);
    this.commitHostState(envelope, nextState, prevState);
    this.persistArtifactsForEvent(envelope, nextState, prevState);
  }

  private commitHostState(
    envelope: HostEventEnvelope,
    nextState: HostState,
    prevState: HostState
  ) {
    if (nextState === prevState) {
      return;
    }
    this.hostState = nextState;
    this.emitObservationPacket(envelope, nextState, prevState);
    this.syncSharedSession(envelope, nextState);
  }

  private applyPipelineEvent(envelope: HostEventEnvelope) {
    switch (envelope.type) {
      case PIPELINE_TRIGGER: {
        this.sharedSession.triggerPipeline(envelope.payload.draftId);
        return true;
      }
      case PIPELINE_ABORT: {
        this.sharedSession.abortPipeline(envelope.payload.reason);
        return true;
      }
      case PIPELINE_PUBLISH: {
        const draftId = envelope.payload.draftId ?? this.hostState.draft.draftId;
        const draft =
          this.hostState.draft.draftId === draftId
            ? this.hostState.draft
            : this.draftStore.read();
        const compiled = compileDraftArtifact(draft, {
          compiledId: envelope.payload.compiledId,
          baseArtifact: this.hostState.artifact,
        });
        this.compiledStore.write(compiled, 'local');
        this.sharedSession.publishPipeline(compiled.compiledId);
        const nextState = {
          ...this.hostState,
          artifact: compiled,
        };
        this.commitHostState(envelope, nextState, this.hostState);
        return true;
      }
      default:
        return false;
    }
  }

  private applyBuilderUiBootstrapEvent(envelope: HostEventEnvelope) {
    switch (envelope.type) {
      case BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY: {
        const manifest = getBuilderUiManifest();
        const nextRegistry =
          envelope.payload.registry ??
          (manifest.activeRegistry === 'local' ? 'remote' : 'local');
        setBuilderUiManifest(switchBuilderUiRegistry(manifest, nextRegistry));
        void this.loadBuilderUiSlots();
        break;
      }
      case BUILDER_UI_BOOTSTRAP_PUBLISH: {
        const { version, tag, notes, publishedAt } = envelope.payload;
        const manifest = getBuilderUiManifest();
        setBuilderUiManifest(
          applyBuilderUiBootstrapFullClosure(manifest, version, {
            tag,
            notes,
            publishedAt: publishedAt ?? new Date().toISOString(),
          })
        );
        void this.loadBuilderUiSlots();
        break;
      }
      case BUILDER_UI_BOOTSTRAP_ROLLBACK: {
        const { version, reason, rolledBackAt } = envelope.payload;
        const manifest = getBuilderUiManifest();
        setBuilderUiManifest(
          rollbackBuilderUiBootstrapVersion(
            manifest,
            version,
            reason,
            rolledBackAt ?? new Date().toISOString()
          )
        );
        void this.loadBuilderUiSlots();
        break;
      }
      case BUILDER_UI_BOOTSTRAP_VERSION_PIN: {
        const manifest = getBuilderUiManifest();
        setBuilderUiManifest(
          pinBuilderUiBootstrapVersion(manifest, envelope.payload.versionPin)
        );
        void this.loadBuilderUiSlots();
        break;
      }
      default:
        break;
    }
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
      scale: nextState.ui.scale,
      drawers: nextState.ui.drawers,
    });
  }

  private persistArtifactsForEvent(
    event: HostEventEnvelope,
    nextState: HostState,
    prevState: HostState
  ) {
    if (
      (event.type === STYLER_UPDATE_PROP || event.type === BINDING_UPDATE_PROP) &&
      nextState.draft !== prevState.draft
    ) {
      this.draftStore.write(nextState.draft, 'local');
    }
  }

  private connectArtifactStores() {
    this.draftStore.connect();
    this.compiledStore.connect();
    this.hydrateArtifactsFromStorage();
    this.draftStoreUnsubscribe = this.draftStore.subscribe(
      this.handleDraftStoreUpdate
    );
    this.compiledStoreUnsubscribe = this.compiledStore.subscribe(
      this.handleCompiledStoreUpdate
    );
  }

  private disconnectArtifactStores() {
    this.draftStoreUnsubscribe?.();
    this.compiledStoreUnsubscribe?.();
    this.draftStoreUnsubscribe = undefined;
    this.compiledStoreUnsubscribe = undefined;
    this.draftStore.disconnect();
    this.compiledStore.disconnect();
  }

  private hydrateArtifactsFromStorage() {
    const draftSnapshot = this.draftStore.read();
    const compiledSnapshot = this.compiledStore.read();
    const nextDraft = draftSnapshot ?? this.hostState.draft;
    const nextArtifact = compiledSnapshot ?? this.hostState.artifact;
    const shouldUpdate =
      nextDraft !== this.hostState.draft || nextArtifact !== this.hostState.artifact;
    if (shouldUpdate) {
      this.hostState = {
        ...this.hostState,
        draft: nextDraft,
        artifact: nextArtifact,
      };
    }
    if (
      nextDraft.draftId !== this.sharedSession.state.draftId ||
      nextArtifact.compiledId !== this.sharedSession.state.compiledId
    ) {
      this.sharedSession.update({
        draftId: nextDraft.draftId,
        compiledId: nextArtifact.compiledId,
        compiled: {
          draftId: nextArtifact.draftId,
          compiledId: nextArtifact.compiledId,
        },
      });
    }
  }

  private handleDraftStoreUpdate = (
    snapshot: DraftArtifact,
    origin: 'local' | 'remote'
  ) => {
    if (origin !== 'remote') {
      return;
    }
    this.hostState = {
      ...this.hostState,
      draft: snapshot,
    };
    if (snapshot.draftId !== this.sharedSession.state.draftId) {
      this.sharedSession.update({ draftId: snapshot.draftId });
    }
  };

  private handleCompiledStoreUpdate = (
    snapshot: CompiledArtifact,
    origin: 'local' | 'remote'
  ) => {
    if (origin !== 'remote') {
      return;
    }
    this.hostState = {
      ...this.hostState,
      artifact: snapshot,
    };
    if (snapshot.compiledId !== this.sharedSession.state.compiledId) {
      this.sharedSession.update({
        compiledId: snapshot.compiledId,
        compiled: {
          draftId: snapshot.draftId,
          compiledId: snapshot.compiledId,
        },
      });
    }
  };
}

type HostEventHandlerMap = {
  [K in HostEventType]: (state: HostState, event: HostEventEnvelope<K>) => HostState;
};

const draftLockGuardedEvents = new Set<HostEventType>([
  STYLER_UPDATE_PROP,
  BINDING_UPDATE_PROP,
  'ghost.trigger',
]);

const isDraftLockGuardedEvent = (eventType: HostEventType) =>
  draftLockGuardedEvents.has(eventType);

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
  [UI_SET_SCALE]: (state, event) => {
    if (state.ui.scale === event.payload.scale) {
      return state;
    }
    const nextScale = Math.max(0.1, event.payload.scale);
    return {
      ...state,
      ui: { ...state.ui, scale: nextScale },
    };
  },
  [UI_DRAWER_OPEN]: (state, event) => {
    const drawer = event.payload.drawer as DrawerName;
    const current = state.ui.drawers[drawer];
    const size = event.payload.size ?? current.size;
    if (current.open && current.size === size) {
      return state;
    }
    return {
      ...state,
      ui: {
        ...state.ui,
        drawers: {
          ...state.ui.drawers,
          [drawer]: { open: true, size },
        },
      },
    };
  },
  [UI_DRAWER_CLOSE]: (state, event) => {
    const drawer = event.payload.drawer as DrawerName;
    const current = state.ui.drawers[drawer];
    if (!current.open) {
      return state;
    }
    return {
      ...state,
      ui: {
        ...state.ui,
        drawers: {
          ...state.ui.drawers,
          [drawer]: { ...current, open: false },
        },
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
  [BINDING_UPDATE_PROP]: (state, event) => {
    const normalizedPath = normalizeDraftBindingPath(event.payload.path);
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
      scale: session.scale ?? state.ui.scale,
      drawers: session.drawers ?? state.ui.drawers,
    };
    const nextDraftLock = session.draftLock ?? state.draftLock;

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
      draftLock: nextDraftLock,
    };
  },
  'session.state': (state, event) => {
    const nextDraftLock = event.payload.session.draftLock ?? state.draftLock;
    if (nextDraftLock === state.draftLock) {
      return state;
    }
    return {
      ...state,
      draftLock: nextDraftLock,
    };
  },
  'pipeline.state': (state) => state,
  [PIPELINE_TRIGGER]: (state) => state,
  [PIPELINE_ABORT]: (state) => state,
  [PIPELINE_PUBLISH]: (state) => state,
  'ghost.trigger': (state) => state,
  [WAREHOUSE_ADD_INTENT]: (state) => state,
  [WAREHOUSE_MOVE_INTENT]: (state) => state,
  [BUILDER_UI_BOOTSTRAP_TOGGLE_REGISTRY]: (state) => state,
  [BUILDER_UI_BOOTSTRAP_PUBLISH]: (state) => state,
  [BUILDER_UI_BOOTSTRAP_ROLLBACK]: (state) => state,
  [BUILDER_UI_BOOTSTRAP_VERSION_PIN]: (state) => state,
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
