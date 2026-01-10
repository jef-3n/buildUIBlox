import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('ghost-layer')
export class GhostLayer extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      pointer-events: auto;
      z-index: 9999;
    }
  `;

  render() {
    return html``;
  }
}
