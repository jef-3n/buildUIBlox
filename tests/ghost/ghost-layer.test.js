import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHotspotStyle } from '../../dist-tests/ghost/geometry.js';

const buildHotspotRect = () => ({ x: 12, y: 24, w: 320, h: 180 });

describe('ghost layer coordinate stability', () => {
  it('renders hotspots using the provided rect coordinates verbatim', () => {
    const style = buildHotspotStyle(buildHotspotRect());

    assert.equal(style, 'left:12px;top:24px;width:320px;height:180px;');
  });
});
