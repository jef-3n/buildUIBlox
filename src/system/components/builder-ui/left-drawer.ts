import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../../../host/warehouse-drawer';

@customElement('builder-left-drawer')
export class BuilderLeftDrawer extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }
  `;

  render() {
    return html`<warehouse-drawer></warehouse-drawer>`;
  }
}

export const elementTag = 'builder-left-drawer';
export default elementTag;
