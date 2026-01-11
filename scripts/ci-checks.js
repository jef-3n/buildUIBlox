import { execSync } from 'node:child_process';

const run = (command) => execSync(command, { encoding: 'utf8' }).trim();

const resolveBaseRef = () => {
  const baseRefEnv = process.env.GITHUB_BASE_REF;
  if (baseRefEnv) {
    try {
      run(`git rev-parse --verify origin/${baseRefEnv}`);
      return `origin/${baseRefEnv}`;
    } catch {
      return baseRefEnv;
    }
  }

  try {
    run('git rev-parse --verify HEAD~1');
    return 'HEAD~1';
  } catch {
    return null;
  }
};

const baseRef = resolveBaseRef();
if (!baseRef) {
  console.log('ci-checks: no base ref found, skipping.');
  process.exit(0);
}

const diffRange = `${baseRef}...HEAD`;
const changedFiles = run(`git diff --name-only ${diffRange}`)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const hasFileChange = (filePath) => changedFiles.includes(filePath);

const versionedContracts = [
  { path: 'src/host/compiled-contract.ts', identifier: 'COMPILED_SCHEMA_VERSION' },
  { path: 'src/system/components/builder-ui/manifest.ts', identifier: 'BUILDER_UI_MANIFEST_VERSION' },
];

const errors = [];

versionedContracts.forEach(({ path, identifier }) => {
  if (!hasFileChange(path)) {
    return;
  }
  const diff = run(`git diff -U0 ${diffRange} -- ${path}`);
  const versionBumped = diff
    .split('\n')
    .some((line) => /^[+-]/.test(line) && line.includes(identifier));
  if (!versionBumped) {
    errors.push(`Schema contract ${path} changed without bumping ${identifier}.`);
  }
});

const pipelineFiles = [
  'src/host/observation.ts',
  'src/host/telemetry.ts',
  'src/host/telemetry-sniffer.ts',
];

const pipelineOrSchemaChanged =
  pipelineFiles.some(hasFileChange) || versionedContracts.some(({ path }) => hasFileChange(path));

if (pipelineOrSchemaChanged && !hasFileChange('CHANGELOG.md')) {
  errors.push('Pipeline or schema updates require a CHANGELOG.md entry.');
}

if (errors.length) {
  console.error('CI checks failed:');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
