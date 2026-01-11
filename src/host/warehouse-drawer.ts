import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  HOST_EVENT_ENVELOPE_EVENT,
  WAREHOUSE_ADD_INTENT,
  WAREHOUSE_MOVE_INTENT,
  createHostEventEnvelope,
  type HostEventEnvelope,
} from '../contracts/event-envelope';

type WarehouseItemKind = 'primitive' | 'template';

type WarehouseItem = {
  id: string;
  label: string;
  kind: WarehouseItemKind;
  description: string;
};

const PRIMITIVES: WarehouseItem[] = [
  { id: 'primitive.text', label: 'Text', kind: 'primitive', description: 'Basic text node.' },
  { id: 'primitive.image', label: 'Image', kind: 'primitive', description: 'Responsive image.' },
  { id: 'primitive.section', label: 'Section', kind: 'primitive', description: 'Layout container.' },
  { id: 'primitive.button', label: 'Button', kind: 'primitive', description: 'Interactive button.' },
];

const TEMPLATES: WarehouseItem[] = [
  { id: 'template.hero', label: 'Hero', kind: 'template', description: 'Headline + supporting copy.' },
  { id: 'template.cardGrid', label: 'Card grid', kind: 'template', description: 'Repeater layout.' },
  { id: 'template.split', label: 'Split layout', kind: 'template', description: 'Two-column section.' },
];

@customElement('warehouse-drawer')
export class WarehouseDrawer extends LitElement {
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
      border-right: 1px solid #e2e8f0;
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

    .list {
      display: grid;
      gap: 10px;
    }

    .item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      align-items: center;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      background: #f8fafc;
    }

    .item h4 {
      margin: 0;
      font-size: 0.85rem;
      color: #1e293b;
    }

    .item p {
      margin: 2px 0 0;
      font-size: 0.75rem;
      color: #64748b;
    }

    .actions {
      display: grid;
      gap: 6px;
    }

    button {
      border: 1px solid #94a3b8;
      background: #ffffff;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 0.75rem;
      cursor: pointer;
    }

    button:hover {
      border-color: #64748b;
      background: #f1f5f9;
    }
  `;

  render() {
    return html`
      <section class="section">
        <h3>Primitives</h3>
        <div class="list">
          ${PRIMITIVES.map((item) => this.renderItem(item))}
        </div>
      </section>
      <section class="section">
        <h3>Templates</h3>
        <div class="list">
          ${TEMPLATES.map((item) => this.renderItem(item))}
        </div>
      </section>
    `;
  }

  private renderItem(item: WarehouseItem) {
    return html`
      <div class="item">
        <div>
          <h4>${item.label}</h4>
          <p>${item.description}</p>
        </div>
        <div class="actions">
          <button @click=${() => this.emitAddIntent(item)}>Add</button>
          <button @click=${() => this.emitMoveIntent(item)}>Move</button>
        </div>
      </div>
    `;
  }

  private emitAddIntent(item: WarehouseItem) {
    const envelope = createHostEventEnvelope(
      WAREHOUSE_ADD_INTENT,
      {
        itemId: item.id,
        label: item.label,
        kind: item.kind,
        target: 'canvas',
      },
      'warehouse-drawer'
    );
    this.dispatchEvent(
      new CustomEvent<HostEventEnvelope>(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }

  private emitMoveIntent(item: WarehouseItem) {
    const envelope = createHostEventEnvelope(
      WAREHOUSE_MOVE_INTENT,
      {
        itemId: item.id,
        label: item.label,
        kind: item.kind,
        from: 'warehouse',
        to: 'canvas',
      },
      'warehouse-drawer'
    );
    this.dispatchEvent(
      new CustomEvent<HostEventEnvelope>(HOST_EVENT_ENVELOPE_EVENT, {
        detail: envelope,
        bubbles: true,
        composed: true,
      })
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'warehouse-drawer': WarehouseDrawer;
  }
}
