import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getSlotReplacementInstruction } from '../../dist-tests/host/slot-replacement.js';

describe('slot replacement instructions', () => {
  it('returns fallback slot instructions when no replacement is ready', () => {
    const idle = getSlotReplacementInstruction('left', { status: 'idle' });
    const loading = getSlotReplacementInstruction('left', { status: 'loading' });
    const failed = getSlotReplacementInstruction('left', { status: 'failed' });

    assert.deepEqual(idle, { kind: 'slot', name: 'left' });
    assert.deepEqual(loading, { kind: 'slot', name: 'left' });
    assert.deepEqual(failed, { kind: 'slot', name: 'left' });
  });

  it('returns replacement component instructions when ready', () => {
    const instruction = getSlotReplacementInstruction('top', {
      status: 'ready',
      tagName: 'builder-toolbar',
    });

    assert.deepEqual(instruction, { kind: 'component', tagName: 'builder-toolbar' });
  });
});
