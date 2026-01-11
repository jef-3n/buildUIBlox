import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  HOST_EVENT_ENVELOPE_EVENT,
  UI_SET_SCALE,
  createHostEventEnvelope,
} from '../../../contracts/event-envelope';

@customElement('builder-toolbar')
export class BuilderToolbar extends LitElement {
  @state()
  private scale = 1;

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

  render() {
    return html`
      <div class="title">Compiled Toolbar</div>
      <div class="actions">
        <button type="button">Insert</button>
        <button type="button">Preview</button>
        <button type="button">Publish</button>
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
