import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFrameScopedPath, setPathValue } from '../../dist-tests/host/path-edits.js';

const baseArtifact = {
  runtime: {
    data: {
      title: 'Original',
    },
    layout: {
      frames: {
        desktop: {
          grid: { columns: '1fr', rows: '1fr', areas: ['"a"'] },
          placements: {},
          order: ['hero'],
        },
      },
    },
  },
};

describe('path edits', () => {
  it('prevents local mutation by cloning update paths', () => {
    const next = setPathValue(baseArtifact, 'runtime.data.title', 'Updated');

    assert.ok(next);
    assert.notStrictEqual(next, baseArtifact);
    assert.equal(baseArtifact.runtime.data.title, 'Original');
    assert.equal(next.runtime.data.title, 'Updated');
  });

  it('enforces frame isolation for layout and styler paths', () => {
    assert.equal(
      normalizeFrameScopedPath('runtime.layout.frames.tablet.grid.columns', 'desktop'),
      null
    );

    assert.equal(
      normalizeFrameScopedPath('runtime.layout.frames.grid.columns', 'mobile'),
      'runtime.layout.frames.mobile.grid.columns'
    );

    assert.equal(
      normalizeFrameScopedPath('runtime.styler.frames.grid.gap', 'tablet'),
      'runtime.styler.frames.tablet.grid.gap'
    );
  });

  it('blocks root mutations to honor pipeline lock guardrails', () => {
    assert.equal(setPathValue(baseArtifact, 'runtime', {}), null);
    assert.equal(setPathValue(baseArtifact, 'runtime.layout.frames', {}), null);
  });

  it('avoids mutating nested containers on updates', () => {
    const artifact = {
      runtime: {
        data: {
          title: 'Original',
          tags: ['alpha', 'beta'],
        },
        layout: baseArtifact.runtime.layout,
      },
    };

    const next = setPathValue(artifact, 'runtime.data.title', 'Updated');

    assert.ok(next);
    assert.equal(artifact.runtime.data.title, 'Original');
    assert.deepEqual(artifact.runtime.data.tags, ['alpha', 'beta']);
    assert.notStrictEqual(next.runtime, artifact.runtime);
    assert.notStrictEqual(next.runtime.data, artifact.runtime.data);
  });
});
