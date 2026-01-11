import type { DraftArtifact } from './draft-contract';
import { sampleCompiledArtifact } from './sample-compiled';

export const sampleDraft: DraftArtifact = {
  rootNodeId: 'root',
  nodes: {
    root: {
      type: 'section',
      children: ['header', 'hero', 'repeater'],
    },
    header: {
      type: 'text',
      props: {
        tag: 'h1',
        text: 'Draft Artifact Preview',
        styler: {
          fontSize: '1.75rem',
          fontWeight: 600,
          margin: 0,
        },
      },
    },
    hero: {
      type: 'section',
      props: {
        className: 'hero',
      },
      children: ['hero-title', 'hero-body'],
    },
    'hero-title': {
      type: 'text',
      props: {
        tag: 'h2',
        text: 'Draft-first runtime rendering',
      },
    },
    'hero-body': {
      type: 'text',
      props: {
        tag: 'p',
        text:
          'Frames, grid placement, and styler mappings are derived from the canonical draft schema.',
        styler: {
          opacity: 0.86,
          lineHeight: 1.4,
        },
      },
    },
    repeater: {
      type: 'repeater',
      props: {
        className: 'card-grid',
        bindings: {
          dataPath: 'catalog',
          templateId: 'card-template',
        },
      },
    },
    'card-template': {
      type: 'template',
      props: {
        className: 'card',
      },
      children: ['card-title', 'card-body'],
    },
    'card-title': {
      type: 'text',
      props: {
        tag: 'h3',
        bindings: {
          textPath: 'title',
        },
        styler: {
          fontSize: '1.05rem',
          fontWeight: 600,
        },
      },
    },
    'card-body': {
      type: 'text',
      props: {
        tag: 'p',
        bindings: {
          textPath: 'description',
        },
        styler: {
          fontSize: '0.95rem',
          margin: 0,
          color: '#475569',
        },
      },
    },
  },
  frames: {
    desktop: {
      grid: {
        columns: 'repeat(6, minmax(0, 1fr))',
        rows: 'auto auto 1fr',
        areas: [
          '"header header header header header header"',
          '"hero hero hero hero hero hero"',
          '"list list list list list list"',
        ],
      },
      order: ['header', 'hero', 'repeater'],
      placements: {
        header: { area: 'header' },
        hero: { area: 'hero' },
        repeater: { area: 'list' },
      },
    },
    mobile: {
      grid: {
        columns: 'repeat(2, minmax(0, 1fr))',
        rows: 'auto auto 1fr',
        areas: ['"header header"', '"hero hero"', '"list list"'],
      },
      order: ['header', 'hero', 'repeater'],
      placements: {
        header: { area: 'header' },
        hero: { area: 'hero' },
        repeater: { area: 'list' },
      },
    },
    tablet: {
      grid: {
        columns: 'repeat(4, minmax(0, 1fr))',
        rows: 'auto auto 1fr',
        areas: [
          '"header header header header"',
          '"hero hero hero hero"',
          '"list list list list"',
        ],
      },
      order: ['header', 'hero', 'repeater'],
      placements: {
        header: { area: 'header' },
        hero: { area: 'hero' },
        repeater: { area: 'list' },
      },
    },
  },
  assets: {
    ghostMap: sampleCompiledArtifact.runtime.ghostMap ?? [],
    items: {},
  },
  metadata: {
    draftId: sampleCompiledArtifact.draftId,
    appId: sampleCompiledArtifact.appId,
    updatedAt: new Date().toISOString(),
    title: 'Draft-first layout',
    summary: 'Canonical draft schema seeded at startup.',
  },
};
