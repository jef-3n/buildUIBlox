import { build } from 'esbuild';

const entryPoints = [
  'src/host/observation.ts',
  'src/host/path-edits.ts',
  'src/ghost/geometry.ts',
  'src/system/components/builder-ui/manifest.ts',
  'src/system/components/builder-ui/registry.ts',
];

await build({
  entryPoints,
  outbase: 'src',
  outdir: 'dist-tests',
  format: 'esm',
  platform: 'node',
  sourcemap: false,
  bundle: true,
  tsconfig: 'tsconfig.json',
});
