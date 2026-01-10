import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('nuwa-host')
export class NuwaHost extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      grid-template-columns: auto 1fr auto;
      height: 100vh;
    }
  `;

  render() {
    return html`
      <slot name="top"></slot>
      <slot name="left"></slot>
      <main><slot></slot></main>
      <slot name="right"></slot>
      <slot name="bottom"></slot>
    `;
  }
}
