import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('builder-toolbar')
export class BuilderToolbar extends LitElement {
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
  `;

  render() {
    return html`
      <div class="title">Compiled Toolbar</div>
      <div class="actions">
        <button type="button">Insert</button>
        <button type="button">Preview</button>
        <button type="button">Publish</button>
      </div>
    `;
  }
}

export const elementTag = 'builder-toolbar';
export default elementTag;
