import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import '../ghost/ghost-layer';
import type { GhostHotspot, GhostSelectDetail, GhostTriggerDetail } from '../ghost/ghost-layer';
import { getElementIdFromPath } from './paths';
import { getPathValue } from './path-edits';
import type { FrameName } from './frame-types';

type StyleValue = string | number;

export type CompiledNode = {
  type: string;
  props?: {
    text?: string;
    textPath?: string;
    tag?: string;
    src?: string;
    alt?: string;
    className?: string;
    styler?: Record<string, StyleValue | Record<string, Record<string, StyleValue>>>;
    items?: unknown[];
    dataPath?: string;
    templateId?: string;
  };
  children?: string[];
};

export type CompiledFrame = {
  grid: {
    columns: string;
    rows: string;
    areas: string[];
  };
  order: string[];
  placements: Record<string, { area?: string }>;
};

export type CompiledArtifact = {
  schemaVersion: 'compiled.v1';
  compiledId: string;
  draftId: string;
  appId: string;
  compiledAt: string;
  css: string;
  runtime: {
    nodes: Record<string, CompiledNode>;
    layout: {
      frames: Partial<Record<FrameName, CompiledFrame>>;
    };
    data?: Record<string, unknown>;
    ghostMap?: GhostHotspot[];
  };
  integrity: { sourceHash: string; compilerVersion: string };
};

type GhostSelectionEventDetail = GhostSelectDetail & { source: 'ghost' };
type GhostTriggerEventEnvelope = GhostTriggerDetail & { source: 'ghost' };

const isCompiledArtifact = (artifact?: CompiledArtifact): artifact is CompiledArtifact => {
  return Boolean(artifact && artifact.schemaVersion === 'compiled.v1' && artifact.runtime);
};

const resolveStyler = (
  styler: CompiledNode['props'] extends { styler?: infer S } ? S : undefined,
  frame: FrameName
) => {
  if (!styler) return {};
  const { frames, ...base } = styler as Record<string, StyleValue | Record<string, Record<string, StyleValue>>> & {
    frames?: Record<string, Record<string, StyleValue>>;
  };
  const frameStyles = frames?.[frame] ?? {};
  return { ...base, ...frameStyles } as Record<string, StyleValue>;
};

@customElement('compiled-canvas')
export class CompiledCanvas extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .frame-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      padding: var(--frame-padding, 24px);
      box-sizing: border-box;
    }

    .frame {
      display: grid;
      width: 100%;
      height: 100%;
      gap: 16px;
    }

    .empty-state {
      border: 1px dashed #cbd5f5;
      border-radius: 8px;
      padding: 16px;
      background: #f8fafc;
      color: #64748b;
      font-size: 0.95rem;
    }

    .repeater {
      display: grid;
      gap: 12px;
    }

    .repeater-item {
      display: grid;
      gap: 8px;
    }

    .selected {
      outline: 2px solid rgba(59, 130, 246, 0.9);
      outline-offset: 2px;
    }
  `;

  @property({ attribute: false })
  artifact?: CompiledArtifact;

  @property({ type: String })
  activeFrame: FrameName = 'desktop';

  @property({ type: Boolean, attribute: 'ghost-authority' })
  ghostAuthority = true;

  @property({ type: String, attribute: false })
  selectedPath?: string;

  render() {
    if (!isCompiledArtifact(this.artifact)) {
      return html`<div class="empty-state">Compiled artifact required for runtime rendering.</div>`;
    }

    const resolvedFrameName = this.artifact.runtime.layout.frames[this.activeFrame]
      ? this.activeFrame
      : 'desktop';
    const frame = this.artifact.runtime.layout.frames[resolvedFrameName];

    if (!frame) {
      return html`<div class="empty-state">No frame definition found for ${this.activeFrame}.</div>`;
    }

    const frameStyles = {
      gridTemplateColumns: frame.grid.columns,
      gridTemplateRows: frame.grid.rows,
      gridTemplateAreas: frame.grid.areas.join(' '),
    };

    const ghostMap = (this.artifact.runtime.ghostMap ?? []).filter(
      (hotspot) => !hotspot.frame || hotspot.frame === resolvedFrameName
    );

    return html`
      <style>${this.artifact.css}</style>
      <div class="frame-wrapper">
        <section class="frame" style=${styleMap(frameStyles)}>
          ${repeat(
            frame.order,
            (nodeId) => nodeId,
            (nodeId) =>
              this.renderNode(nodeId, frame, this.artifact.runtime.data ?? {}, resolvedFrameName)
          )}
        </section>
        <ghost-layer
          .ghostMap=${ghostMap}
          .interactionAuthority=${this.ghostAuthority}
          @GHOST_SELECT_ELEMENT=${this.handleGhostSelection}
          @GHOST_HOTSPOT_TRIGGER=${this.handleGhostTrigger}
        ></ghost-layer>
      </div>
    `;
  }

  private renderNode(
    nodeId: string,
    frame: CompiledFrame,
    dataContext: Record<string, unknown>,
    frameName: FrameName
  ) {
    const node = this.artifact?.runtime.nodes[nodeId];
    if (!node || node.type === 'template') {
      return nothing;
    }

    if (node.type === 'repeater') {
      return this.renderRepeater(nodeId, node, frame, dataContext, frameName);
    }

    const placement = frame.placements[nodeId];
    const style = {
      gridArea: placement?.area,
      ...resolveStyler(node.props?.styler, frameName),
    };

    const classes = classMap(
      node.props?.className
        ? { [node.props.className]: true, selected: this.isSelected(nodeId) }
        : { selected: this.isSelected(nodeId) }
    );
    if (node.type === 'image') {
      return html`
        <img
          class=${classes}
          style=${styleMap(style)}
          src=${node.props?.src ?? ''}
          alt=${node.props?.alt ?? ''}
        />
      `;
    }

    const tag =
      node.props?.tag ??
      (node.type === 'text' ? 'span' : node.type === 'section' ? 'section' : 'div');
    const tagName = unsafeStatic(tag);

    return staticHtml`
      <${tagName} class=${classes} style=${styleMap(style)}>
        ${this.renderContent(node, frame, dataContext, frameName)}
      </${tagName}>
    `;
  }

  private renderContent(
    node: CompiledNode,
    frame: CompiledFrame,
    dataContext: Record<string, unknown>,
    frameName: FrameName
  ) {
    if (node.type === 'text') {
      const boundText = getPathValue(dataContext, node.props?.textPath);
      return boundText ?? node.props?.text ?? '';
    }

    if (!node.children?.length) {
      return nothing;
    }

    return node.children.map((childId) => this.renderNode(childId, frame, dataContext, frameName));
  }

  /**
   * Repeater expansion rules (compiled runtime only):
   * 1. Resolve data source from `items` or `dataPath` (paths read from runtime.data).
   * 2. Require a `templateId` that points at a node of type `template`.
   * 3. Clone the template subtree per item while keeping node IDs stable.
   * 4. Bind item data via `textPath` lookups inside the template tree.
   */
  private renderRepeater(
    nodeId: string,
    node: CompiledNode,
    frame: CompiledFrame,
    dataContext: Record<string, unknown>,
    frameName: FrameName
  ) {
    const dataItems = getPathValue(dataContext, node.props?.dataPath);
    const items =
      (Array.isArray(node.props?.items) && node.props?.items) ||
      (Array.isArray(dataItems) ? (dataItems as unknown[]) : []);
    const templateId = node.props?.templateId;
    const templateNode = templateId ? this.artifact?.runtime.nodes[templateId] : undefined;

    if (!templateId || !templateNode || templateNode.type !== 'template') {
      return html`<div class="empty-state">Repeater requires a compiled template.</div>`;
    }

    const placement = frame.placements[nodeId];
    const style = {
      gridArea: placement?.area,
      ...resolveStyler(node.props?.styler, frameName),
    };

    const classes = classMap(
      node.props?.className
        ? { repeater: true, [node.props.className]: true }
        : { repeater: true }
    );
    const itemClasses = classMap(
      templateNode.props?.className
        ? { 'repeater-item': true, [templateNode.props.className]: true }
        : { 'repeater-item': true }
    );
    const itemStyle = resolveStyler(templateNode.props?.styler, this.activeFrame);
    const templateTag = templateNode.props?.tag ?? 'div';
    const templateTagName = unsafeStatic(templateTag);
    const templateChildren = templateNode.children ?? [];

    return html`
      <div class=${classes} style=${styleMap(style)}>
        ${repeat(
          items,
          (_item, index) => index,
          (item) => {
            return staticHtml`
              <${templateTagName} class=${itemClasses} style=${styleMap(itemStyle)}>
                ${templateChildren.map((childId) =>
                  this.renderNode(childId, frame, item as Record<string, unknown>, frameName)
                )}
              </${templateTagName}>
            `;
          }
        )}
      </div>
    `;
  }

  private isSelected(nodeId: string) {
    if (!this.selectedPath) return false;
    return getElementIdFromPath(this.selectedPath) === nodeId;
  }

  private handleGhostSelection(event: CustomEvent<GhostSelectDetail>) {
    event.stopPropagation();
    if (!this.ghostAuthority) {
      return;
    }
    const { path, rect, hotspotId } = event.detail;
    if (path) {
      this.dispatchEvent(
        new CustomEvent<GhostSelectionEventDetail>('SELECTION_SET', {
          detail: { path, rect, hotspotId, source: 'ghost' },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  private handleGhostTrigger(event: CustomEvent<GhostTriggerDetail>) {
    event.stopPropagation();
    if (!this.ghostAuthority) {
      return;
    }
    const { type, payload, path, rect, hotspotId } = event.detail;
    this.dispatchEvent(
      new CustomEvent<GhostTriggerEventEnvelope>('GHOST_HOTSPOT_TRIGGER', {
        detail: { type, payload, path, rect, hotspotId, source: 'ghost' },
        bubbles: true,
        composed: true,
      })
    );
  }
}
