import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
  HOST_EVENT_ENVELOPE_EVENT,
  PIPELINE_ABORT_BUILD,
  PIPELINE_PUBLISH_VERSION,
  PIPELINE_TRIGGER_BUILD,
  UI_SET_SCALE,
  createHostEventEnvelope,
  type HostEventPayloadMap,
} from '../../../contracts/event-envelope';

@customElement('builder-toolbar')
export class BuilderToolbar extends LitElement {
  @property({ type: String })
  draftId?: string;

  @property({ type: String })
  compiledId?: string;

  @state()
  private scale = 1;

  @state()
  private publishTag = '';

  @state()
  private publishNotes = '';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
    }

    .title {
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .control {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
    }

    label {
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-weight: 600;
    }

    button {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 0.3rem 0.55rem;
      font-size: 0.75rem;
      cursor: pointer;
    }

    button:hover {
      border-color: #64748b;
    }

    select {
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 0.25rem 0.4rem;
      font-size: 0.75rem;
    }

    input {
      background: #0f172a;
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 0.25rem 0.4rem;
      font-size: 0.7rem;
    }

    .pipeline {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .publish {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
  `;

  private handleScaleChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) {
      return;
    }
    const value = Number(target.value);
    if (Number.isNaN(value)) {
      return;
    }
    const nextScale = Math.min(5, Math.max(1, value));
    this.scale = nextScale;
    const envelope = createHostEventEnvelope(
      UI_SET_SCALE,
      { scale: nextScale },
      'builder-toolbar'
    );
    this.dispatchEvent(
      new CustomEvent(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }

  private emitPipelineEnvelope<
    T extends
      | typeof PIPELINE_TRIGGER_BUILD
      | typeof PIPELINE_ABORT_BUILD
      | typeof PIPELINE_PUBLISH_VERSION,
  >(type: T, payload: HostEventPayloadMap[T]) {
    const envelope = createHostEventEnvelope(type, payload, 'builder-toolbar');
    this.dispatchEvent(
      new CustomEvent(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }

  private handlePipelineTrigger() {
    if (!this.draftId) {
      return;
    }
    this.emitPipelineEnvelope(PIPELINE_TRIGGER_BUILD, { draftId: this.draftId });
  }

  private handlePipelineAbort() {
    this.emitPipelineEnvelope(PIPELINE_ABORT_BUILD, {});
  }

  private handlePublishTagChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }
    this.publishTag = target.value;
  }

  private handlePublishNotesChange(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) {
      return;
    }
    this.publishNotes = target.value;
  }

  private handlePipelinePublish() {
    const tag = this.publishTag.trim();
    if (!tag) {
      return;
    }
    const notes = this.publishNotes.trim();
    this.emitPipelineEnvelope(PIPELINE_PUBLISH_VERSION, {
      tag,
      notes: notes ? notes : undefined,
      draftId: this.draftId,
      compiledId: this.compiledId,
    });
  }

  render() {
    return html`
      <div class="title">Compiled Toolbar</div>
      <div class="actions">
        <button type="button">Insert</button>
        <button type="button">Preview</button>
        <button type="button">Publish</button>
      </div>
      <div class="pipeline">
        <button type="button" @click=${this.handlePipelineTrigger}>
          Trigger Build
        </button>
        <button type="button" @click=${this.handlePipelineAbort}>Abort</button>
        <div class="publish">
          <input
            type="text"
            placeholder="Tag"
            .value=${this.publishTag}
            @input=${this.handlePublishTagChange}
          />
          <input
            type="text"
            placeholder="Notes"
            .value=${this.publishNotes}
            @input=${this.handlePublishNotesChange}
          />
          <button type="button" @click=${this.handlePipelinePublish}>Publish</button>
        </div>
      </div>
      <div class="control">
        <label for="scale-select">Scale</label>
        <select id="scale-select" @change=${this.handleScaleChange}>
          ${[1, 2, 3, 4, 5].map(
            (value) => html`
              <option value=${value} ?selected=${this.scale === value}>
                ${value}x
              </option>
            `
          )}
        </select>
      </div>
    `;
  }
}

export const elementTag = 'builder-toolbar';
export default elementTag;
