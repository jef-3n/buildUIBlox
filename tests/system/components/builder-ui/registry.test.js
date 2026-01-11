import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBuilderUiManifest } from '../../../../dist-tests/system/components/builder-ui/manifest.js';
import { resolveBuilderUiRegistrySnapshot } from '../../../../dist-tests/system/components/builder-ui/registry.js';

const localRegistry = {
  key: 'local',
  source: 'local',
  entries: [],
};

describe('builder UI registry bootstrap fallback', () => {
  it('falls back to the bootstrap registry when the active registry is unavailable', () => {
    const manifest = createBuilderUiManifest({
      activeRegistry: 'remote',
      bootstrap: {
        isSelfHosting: false,
        fallbackRegistry: 'local',
      },
      registries: {
        local: localRegistry,
        remote: undefined,
      },
    });

    const result = resolveBuilderUiRegistrySnapshot(manifest);

    assert.ok(result.snapshot, 'Expected registry load to succeed via fallback.');
    assert.equal(result.snapshot?.registry.key, 'local');
    assert.equal(result.snapshot?.activeRegistry, 'local');
  });
});
