import type { CompiledArtifact } from './compiled-canvas';

export const sampleCompiledArtifact: CompiledArtifact = {
  schemaVersion: 'compiled.v1',
  compiledId: 'compiled-demo-001',
  draftId: 'draft-demo-001',
  appId: 'app-demo',
  compiledAt: new Date().toISOString(),
  css: `
    .hero {
      background: #0f172a;
      color: #f8fafc;
      padding: 24px;
      border-radius: 16px;
    }
    .hero h2 {
      margin: 0 0 8px;
    }
    .card-grid {
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    }
    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
    }
    .card h3 {
      margin: 0 0 6px;
    }
  `,
  runtime: {
    data: {
      catalog: [
        { title: 'Pulse Kit', description: 'Metric-ready components for live dashboards.' },
        { title: 'Ghost Layer', description: 'Hitbox overlays for precise interactions.' },
        { title: 'Styler Bridge', description: 'JSON-driven styling at runtime.' },
      ],
    },
    nodes: {
      header: {
        type: 'text',
        props: {
          tag: 'h1',
          text: 'Compiled Artifact Preview',
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
          text: 'Compiled-only runtime rendering',
        },
      },
      'hero-body': {
        type: 'text',
        props: {
          tag: 'p',
          text:
            'Frames, grid placement, and styler mappings are derived strictly from the compiled artifact.',
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
          dataPath: 'catalog',
          templateId: 'card-template',
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
          textPath: 'title',
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
          textPath: 'description',
          styler: {
            fontSize: '0.95rem',
            margin: 0,
            color: '#475569',
          },
        },
      },
    },
    layout: {
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
      },
    },
  },
  integrity: {
    sourceHash: 'demo-source',
    compilerVersion: 'demo-compiler',
  },
};
