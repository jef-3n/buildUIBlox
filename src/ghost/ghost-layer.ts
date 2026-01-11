import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { buildNodePath } from '../host/paths';
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
  action: GhostEditAction;
  hotspot: GhostHotspot;
  rect: DOMRect;
};

export type GhostEditAction = 'draw' | 'resize';

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

type GhostInteraction =
  | {
      kind: 'draw';
      id: string;
      start: { x: number; y: number };
    }
  | {
      kind: 'resize';
      id: string;
      handle: ResizeHandle;
      start: { x: number; y: number };
      rect: GhostRect;
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

    :host([draw-mode='true']) {
      cursor: crosshair;
    }

    :host([edit-mode='true']) .hotspot {
      cursor: default;
    }

    .handle {
      position: absolute;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #f97316;
      border: 1px solid #fff7ed;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
    }

    .handle[data-handle='nw'] {
      top: -6px;
      left: -6px;
      cursor: nwse-resize;
    }

    .handle[data-handle='ne'] {
      top: -6px;
      right: -6px;
      cursor: nesw-resize;
    }

    .handle[data-handle='sw'] {
      bottom: -6px;
      left: -6px;
      cursor: nesw-resize;
    }

    .handle[data-handle='se'] {
      bottom: -6px;
      right: -6px;
      cursor: nwse-resize;
    }
  `;

  @property({ attribute: false })
  ghostMap: GhostHotspot[] = [];

  @property({ type: Boolean, attribute: 'interaction-authority', reflect: true })
  interactionAuthority = true;

  @property({ type: Boolean, attribute: 'edit-mode', reflect: true })
  editMode = false;

  @property({ type: Boolean, attribute: 'draw-mode', reflect: true })
  drawMode = false;

  @property({ type: Number })
  scale = 1;

  @property({ type: String })
  activeFrame?: FrameName;

  @property({ type: String, attribute: false })
  selectedPath?: string;

  private hotspotById = new Map<string, GhostHotspot>();
  private activeInteraction?: GhostInteraction;
  private suppressClick = false;

  @state()
  private interactionRect?: GhostRect;

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
          const rect = this.getRenderRect(hotspot);
          const style = buildHotspotStyle(rect);

          return html`
            <div
              class="hotspot"
              data-hotspot-id=${hotspot.id}
              style=${style}
              @click=${this.handleHotspotClick}
              @pointerdown=${this.handleHotspotPointerDown}
            >
              ${this.editMode
                ? html`
                    <span class="handle" data-handle="nw"></span>
                    <span class="handle" data-handle="ne"></span>
                    <span class="handle" data-handle="sw"></span>
                    <span class="handle" data-handle="se"></span>
                  `
                : nothing}
            </div>
          `;
        }
      )}
      ${this.renderInteractionPreview()}
    `;
  }

  private handleHotspotClick(event: MouseEvent) {
    if (this.suppressClick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.suppressClick = false;
      return;
    }

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
    const path = hotspot.path ?? buildNodePath(hotspot.id);

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

    if (this.editMode || this.drawMode || event.altKey) {
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

  private renderInteractionPreview() {
    if (this.activeInteraction?.kind !== 'draw' || !this.interactionRect) {
      return nothing;
    }
    const style = buildHotspotStyle(this.interactionRect);
    return html`<div class="hotspot" style=${style}></div>`;
  }

  private handleHotspotPointerDown(event: PointerEvent) {
    if (!this.editMode || !this.interactionAuthority) {
      return;
    }
    const target = event.target as HTMLElement | null;
    const handle = target?.dataset.handle as ResizeHandle | undefined;
    if (!handle) {
      return;
    }
    const hotspotElement = target?.closest('.hotspot') as HTMLElement | null;
    const hotspotId = hotspotElement?.dataset.hotspotId;
    const hotspot = hotspotId ? this.hotspotById.get(hotspotId) : undefined;
    if (!hotspot) {
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    this.suppressClick = true;
    this.startInteraction(
      {
        kind: 'resize',
        id: hotspot.id,
        handle,
        start: this.getLocalPoint(event),
        rect: hotspot.rect,
      },
      event
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('pointerdown', this.handleLayerPointerDown);
  }

  disconnectedCallback() {
    this.removeEventListener('pointerdown', this.handleLayerPointerDown);
    this.endInteraction();
    super.disconnectedCallback();
  }

  private handleLayerPointerDown = (event: PointerEvent) => {
    if (!this.drawMode || !this.interactionAuthority) {
      return;
    }
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.hotspot')) {
      return;
    }
    event.preventDefault();
    this.suppressClick = true;
    const start = this.getLocalPoint(event);
    const id = `hotspot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    this.startInteraction({ kind: 'draw', id, start }, event);
  };

  private startInteraction(interaction: GhostInteraction, event: PointerEvent) {
    this.activeInteraction = interaction;
    this.interactionRect =
      interaction.kind === 'draw'
        ? { x: interaction.start.x, y: interaction.start.y, w: 0, h: 0 }
        : { ...interaction.rect };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('pointercancel', this.handlePointerUp);
  }

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.activeInteraction || !this.interactionRect) {
      return;
    }
    const point = this.getLocalPoint(event);
    const nextRect =
      this.activeInteraction.kind === 'draw'
        ? this.getDrawRect(this.activeInteraction.start, point)
        : this.getResizeRect(this.activeInteraction, point);
    this.interactionRect = nextRect;
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.activeInteraction || !this.interactionRect) {
      this.endInteraction();
      return;
    }
    const interaction = this.activeInteraction;
    const rect = this.interactionRect;
    this.emitEditEvent(interaction, rect);
    this.endInteraction();
    event.preventDefault();
  };

  private emitEditEvent(interaction: GhostInteraction, rect: GhostRect) {
    const minSize = 8;
    if (rect.w < minSize || rect.h < minSize) {
      return;
    }
    const existing = this.hotspotById.get(interaction.id);
    const hotspot: GhostHotspot = {
      ...(existing ?? { id: interaction.id, rect }),
      id: interaction.id,
      rect,
      path: existing?.path ?? this.selectedPath ?? buildNodePath(interaction.id),
      frame: existing?.frame ?? this.activeFrame,
      emitter: existing?.emitter,
      payload: existing?.payload,
    };
    const domRect = new DOMRect(rect.x, rect.y, rect.w, rect.h);
    const detail: GhostEditDetail = {
      action: interaction.kind === 'draw' ? 'draw' : 'resize',
      hotspot,
      rect: domRect,
    };
    this.dispatchEvent(
      new CustomEvent<GhostEditDetail>('GHOST_EDIT_ELEMENT', {
        detail,
        bubbles: true,
        composed: true,
      })
    );
  }

  private endInteraction() {
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('pointercancel', this.handlePointerUp);
    this.activeInteraction = undefined;
    this.interactionRect = undefined;
  }

  private getRenderRect(hotspot: GhostHotspot): GhostRect {
    if (this.activeInteraction?.id !== hotspot.id || !this.interactionRect) {
      return hotspot.rect;
    }
    return this.interactionRect;
  }

  private getLocalPoint(event: PointerEvent) {
    const rect = this.getBoundingClientRect();
    const styles = getComputedStyle(this);
    const paddingLeft = parseFloat(styles.paddingLeft || '0');
    const paddingTop = parseFloat(styles.paddingTop || '0');
    const x = (event.clientX - rect.left - paddingLeft) / this.scale;
    const y = (event.clientY - rect.top - paddingTop) / this.scale;
    return { x, y };
  }

  private getDrawRect(start: { x: number; y: number }, end: { x: number; y: number }) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    return { x, y, w, h };
  }

  private getResizeRect(interaction: Extract<GhostInteraction, { kind: 'resize' }>, point: { x: number; y: number }) {
    const { rect, handle } = interaction;
    let { x, y, w, h } = rect;
    const right = rect.x + rect.w;
    const bottom = rect.y + rect.h;
    switch (handle) {
      case 'nw':
        x = Math.min(point.x, right - 4);
        y = Math.min(point.y, bottom - 4);
        w = right - x;
        h = bottom - y;
        break;
      case 'ne':
        y = Math.min(point.y, bottom - 4);
        w = Math.max(point.x - rect.x, 4);
        h = bottom - y;
        break;
      case 'sw':
        x = Math.min(point.x, right - 4);
        w = right - x;
        h = Math.max(point.y - rect.y, 4);
        break;
      case 'se':
      default:
        w = Math.max(point.x - rect.x, 4);
        h = Math.max(point.y - rect.y, 4);
        break;
    }
    return { x, y, w, h };
  }
}
