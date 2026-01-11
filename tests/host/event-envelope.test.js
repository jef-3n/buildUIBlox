import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOST_EVENT_ENVELOPE_VERSION,
  UI_SET_SCALE,
  isCompatibleHostEventEnvelope,
} from '../../dist-tests/contracts/event-envelope.js';

const baseEnvelope = {
  schemaVersion: HOST_EVENT_ENVELOPE_VERSION,
  id: 'evt-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  source: 'nuwa-host',
};

describe('host event protocol compliance', () => {
  it('accepts envelopes with valid schema metadata and payloads', () => {
    const envelope = {
      ...baseEnvelope,
      type: 'ui.setFrame',
      payload: { frame: 'desktop' },
    };

    assert.ok(
      isCompatibleHostEventEnvelope(envelope),
      'Expected a well-formed ui.setFrame envelope to be accepted.'
    );
  });

  it('rejects payloads that violate event-specific requirements', () => {
    const envelope = {
      ...baseEnvelope,
      type: UI_SET_SCALE,
      payload: { scale: 'large' },
    };

    assert.equal(
      isCompatibleHostEventEnvelope(envelope),
      false,
      'Expected non-numeric scale payloads to fail compliance checks.'
    );
  });

  it('rejects incompatible schema versions', () => {
    const envelope = {
      ...baseEnvelope,
      schemaVersion: 'host-event.v0',
      type: 'ui.setFrame',
      payload: { frame: 'desktop' },
    };

    assert.equal(
      isCompatibleHostEventEnvelope(envelope),
      false,
      'Expected unknown schema versions to be flagged by compliance checks.'
    );
  });
});
