import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ObservationCategory, ObservationPacket } from './telemetry';
import {
  HOST_EVENT_ENVELOPE_EVENT,
  type HostEventEnvelope,
} from '../contracts/event-envelope';
import { resolveObservationCategory } from './observation';
import type { GlobalSessionPipelineState } from '../contracts/global-session';

@customElement('telemetry-sniffer')
export class TelemetrySniffer extends LitElement {
  @property({ type: String })
  activeFrame = '';

  @property({ type: String })
  selectionPath = '';

  @property({ type: String })
  compiledId = '';

  @property({ type: String })
  draftId = '';

  @state()
  private packets: ObservationPacket[] = [];

  @state()
  private envelopes: HostEventEnvelope[] = [];

  @state()
  private pipelineState: GlobalSessionPipelineState | null = null;

  private eventSequence = 0;

  private handleObservation = (event: Event) => {
    const detail = (event as CustomEvent<HostEventEnvelope>).detail;
    if (!detail) {
      return;
    }
    const packet: ObservationPacket = {
      id: detail.id,
      sequence: ++this.eventSequence,
      emittedAt: detail.createdAt,
      source: detail.source,
      category: resolveObservationCategory(detail),
      event: detail.type,
      payload: {},
    };
    this.packets = [packet, ...this.packets].slice(0, 12);
    this.envelopes = [detail, ...this.envelopes].slice(0, 6);
    if (detail.type === 'pipeline.state') {
      this.pipelineState = detail.payload.pipeline ?? null;
    }
  };

  connectedCallback() {
    super.connectedCallback();
    this.ownerDocument.addEventListener(HOST_EVENT_ENVELOPE_EVENT, this.handleObservation);
  }

  disconnectedCallback() {
    this.ownerDocument.removeEventListener(HOST_EVENT_ENVELOPE_EVENT, this.handleObservation);
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 0.85rem;
      color: #0f172a;
      width: 260px;
      padding: 12px;
      border-left: 1px solid #e2e8f0;
      background: #f8fafc;
      height: 100%;
      box-sizing: border-box;
    }

    .section {
      padding: 10px 12px;
      border-radius: 8px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      margin-bottom: 12px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
    }

    .section h3 {
      margin: 0 0 8px;
      font-size: 0.9rem;
      color: #1e293b;
    }

    .label {
      display: inline-block;
      min-width: 92px;
      font-weight: 600;
      color: #334155;
    }

    .value {
      color: #0f172a;
      word-break: break-word;
    }

    .packet-list {
      display: grid;
      gap: 8px;
      max-height: 320px;
      overflow: auto;
    }

    .packet {
      padding: 8px;
      border-radius: 6px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      font-family: 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.75rem;
      color: #1e293b;
    }

    .envelope {
      margin: 6px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 0.7rem;
      color: #0f172a;
    }

    .timestamp {
      font-size: 0.7rem;
      color: #64748b;
    }

    .empty {
      color: #94a3b8;
      font-style: italic;
    }
  `;

  render() {
    const latestPipeline = this.getLatestPacket(['pipeline', 'draft']);
    const latestSelection = this.getLatestPacket(['selection']);
    const envelopeSnapshot = this.envelopes[0];

    return html`
      <section class="section">
        <h3>Pipeline telemetry</h3>
        <div><span class="label">Frame</span><span class="value">${this.activeFrame}</span></div>
        <div><span class="label">Compiled</span><span class="value">${this.compiledId}</span></div>
        <div><span class="label">Draft</span><span class="value">${this.draftId}</span></div>
        <div>
          <span class="label">Status</span>
          <span class="value">${this.pipelineState?.status ?? 'idle'}</span>
        </div>
        <div>
          <span class="label">Pipeline IDs</span>
          <span class="value">
            ${this.pipelineState?.draftId ?? '—'} · ${this.pipelineState?.compiledId ?? '—'}
          </span>
        </div>
        <div>
          <span class="label">Last event</span>
          <span class="value">${latestPipeline?.event ?? '—'}</span>
        </div>
        <div class="timestamp">
          ${latestPipeline ? `Last update ${latestPipeline.emittedAt}` : 'No pipeline events yet.'}
        </div>
      </section>
      <section class="section">
        <h3>Selection telemetry</h3>
        <div>
          <span class="label">Path</span>
          <span class="value">${this.selectionPath || '—'}</span>
        </div>
        <div>
          <span class="label">Last event</span>
          <span class="value">${latestSelection?.event ?? '—'}</span>
        </div>
        <div class="timestamp">
          ${latestSelection ? `Last update ${latestSelection.emittedAt}` : 'No selection events yet.'}
        </div>
      </section>
      <section class="section">
        <h3>Root listener envelope</h3>
        ${envelopeSnapshot
          ? html`
              <div class="packet">
                <div>${envelopeSnapshot.type}</div>
                <div class="timestamp">${envelopeSnapshot.createdAt}</div>
                <pre class="envelope">${JSON.stringify(envelopeSnapshot, null, 2)}</pre>
              </div>
            `
          : html`<div class="empty">Waiting for standardized envelopes...</div>`}
      </section>
      <section class="section">
        <h3>Observation stream</h3>
        ${this.packets.length
          ? html`
              <div class="packet-list">
                ${this.packets.map(
                  (packet) => html`
                    <div class="packet">
                      <div>${packet.sequence}. ${packet.event}</div>
                      <div>${packet.category} · ${packet.id}</div>
                      <div class="timestamp">${packet.emittedAt}</div>
                    </div>
                  `
                )}
              </div>
            `
          : html`<div class="empty">Waiting for event packets...</div>`}
      </section>
    `;
  }

  private getLatestPacket(categories: ObservationCategory[]) {
    return this.packets.find((packet) => categories.includes(packet.category));
  }
}
