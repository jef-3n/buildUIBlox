import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CompiledArtifact, CompiledNode } from './compiled-canvas';
import type { DraftArtifact } from './draft-contract';
import { getNodeIdFromPath } from './paths';
import { getPathValue } from './path-edits';
import type { FrameName } from './frame-types';
import './selection-metadata';
import {
  BINDING_UPDATE_PROP,
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
    button {
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
  `;

  render() {
    const nodeId = this.getSelectionNode()?.id;
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
          ? html`<div class="fields">${bindingFields.map((field) => this.renderBindingField(nodeId, field))}</div>`
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
}

declare global {
  interface HTMLElementTagNameMap {
    'inspector-panel': InspectorPanel;
  }
}
