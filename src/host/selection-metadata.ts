import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getElementIdFromPath } from './paths';
import type { CompiledArtifact, CompiledFrame, CompiledNode, FrameName } from './compiled-canvas';

type MetadataItem = {
  label: string;
  value?: string;
};

const isCompiledArtifact = (artifact?: CompiledArtifact): artifact is CompiledArtifact => {
  return Boolean(artifact && artifact.schemaVersion === 'compiled.v1' && artifact.runtime);
};

const formatValue = (value?: string) => value ?? '—';

const buildMetadata = (
  nodeId: string,
  node: CompiledNode,
  frame?: CompiledFrame,
  activeFrame?: FrameName
): MetadataItem[] => {
  const placement = frame?.placements[nodeId];
  return [
    { label: 'Node ID', value: nodeId },
    { label: 'Type', value: node.type },
    { label: 'Tag', value: node.props?.tag },
    { label: 'Class', value: node.props?.className },
    { label: 'Text', value: node.props?.text },
    { label: 'Text path', value: node.props?.textPath },
    { label: 'Data path', value: node.props?.dataPath },
    { label: 'Template ID', value: node.props?.templateId },
    { label: `Grid area (${activeFrame ?? 'frame'})`, value: placement?.area },
  ];
};

@customElement('selection-metadata')
export class SelectionMetadata extends LitElement {
  @property({ attribute: false })
  artifact?: CompiledArtifact;

  @property({ type: String, attribute: false })
  selectedPath?: string;

  @property({ type: String })
  activeFrame: FrameName = 'desktop';

  static styles = css`
    :host {
      display: block;
      min-width: 240px;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .panel {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      background: #ffffff;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }

    h3 {
      margin: 0 0 12px 0;
      font-size: 0.95rem;
      color: #0f172a;
    }

    .empty {
      color: #64748b;
      font-size: 0.9rem;
    }

    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      margin: 0;
      font-size: 0.85rem;
    }

    dt {
      color: #475569;
      font-weight: 600;
    }

    dd {
      margin: 0;
      color: #0f172a;
      word-break: break-word;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #334155;
      font-size: 0.75rem;
    }
  `;

  render() {
    if (!isCompiledArtifact(this.artifact)) {
      return html`<div class="panel"><div class="empty">No compiled artifact loaded.</div></div>`;
    }

    if (!this.selectedPath) {
      return html`<div class="panel"><div class="empty">Select a node to see metadata.</div></div>`;
    }

    const nodeId = getElementIdFromPath(this.selectedPath);
    const node = this.artifact.runtime.nodes[nodeId];

    if (!node) {
      return html`<div class="panel"><div class="empty">Selection not found.</div></div>`;
    }

    const frame =
      this.artifact.runtime.layout.frames[this.activeFrame] ??
      this.artifact.runtime.layout.frames.desktop;

    const metadata = buildMetadata(nodeId, node, frame, this.activeFrame);

    return html`
      <div class="panel">
        <h3>Selection metadata</h3>
        <div class="pill">${this.activeFrame} frame</div>
        <dl>
          ${metadata.map(
            (item) => html`<dt>${item.label}</dt><dd>${formatValue(item.value)}</dd>`
          )}
        </dl>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'selection-metadata': SelectionMetadata;
  }
}
