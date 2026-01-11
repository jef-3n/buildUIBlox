import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { CompiledArtifact } from '../../../host/compiled-canvas';
import type { DraftArtifact } from '../../../host/draft-contract';
import type { FrameName } from '../../../host/frame-types';
import '../../../host/inspector-panel';

@customElement('builder-right-panel')
export class BuilderRightPanel extends LitElement {
  @property({ attribute: false })
  artifact?: CompiledArtifact;

  @property({ attribute: false })
  draft?: DraftArtifact;

  @property({ type: String, attribute: false })
  selectedPath?: string;

  @property({ type: String })
  activeFrame: FrameName = 'desktop';

  @property({ type: Boolean, attribute: 'ghost-edit-mode' })
  ghostEditMode = false;

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  render() {
    return html`
      <inspector-panel
        .artifact=${this.artifact}
        .draft=${this.draft}
        .selectedPath=${this.selectedPath}
        .activeFrame=${this.activeFrame}
        .ghostEditMode=${this.ghostEditMode}
      ></inspector-panel>
    `;
  }
}

export const elementTag = 'builder-right-panel';
export default elementTag;
