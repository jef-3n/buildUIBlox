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

    assert.ok(next, 'Expected setPathValue to return an updated clone.');
    assert.notStrictEqual(next, baseArtifact);
    assert.equal(baseArtifact.runtime.data.title, 'Original');
    assert.equal(next.runtime.data.title, 'Updated');
  });

  it('enforces frame isolation for layout and styler paths', () => {
    assert.equal(
      normalizeFrameScopedPath('runtime.layout.frames.tablet.grid.columns', 'desktop'),
      null,
      'Expected mismatched frame scopes to be rejected.'
    );

    assert.equal(
      normalizeFrameScopedPath('runtime.layout.frames.grid.columns', 'mobile'),
      'runtime.layout.frames.mobile.grid.columns',
      'Expected missing frame segments to be scoped to the active frame.'
    );

    assert.equal(
      normalizeFrameScopedPath('runtime.styler.frames.grid.gap', 'tablet'),
      'runtime.styler.frames.tablet.grid.gap',
      'Expected styler paths to be scoped to the active frame.'
    );
  });

  it('blocks root mutations to honor pipeline lock guardrails', () => {
    assert.equal(
      setPathValue(baseArtifact, 'runtime', {}),
      null,
      'Expected pipeline guardrails to block root runtime mutations.'
    );
    assert.equal(
      setPathValue(baseArtifact, 'runtime.layout.frames', {}),
      null,
      'Expected pipeline guardrails to block frame registry mutations.'
    );
  });

  it('keeps already-scoped frame paths intact', () => {
    assert.equal(
      normalizeFrameScopedPath('runtime.layout.frames.desktop.grid.columns', 'desktop'),
      'runtime.layout.frames.desktop.grid.columns',
      'Expected active frame paths to remain unchanged.'
    );
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

    assert.ok(next, 'Expected setPathValue to return a cloned artifact.');
    assert.equal(artifact.runtime.data.title, 'Original');
    assert.deepEqual(artifact.runtime.data.tags, ['alpha', 'beta']);
    assert.notStrictEqual(next.runtime, artifact.runtime);
    assert.notStrictEqual(next.runtime.data, artifact.runtime.data);
  });
});
