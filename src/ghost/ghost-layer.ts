import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { buildElementPath } from '../host/paths';
import type { FrameName } from '../host/frame-types';
import { buildHotspotStyle, type GhostRect } from './geometry';

export type GhostEmitter =
  | string
  | {
      type: string;
      payload?: unknown;
    };

export type GhostHotspot = {
  id: string;
  frame?: FrameName;
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

export type GhostEditDetail = {
  path: string;
  frame?: FrameName;
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

    :host([edit-mode='true']) .hotspot {
      border-color: rgba(249, 115, 22, 0.8);
      background: rgba(249, 115, 22, 0.12);
    }
  `;

  @property({ attribute: false })
  ghostMap: GhostHotspot[] = [];

  @property({ type: Boolean, attribute: 'interaction-authority', reflect: true })
  interactionAuthority = true;

  @property({ type: Boolean, attribute: 'edit-mode', reflect: true })
  editMode = false;

  private hotspotById = new Map<string, GhostHotspot>();

  protected willUpdate(changedProperties: Map<PropertyKey, unknown>) {
    if (changedProperties.has('ghostMap')) {
      this.hotspotById = new Map(this.ghostMap.map((hotspot) => [hotspot.id, hotspot]));
    }
  }

  render() {
    return html`
      ${repeat(
        this.ghostMap,
        (hotspot) => hotspot.id,
        (hotspot) => {
          const style = buildHotspotStyle(hotspot.rect);

          return html`
            <div
              class="hotspot"
              data-hotspot-id=${hotspot.id}
              style=${style}
              @click=${this.handleHotspotClick}
            ></div>
          `;
        }
      )}
    `;
  }

  private handleHotspotClick(event: MouseEvent) {
    if (!this.interactionAuthority) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    const hotspotId = target?.dataset.hotspotId;
    const hotspot = hotspotId ? this.hotspotById.get(hotspotId) : undefined;
    if (!hotspot) {
      return;
    }
    const rect = new DOMRect(
      hotspot.rect.x,
      hotspot.rect.y,
      hotspot.rect.w,
      hotspot.rect.h
    );
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

    if (this.editMode || event.altKey) {
      const editDetail: GhostEditDetail = {
        path,
        frame: hotspot.frame,
        rect,
        hotspotId: hotspot.id,
      };
      this.dispatchEvent(
        new CustomEvent<GhostEditDetail>('GHOST_EDIT_ELEMENT', {
          detail: editDetail,
          bubbles: true,
          composed: true,
        })
      );
      return;
    }

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
