import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import './compiled-canvas';
import { sampleCompiledArtifact } from './sample-compiled';

@customElement('nuwa-host')
export class NuwaHost extends LitElement {
  static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        'top top top'
        'left center right'
        'bottom bottom bottom';
      height: 100vh;
    }

    .drawer {
      display: flex;
    }

    .top {
      grid-area: top;
    }

    .left {
      grid-area: left;
    }

    .right {
      grid-area: right;
    }

    .bottom {
      grid-area: bottom;
    }

    .center {
      grid-area: center;
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 0;
      min-height: 0;
    }

    .stub {
      color: #6b7280;
      font-size: 0.875rem;
      padding: 0.5rem 0.75rem;
      border: 1px dashed #cbd5f5;
      border-radius: 6px;
      background: #f8fafc;
    }
  `;

  render() {
    return html`
      <div class="drawer top">
        <slot name="top"><div class="stub">Top drawer</div></slot>
      </div>
      <div class="drawer left">
        <slot name="left"><div class="stub">Left drawer</div></slot>
      </div>
      <main class="center">
        <slot>
          <compiled-canvas
            .artifact=${sampleCompiledArtifact}
            activeFrame="desktop"
          ></compiled-canvas>
        </slot>
      </main>
      <div class="drawer right">
        <slot name="right"><div class="stub">Right drawer</div></slot>
      </div>
      <div class="drawer bottom">
        <slot name="bottom"><div class="stub">Bottom drawer</div></slot>
      </div>
    `;
  }
}
