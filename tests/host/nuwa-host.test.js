import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createObservationPacket } from '../../dist-tests/host/observation.js';
import { COMPILED_SCHEMA_VERSION } from '../../dist-tests/host/compiled-canvas.js';

describe('nuwa-host observation protocol', () => {
  it('emits pipeline packets with deterministic payload fields', () => {
    const prevState = {
      ui: { activeFrame: 'desktop', activeSurface: 'canvas' },
      selection: { path: undefined },
      selectionsByFrame: { desktop: undefined, tablet: undefined, mobile: undefined },
      artifact: {
        schemaVersion: COMPILED_SCHEMA_VERSION,
        compiledId: 'compiled-1',
        draftId: 'draft-1',
        appId: 'app-1',
        compiledAt: new Date().toISOString(),
        css: '',
        runtime: {
          layout: {
            frames: {
              desktop: { grid: { columns: '', rows: '', areas: [] }, placements: {}, order: [] },
              tablet: { grid: { columns: '', rows: '', areas: [] }, placements: {}, order: [] },
              mobile: { grid: { columns: '', rows: '', areas: [] }, placements: {}, order: [] },
            },
          },
          nodes: {},
        },
        integrity: { sourceHash: 'hash', compilerVersion: '0.0.0' },
      },
    };

    const nextState = {
      ...prevState,
      ui: { activeFrame: 'tablet', activeSurface: 'frames' },
    };

    const event = { type: 'UI_SET_FRAME', payload: { frame: 'tablet' } };
    const packet = createObservationPacket(event, nextState, prevState, 1);

    assert.equal(packet.source, 'nuwa-host');
    assert.equal(packet.category, 'pipeline');
    assert.equal(packet.event, 'UI_SET_FRAME');
    assert.deepEqual(packet.payload, {
      frame: 'tablet',
      previousFrame: 'desktop',
      activeSurface: 'frames',
    });
    assert.equal(packet.sequence, 1);
    assert.ok(packet.id.includes('-'));
    assert.ok(packet.emittedAt.includes('T'));
  });
});
