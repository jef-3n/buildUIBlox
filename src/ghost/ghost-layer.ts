import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { buildElementPath } from '../host/paths';

export type GhostRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type GhostEmitter =
  | string
  | {
      type: string;
      payload?: unknown;
    };

export type GhostHotspot = {
  id: string;
  rect: GhostRect;
  emitter?: GhostEmitter;
  payload?: unknown;
  path?: string;
};

export type GhostSelectDetail = {
  path: string;
  rect?: DOMRect;
  hotspotId: string;
};

export type GhostTriggerDetail = {
  type: string;
  payload?: unknown;
  path: string;
  rect?: DOMRect;
  hotspotId: string;
};

@customElement('ghost-layer')
export class GhostLayer extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      padding: var(--frame-padding, 0px);
      box-sizing: border-box;
      pointer-events: auto;
      z-index: 9999;
    }

    :host([interaction-authority='false']) {
      pointer-events: none;
    }

    .hotspot {
      position: absolute;
      border: 1px dashed rgba(59, 130, 246, 0.8);
      background: rgba(59, 130, 246, 0.12);
      border-radius: 6px;
      box-sizing: border-box;
      cursor: pointer;
    }

    :host([interaction-authority='false']) .hotspot {
      cursor: default;
    }
  `;

  @property({ attribute: false })
  ghostMap: GhostHotspot[] = [];

  @property({ type: Boolean, attribute: 'interaction-authority', reflect: true })
  interactionAuthority = true;

  render() {
    return html`
      ${repeat(
        this.ghostMap,
        (hotspot) => hotspot.id,
        (hotspot) => {
          const style = {
            left: `${hotspot.rect.x}px`,
            top: `${hotspot.rect.y}px`,
            width: `${hotspot.rect.w}px`,
            height: `${hotspot.rect.h}px`,
          };

          return html`
            <div
              class="hotspot"
              style=${styleMap(style)}
              @click=${(event: MouseEvent) => this.handleHotspotClick(event, hotspot)}
            ></div>
          `;
        }
      )}
    `;
  }

  private handleHotspotClick(event: MouseEvent, hotspot: GhostHotspot) {
    if (!this.interactionAuthority) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();
    const path = hotspot.path ?? buildElementPath(hotspot.id);

    const selectionDetail: GhostSelectDetail = {
      path,
      rect,
      hotspotId: hotspot.id,
    };

    this.dispatchEvent(
      new CustomEvent<GhostSelectDetail>('GHOST_SELECT_ELEMENT', {
        detail: selectionDetail,
        bubbles: true,
        composed: true,
      })
    );

    if (!hotspot.emitter) {
      return;
    }

    const type = typeof hotspot.emitter === 'string' ? hotspot.emitter : hotspot.emitter.type;
    const payload =
      typeof hotspot.emitter === 'string' ? hotspot.payload : hotspot.emitter.payload;

    const triggerDetail: GhostTriggerDetail = {
      type,
      payload,
      path,
      rect,
      hotspotId: hotspot.id,
    };

    this.dispatchEvent(
      new CustomEvent<GhostTriggerDetail>('GHOST_HOTSPOT_TRIGGER', {
        detail: triggerDetail,
        bubbles: true,
        composed: true,
      })
    );
  }
}
