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

  it('prefers the pinned bootstrap snapshot in self-hosted mode', () => {
    const manifest = createBuilderUiManifest({
      bootstrap: {
        isSelfHosting: true,
        versionPin: 'v2',
        snapshots: [
          {
            version: 'v1',
            path: '/snapshots/v1/manifest.json',
            boundary: '/system/components/builder-ui/',
            activeRegistry: 'local',
            registry: localRegistry,
            bootstrap: {
              isSelfHosting: true,
              activeRegistry: 'local',
              fallbackRegistry: 'local',
              versionPin: 'v2',
              publishHistory: [],
              rollbackHistory: [],
            },
          },
          {
            version: 'v2',
            path: '/snapshots/v2/manifest.json',
            boundary: '/system/components/builder-ui/',
            activeRegistry: 'local',
            registry: localRegistry,
            bootstrap: {
              isSelfHosting: true,
              activeRegistry: 'local',
              fallbackRegistry: 'local',
              versionPin: 'v2',
              publishHistory: [],
              rollbackHistory: [],
            },
          },
        ],
      },
      registries: {
        local: localRegistry,
      },
    });

    const result = resolveBuilderUiRegistrySnapshot(manifest);

    assert.ok(result.snapshot);
    assert.equal(result.snapshot?.version, 'v2');
    assert.equal(result.snapshot?.activeRegistry, 'local');
  });
});
