import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPILED_SCHEMA_VERSION,
  isCompatibleCompiledArtifact,
} from '../../dist-tests/host/compiled-contract.js';

describe('compiled artifact compatibility', () => {
  it('accepts artifacts with the supported schema and runtime shape', () => {
    const artifact = {
      schemaVersion: COMPILED_SCHEMA_VERSION,
      compiledId: 'compiled-1',
      draftId: 'draft-1',
      appId: 'app-1',
      compiledAt: new Date().toISOString(),
      css: '',
      runtime: {
        nodes: {},
        layout: { frames: { desktop: { grid: { columns: '', rows: '', areas: [] }, placements: {}, order: [] } } },
      },
      integrity: { sourceHash: 'hash', compilerVersion: '0.0.0' },
    };

    assert.equal(isCompatibleCompiledArtifact(artifact), true);
  });

  it('rejects artifacts with unknown schema versions', () => {
    const artifact = {
      schemaVersion: 'compiled.v0',
      compiledId: 'compiled-1',
      draftId: 'draft-1',
      appId: 'app-1',
      compiledAt: new Date().toISOString(),
      css: '',
      runtime: {
        nodes: {},
        layout: { frames: {} },
      },
      integrity: { sourceHash: 'hash', compilerVersion: '0.0.0' },
    };

    assert.equal(isCompatibleCompiledArtifact(artifact), false);
  });
});
