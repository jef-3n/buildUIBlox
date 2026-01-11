import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../../../host/telemetry-sniffer';

@customElement('builder-bottom-panel')
export class BuilderBottomPanel extends LitElement {
  @property({ type: String })
  activeFrame = '';

  @property({ type: String })
  selectionPath = '';

  @property({ type: String })
  compiledId = '';

  @property({ type: String })
  draftId = '';

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  render() {
    return html`
      <telemetry-sniffer
        .activeFrame=${this.activeFrame}
        .selectionPath=${this.selectionPath}
        .compiledId=${this.compiledId}
        .draftId=${this.draftId}
      ></telemetry-sniffer>
    `;
  }
}

export const elementTag = 'builder-bottom-panel';
export default elementTag;
