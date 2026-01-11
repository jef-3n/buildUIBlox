import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDraftBindingPath,
  normalizeDraftStylerPath,
  setDraftPathValue,
} from '../../dist-tests/host/path-edits.js';

const baseDraft = {
  elements: {
    hero: {
      props: {
        styler: {
          frames: {
            desktop: { color: 'red' },
          },
        },
        bindings: {
          text: { path: 'runtime.data.title' },
        },
      },
    },
  },
};

describe('path edits', () => {
  it('prevents local mutation by cloning update paths', () => {
    const next = setDraftPathValue(
      baseDraft,
      'elements.hero.props.styler.frames.desktop.color',
      'blue'
    );

    assert.ok(next, 'Expected setDraftPathValue to return an updated clone.');
    assert.notStrictEqual(next, baseDraft);
    assert.equal(baseDraft.elements.hero.props.styler.frames.desktop.color, 'red');
    assert.equal(next.elements.hero.props.styler.frames.desktop.color, 'blue');
  });

  it('enforces frame isolation for draft styler paths', () => {
    assert.equal(
      normalizeDraftStylerPath(
        'elements.hero.props.styler.frames.tablet.width',
        'desktop'
      ),
      null,
      'Expected mismatched frame scopes to be rejected.'
    );

    assert.equal(
      normalizeDraftStylerPath('elements.hero.props.styler.frames.width', 'mobile'),
      'elements.hero.props.styler.frames.mobile.width',
      'Expected missing frame segments to be scoped to the active frame.'
    );

    assert.equal(
      normalizeDraftStylerPath(
        'elements.hero.props.styler.frames.desktop.width',
        'desktop'
      ),
      'elements.hero.props.styler.frames.desktop.width',
      'Expected active frame paths to remain unchanged.'
    );
  });

  it('normalizes binding paths without frame scoping', () => {
    assert.equal(
      normalizeDraftBindingPath('elements.hero.props.bindings.text'),
      'elements.hero.props.bindings.text',
      'Expected binding paths to normalize without frame isolation.'
    );
    assert.equal(
      normalizeDraftBindingPath('elements.hero.props.styler.color'),
      null,
      'Expected non-binding paths to be rejected.'
    );
  });

  it('allows binding updates while blocking root mutations', () => {
    const next = setDraftPathValue(
      baseDraft,
      'elements.hero.props.bindings.text',
      { path: 'runtime.data.subtitle' }
    );

    assert.ok(next, 'Expected binding updates to return an updated clone.');
    assert.equal(baseDraft.elements.hero.props.bindings.text.path, 'runtime.data.title');
    assert.equal(next.elements.hero.props.bindings.text.path, 'runtime.data.subtitle');

    assert.equal(
      setDraftPathValue(baseDraft, 'elements', {}),
      null,
      'Expected root mutations to be blocked.'
    );
  });
});
