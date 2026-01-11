import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CompiledArtifact, CompiledNode } from './compiled-canvas';
import type { DraftArtifact } from './draft-contract';
import { getNodeIdFromPath } from './paths';
import { getPathValue } from './path-edits';
import type { FrameName } from './frame-types';
import './selection-metadata';
import type { GhostHotspot } from '../ghost/ghost-layer';
import {
  BINDING_UPDATE_PROP,
  GHOST_MAP_EDIT,
  HOST_EVENT_ENVELOPE_EVENT,
  STYLER_UPDATE_PROP,
  createHostEventEnvelope,
  type HostEventEnvelope,
  type HostEventPayloadMap,
  type HostEventType,
} from '../contracts/event-envelope';

type InspectorField = {
  label: string;
  key: string;
  placeholder?: string;
  inputType?: string;
};

type BindingTreeNode = {
  label: string;
  path: string;
  children?: BindingTreeNode[];
};

const styleFields: InspectorField[] = [
  { label: 'Text color', key: 'color', placeholder: '#0f172a' },
  { label: 'Background', key: 'backgroundColor', placeholder: '#ffffff' },
  { label: 'Font size', key: 'fontSize', placeholder: '16px' },
  { label: 'Padding', key: 'padding', placeholder: '12px 16px' },
];

const bindingFields: InspectorField[] = [
  { label: 'Text path', key: 'textPath', placeholder: 'data.title' },
  { label: 'Data path', key: 'dataPath', placeholder: 'data.items' },
  { label: 'Template ID', key: 'templateId', placeholder: 'template-card' },
];

const bindingTree: BindingTreeNode[] = [
  {
    label: 'data',
    path: 'data',
    children: [
      { label: 'title', path: 'data.title' },
      { label: 'subtitle', path: 'data.subtitle' },
      {
        label: 'items',
        path: 'data.items',
        children: [
          { label: 'name', path: 'data.items[].name' },
          { label: 'price', path: 'data.items[].price' },
        ],
      },
    ],
  },
  {
    label: 'session',
    path: 'session',
    children: [
      { label: 'user.name', path: 'session.user.name' },
      { label: 'user.email', path: 'session.user.email' },
    ],
  },
];

@customElement('inspector-panel')
export class InspectorPanel extends LitElement {
  @property({ attribute: false })
  artifact?: CompiledArtifact;

  @property({ attribute: false })
  draft?: DraftArtifact;

  @property({ type: String, attribute: false })
  selectedPath?: string;

  @property({ type: String })
  activeFrame: FrameName = 'desktop';

  @property({ type: Boolean, attribute: 'ghost-edit-mode' })
  ghostEditMode = false;

  @property({ type: Boolean, attribute: 'ghost-draw-mode' })
  ghostDrawMode = false;

  @state()
  private selectedHotspotId?: string;

  @state()
  private emitterType = '';

  @state()
  private emitterPayload = '';

  @state()
  private payloadError?: string;

  @state()
  private bindingTarget = bindingFields[0]?.key ?? 'textPath';

  @state()
  private bindingPath = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      height: 100%;
      padding: 16px;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
      background: #f8fafc;
      border-left: 1px solid #e2e8f0;
    }

    h3 {
      margin: 0 0 8px;
      font-size: 0.9rem;
      color: #0f172a;
    }

    .section {
      background: #ffffff;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      padding: 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }

    .fields {
      display: grid;
      gap: 10px;
    }

    label {
      display: grid;
      gap: 4px;
      font-size: 0.75rem;
      color: #475569;
    }

    input,
    button,
    select,
    textarea {
      font: inherit;
    }

    input {
      border: 1px solid #cbd5f5;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 0.85rem;
      background: #f8fafc;
    }

    input:focus {
      outline: 2px solid rgba(59, 130, 246, 0.35);
      border-color: #93c5fd;
      background: #ffffff;
    }

    select,
    textarea {
      border: 1px solid #cbd5f5;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 0.85rem;
      background: #f8fafc;
    }

    textarea {
      min-height: 80px;
      resize: vertical;
      font-family: ui-monospace, 'SFMono-Regular', SFMono-Regular, Menlo, monospace;
      font-size: 0.8rem;
    }

    button {
      border: 1px solid #cbd5f5;
      border-radius: 6px;
      padding: 6px 10px;
      background: #ffffff;
      cursor: pointer;
    }

    button:hover {
      background: #f1f5f9;
    }

    .ghost-toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.85rem;
      color: #1e293b;
      gap: 8px;
    }

    .ghost-toggle input {
      width: 18px;
      height: 18px;
    }

    .empty {
      color: #64748b;
      font-size: 0.85rem;
    }

    .error {
      color: #b91c1c;
      font-size: 0.75rem;
    }

    .binding-picker {
      display: grid;
      gap: 8px;
      margin-top: 12px;
      border-top: 1px dashed #e2e8f0;
      padding-top: 12px;
    }

    .binding-tree {
      display: grid;
      gap: 4px;
      padding-left: 8px;
    }

    .binding-node {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #0f172a;
    }

    .binding-node button {
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      color: inherit;
    }

    .binding-node button:hover {
      background: #f1f5f9;
    }

    .binding-node button.selected {
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 600;
    }

    .binding-meta {
      font-size: 0.7rem;
      color: #94a3b8;
    }
  `;

  render() {
    const nodeId = this.getSelectionNode()?.id;
    const ghostMap = this.getGhostMap();
    const activeHotspot = this.getActiveHotspot();
    return html`
      <selection-metadata
        .artifact=${this.artifact}
        .selectedPath=${this.selectedPath}
        .activeFrame=${this.activeFrame}
      ></selection-metadata>
      <section class="section">
        <h3>Styler controls</h3>
        ${nodeId
          ? html`<div class="fields">${styleFields.map((field) => this.renderStylerField(nodeId, field))}</div>`
          : html`<div class="empty">Select a node to edit styles.</div>`}
      </section>
      <section class="section">
        <h3>Binding controls</h3>
        ${nodeId
          ? html`
              <div class="fields">
                ${bindingFields.map((field) => this.renderBindingField(nodeId, field))}
              </div>
              <div class="binding-picker">
                <label>
                  <span>Binding target</span>
                  <select @change=${this.handleBindingTargetChange}>
                    ${bindingFields.map(
                      (field) => html`
                        <option
                          value=${field.key}
                          ?selected=${this.bindingTarget === field.key}
                        >
                          ${field.label}
                        </option>
                      `
                    )}
                  </select>
                </label>
                <div class="binding-meta">
                  Pick a stubbed data path to emit a binding update event.
                </div>
                <div class="binding-tree">
                  ${bindingTree.map((node) => this.renderBindingTreeNode(node))}
                </div>
                <button
                  @click=${() => this.handleBindingPathApply(nodeId)}
                  ?disabled=${!this.bindingPath}
                >
                  Apply binding path
                </button>
              </div>
            `
          : html`<div class="empty">Select a node to edit bindings.</div>`}
      </section>
      <section class="section">
        <h3>Ghost edit mode</h3>
        <label class="ghost-toggle">
          <span>Enable hotspot sizing edits</span>
          <input
            type="checkbox"
            .checked=${this.ghostEditMode}
            @change=${this.handleGhostToggle}
          />
        </label>
        <label class="ghost-toggle">
          <span>Enable hotspot drawing</span>
          <input
            type="checkbox"
            .checked=${this.ghostDrawMode}
            @change=${this.handleGhostDrawToggle}
          />
        </label>
      </section>
      <section class="section">
        <h3>Hotspot emitters</h3>
        ${ghostMap.length
          ? html`
              <div class="fields">
                <label>
                  <span>Hotspot</span>
                  <select @change=${this.handleHotspotSelection}>
                    ${ghostMap.map(
                      (hotspot) => html`
                        <option
                          value=${hotspot.id}
                          ?selected=${this.selectedHotspotId === hotspot.id}
                        >
                          ${hotspot.id}
                        </option>
                      `
                    )}
                  </select>
                </label>
                <label>
                  <span>Emitter type</span>
                  <input
                    type="text"
                    .value=${this.emitterType}
                    placeholder="OPEN_PANEL"
                    @input=${this.handleEmitterTypeInput}
                  />
                </label>
                <label>
                  <span>Emitter payload (JSON)</span>
                  <textarea
                    placeholder='{"key":"value"}'
                    .value=${this.emitterPayload}
                    @input=${this.handleEmitterPayloadInput}
                  ></textarea>
                </label>
                ${this.payloadError ? html`<div class="error">${this.payloadError}</div>` : ''}
                <button @click=${this.handleEmitterApply} ?disabled=${!activeHotspot}>
                  Apply hotspot updates
                </button>
              </div>
            `
          : html`<div class="empty">No hotspots available for this frame.</div>`}
      </section>
    `;
  }

  private renderStylerField(nodeId: string, field: InspectorField) {
    const path = `nodes.${nodeId}.props.styler.${field.key}`;
    const value = getPathValue(this.draft, path);
    return html`
      <label>
        <span>${field.label}</span>
        <input
          type=${field.inputType ?? 'text'}
          .value=${value == null ? '' : String(value)}
          placeholder=${field.placeholder ?? ''}
          @change=${(event: Event) => this.handleValueChange(event, STYLER_UPDATE_PROP, path)}
        />
      </label>
    `;
  }

  private renderBindingField(nodeId: string, field: InspectorField) {
    const path = `nodes.${nodeId}.props.bindings.${field.key}`;
    const value = getPathValue(this.draft, path);
    return html`
      <label>
        <span>${field.label}</span>
        <input
          type=${field.inputType ?? 'text'}
          .value=${value == null ? '' : String(value)}
          placeholder=${field.placeholder ?? ''}
          @change=${(event: Event) => this.handleValueChange(event, BINDING_UPDATE_PROP, path)}
        />
      </label>
    `;
  }

  private handleValueChange<T extends HostEventType>(
    event: Event,
    type: T,
    path: string
  ) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }
    const value = target.value;
    const payload = { path, value } as HostEventPayloadMap[T];
    this.emitHostEvent(type, payload);
  }

  private handleGhostToggle(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('INSPECTOR_GHOST_EDIT_TOGGLE', {
        detail: { enabled: target.checked },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleGhostDrawToggle(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent('INSPECTOR_GHOST_DRAW_TOGGLE', {
        detail: { enabled: target.checked },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleHotspotSelection(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    const hotspot = this.getGhostMap().find((entry) => entry.id === target.value);
    if (hotspot) {
      this.setActiveHotspot(hotspot);
    }
  }

  private handleEmitterTypeInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }
    this.emitterType = target.value;
    this.payloadError = undefined;
  }

  private handleEmitterPayloadInput(event: Event) {
    const target = event.currentTarget as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.emitterPayload = target.value;
    this.payloadError = undefined;
  }

  private handleEmitterApply() {
    const hotspot = this.getActiveHotspot();
    if (!hotspot) {
      return;
    }
    const emitterType = this.emitterType.trim();
    const payloadText = this.emitterPayload.trim();
    if (!emitterType && payloadText) {
      this.payloadError = 'Provide an emitter type before adding payload JSON.';
      return;
    }
    let parsedPayload: unknown = undefined;
    if (payloadText) {
      try {
        parsedPayload = JSON.parse(payloadText);
      } catch {
        this.payloadError = 'Payload must be valid JSON.';
        return;
      }
    }
    const emitter =
      emitterType && parsedPayload !== undefined
        ? { type: emitterType, payload: parsedPayload }
        : emitterType || undefined;
    const rect = new DOMRect(
      hotspot.rect.x,
      hotspot.rect.y,
      hotspot.rect.w,
      hotspot.rect.h
    );
    const payload: HostEventPayloadMap[typeof GHOST_MAP_EDIT] = {
      action: 'update',
      hotspot: {
        id: hotspot.id,
        rect,
        path: hotspot.path,
        frame: hotspot.frame,
        emitter,
        payload: emitter ? undefined : parsedPayload,
      },
    };
    this.emitHostEvent(GHOST_MAP_EDIT, payload);
  }

  private handleBindingTargetChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this.bindingTarget = target.value;
  }

  private handleBindingPathSelect(path: string) {
    this.bindingPath = path;
  }

  private handleBindingPathApply(nodeId: string) {
    if (!this.bindingPath) {
      return;
    }
    const path = `nodes.${nodeId}.props.bindings.${this.bindingTarget}`;
    this.emitHostEvent(BINDING_UPDATE_PROP, { path, value: this.bindingPath });
  }

  private emitHostEvent<T extends HostEventType>(
    type: T,
    payload: HostEventPayloadMap[T]
  ) {
    const envelope = createHostEventEnvelope(type, payload, 'inspector-panel');
    this.dispatchEvent(
      new CustomEvent<HostEventEnvelope>(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderBindingTreeNode(node: BindingTreeNode) {
    const isSelected = this.bindingPath === node.path;
    return html`
      <div class="binding-node">
        <button
          class=${isSelected ? 'selected' : ''}
          type="button"
          @click=${() => this.handleBindingPathSelect(node.path)}
        >
          ${node.label}
        </button>
      </div>
      ${node.children?.length
        ? html`<div class="binding-tree">
            ${node.children.map((child) => this.renderBindingTreeNode(child))}
          </div>`
        : ''}
    `;
  }

  private getSelectionNode(): { id: string; node: CompiledNode } | null {
    if (!this.selectedPath || !this.artifact) {
      return null;
    }
    const id = getNodeIdFromPath(this.selectedPath);
    const node = this.artifact.runtime.nodes[id];
    if (!node) {
      return null;
    }
    return { id, node };
  }

  protected updated(changedProperties: Map<PropertyKey, unknown>) {
    if (
      changedProperties.has('selectedPath') ||
      changedProperties.has('activeFrame') ||
      changedProperties.has('artifact') ||
      changedProperties.has('draft')
    ) {
      this.syncActiveHotspot();
    }
  }

  private getGhostMap(): GhostHotspot[] {
    const ghostMap = this.draft?.assets?.ghostMap ?? this.artifact?.runtime?.ghostMap ?? [];
    return ghostMap.filter(
      (hotspot) => !hotspot.frame || hotspot.frame === this.activeFrame
    );
  }

  private getActiveHotspot(): GhostHotspot | undefined {
    if (!this.selectedHotspotId) {
      return undefined;
    }
    return this.getGhostMap().find((entry) => entry.id === this.selectedHotspotId);
  }

  private syncActiveHotspot() {
    const ghostMap = this.getGhostMap();
    if (!ghostMap.length) {
      this.selectedHotspotId = undefined;
      this.emitterType = '';
      this.emitterPayload = '';
      return;
    }
    const fromSelection = this.selectedPath
      ? ghostMap.find((entry) => entry.path === this.selectedPath)
      : undefined;
    const current =
      this.selectedHotspotId &&
      ghostMap.find((entry) => entry.id === this.selectedHotspotId);
    const next = fromSelection ?? current ?? ghostMap[0];
    if (!next) {
      return;
    }
    this.setActiveHotspot(next);
  }

  private setActiveHotspot(hotspot: GhostHotspot) {
    this.selectedHotspotId = hotspot.id;
    const { emitter, payload } = hotspot;
    if (typeof emitter === 'string') {
      this.emitterType = emitter;
      this.emitterPayload =
        payload === undefined ? '' : JSON.stringify(payload, null, 2);
    } else if (emitter) {
      this.emitterType = emitter.type;
      this.emitterPayload =
        emitter.payload === undefined ? '' : JSON.stringify(emitter.payload, null, 2);
    } else {
      this.emitterType = '';
      this.emitterPayload = '';
    }
    this.payloadError = undefined;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'inspector-panel': InspectorPanel;
  }
}
