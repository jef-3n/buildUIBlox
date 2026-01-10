import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';

export type FrameName = 'desktop' | 'tablet' | 'mobile';

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
  };
  integrity: { sourceHash: string; compilerVersion: string };
};

const isCompiledArtifact = (artifact?: CompiledArtifact): artifact is CompiledArtifact => {
  return Boolean(artifact && artifact.schemaVersion === 'compiled.v1' && artifact.runtime);
};

const getPathValue = (data: unknown, path?: string) => {
  if (!data || !path) return undefined;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
};

const resolveStyler = (styler: CompiledNode['props'] extends { styler?: infer S } ? S : undefined, frame: FrameName) => {
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

    .frame {
      display: grid;
      width: 100%;
      height: 100%;
      gap: 16px;
      padding: 24px;
      box-sizing: border-box;
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
  `;

  @property({ attribute: false })
  artifact?: CompiledArtifact;

  @property({ type: String })
  activeFrame: FrameName = 'desktop';

  render() {
    if (!isCompiledArtifact(this.artifact)) {
      return html`<div class="empty-state">Compiled artifact required for runtime rendering.</div>`;
    }

    const frame =
      this.artifact.runtime.layout.frames[this.activeFrame] ??
      this.artifact.runtime.layout.frames.desktop;

    if (!frame) {
      return html`<div class="empty-state">No frame definition found for ${this.activeFrame}.</div>`;
    }

    const frameStyles = {
      gridTemplateColumns: frame.grid.columns,
      gridTemplateRows: frame.grid.rows,
      gridTemplateAreas: frame.grid.areas.join(' '),
    };

    return html`
      <style>${this.artifact.css}</style>
      <section class="frame" style=${styleMap(frameStyles)}>
        ${repeat(
          frame.order,
          (nodeId) => nodeId,
          (nodeId) => this.renderNode(nodeId, frame, this.artifact.runtime.data ?? {})
        )}
      </section>
    `;
  }

  private renderNode(nodeId: string, frame: CompiledFrame, dataContext: Record<string, unknown>) {
    const node = this.artifact?.runtime.nodes[nodeId];
    if (!node || node.type === 'template') {
      return nothing;
    }

    if (node.type === 'repeater') {
      return this.renderRepeater(nodeId, node, frame, dataContext);
    }

    const tag =
      node.props?.tag ??
      (node.type === 'text' ? 'span' : node.type === 'section' ? 'section' : 'div');
    const placement = frame.placements[nodeId];
    const style = {
      gridArea: placement?.area,
      ...resolveStyler(node.props?.styler, this.activeFrame),
    };

    const classes = classMap(
      node.props?.className ? { [node.props.className]: true } : {}
    );
    const tagName = unsafeStatic(tag);

    return staticHtml`
      <${tagName} class=${classes} style=${styleMap(style)}>
        ${this.renderContent(node, frame, dataContext)}
      </${tagName}>
    `;
  }

  private renderContent(node: CompiledNode, frame: CompiledFrame, dataContext: Record<string, unknown>) {
    if (node.type === 'text') {
      const boundText = getPathValue(dataContext, node.props?.textPath);
      return boundText ?? node.props?.text ?? '';
    }

    if (node.type === 'image') {
      return html`<img src=${node.props?.src ?? ''} alt=${node.props?.alt ?? ''} />`;
    }

    if (!node.children?.length) {
      return nothing;
    }

    return node.children.map((childId) => this.renderNode(childId, frame, dataContext));
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
    dataContext: Record<string, unknown>
  ) {
    const items =
      (Array.isArray(node.props?.items) && node.props?.items) ||
      (Array.isArray(getPathValue(dataContext, node.props?.dataPath))
        ? (getPathValue(dataContext, node.props?.dataPath) as unknown[])
        : []);
    const templateId = node.props?.templateId;
    const templateNode = templateId ? this.artifact?.runtime.nodes[templateId] : undefined;

    if (!templateId || !templateNode || templateNode.type !== 'template') {
      return html`<div class="empty-state">Repeater requires a compiled template.</div>`;
    }

    const placement = frame.placements[nodeId];
    const style = {
      gridArea: placement?.area,
      ...resolveStyler(node.props?.styler, this.activeFrame),
    };

    const classes = classMap(
      node.props?.className
        ? { repeater: true, [node.props.className]: true }
        : { repeater: true }
    );

    return html`
      <div class=${classes} style=${styleMap(style)}>
        ${repeat(
          items,
          (_item, index) => index,
          (item) => {
            const itemClasses = classMap(
              templateNode.props?.className
                ? { 'repeater-item': true, [templateNode.props.className]: true }
                : { 'repeater-item': true }
            );

            return html`
              <div class=${itemClasses}>
                ${templateNode.children?.map((childId) =>
                  this.renderNode(childId, frame, item as Record<string, unknown>)
                )}
              </div>
            `;
          }
        )}
      </div>
    `;
  }
}
