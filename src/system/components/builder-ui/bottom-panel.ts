import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  HOST_EVENT_ENVELOPE_EVENT,
  createHostEventEnvelope,
  type HostEventPayloadMap,
  type HostEventType,
} from '../../../contracts/event-envelope';
import '../../../host/telemetry-sniffer';

@customElement('builder-bottom-panel')
export class BuilderBottomPanel extends LitElement {
  @property({ type: String })
  activeFrame = '';

  @property({ type: String })
  selectionPath = '';

  @property({ type: String })
  compiledId = '';

  @property({ type: String })
  draftId = '';

  @state()
  private eventType: HostEventType = 'selection.set';

  @state()
  private eventPayload = '{\n  "path": "nodes.root"\n}';

  @state()
  private payloadError = '';

  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 12px;
      height: 100%;
      padding: 12px;
      box-sizing: border-box;
      background: #0f172a;
      color: #e2e8f0;
    }

    .sandbox {
      border: 1px solid #1e293b;
      border-radius: 10px;
      padding: 12px;
      background: #111827;
      display: grid;
      gap: 10px;
    }

    .sandbox h3 {
      margin: 0;
      font-size: 0.85rem;
      color: #93c5fd;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .row {
      display: grid;
      gap: 6px;
    }

    label {
      font-size: 0.7rem;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    select,
    textarea {
      font: inherit;
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 0.75rem;
    }

    textarea {
      min-height: 96px;
      resize: vertical;
      font-family: ui-monospace, 'SFMono-Regular', SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem;
    }

    button {
      justify-self: start;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    button:hover {
      border-color: #60a5fa;
    }

    .error {
      color: #f87171;
      font-size: 0.7rem;
    }
  `;

  render() {
    return html`
      <section class="sandbox">
        <h3>AI sandbox event emitter</h3>
        <div class="row">
          <label for="event-type">Event type</label>
          <select id="event-type" @change=${this.handleEventTypeChange}>
            ${this.renderEventOption('selection.set')}
            ${this.renderEventOption('ui.surface')}
            ${this.renderEventOption('ui.setFrame')}
            ${this.renderEventOption('binding.updateProp')}
            ${this.renderEventOption('styler.updateProp')}
            ${this.renderEventOption('pipeline.state')}
            ${this.renderEventOption('session.sync')}
          </select>
        </div>
        <div class="row">
          <label for="event-payload">Payload (JSON)</label>
          <textarea
            id="event-payload"
            .value=${this.eventPayload}
            @input=${this.handleEventPayloadInput}
          ></textarea>
        </div>
        ${this.payloadError ? html`<div class="error">${this.payloadError}</div>` : ''}
        <button @click=${this.handleEmitEnvelope}>Emit envelope</button>
      </section>
      <telemetry-sniffer
        .activeFrame=${this.activeFrame}
        .selectionPath=${this.selectionPath}
        .compiledId=${this.compiledId}
        .draftId=${this.draftId}
      ></telemetry-sniffer>
    `;
  }

  private handleEventTypeChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    this.eventType = target.value as HostEventType;
  }

  private handleEventPayloadInput(event: Event) {
    const target = event.currentTarget as HTMLTextAreaElement | null;
    if (!target) {
      return;
    }
    this.eventPayload = target.value;
    this.payloadError = '';
  }

  private handleEmitEnvelope() {
    const payloadText = this.eventPayload.trim();
    let payload: HostEventPayloadMap[HostEventType];
    if (!payloadText) {
      payload = {} as HostEventPayloadMap[HostEventType];
    } else {
      try {
        payload = JSON.parse(payloadText) as HostEventPayloadMap[HostEventType];
      } catch {
        this.payloadError = 'Payload must be valid JSON.';
        return;
      }
    }
    const envelope = createHostEventEnvelope(this.eventType, payload, 'builder-bottom-panel');
    this.dispatchEvent(
      new CustomEvent(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }

  private renderEventOption(type: HostEventType) {
    return html`
      <option value=${type} ?selected=${this.eventType === type}>${type}</option>
    `;
  }
}

export const elementTag = 'builder-bottom-panel';
export default elementTag;
