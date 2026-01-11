import type {
  BuilderUiManifest,
  BuilderUiRegistryKey,
  BuilderUiRegistry,
  BuilderUiManifestValidation,
  BuilderUiRegistrySnapshot,
  BuilderUiBootstrapState,
  BuilderUiBootstrapSnapshotState,
} from './manifest';
import { validateBuilderUiManifest } from './manifest';

export type BuilderUiRegistryLoadResult =
  | { ok: true; snapshot: BuilderUiRegistrySnapshot; validation: BuilderUiManifestValidation }
  | { ok: false; validation: BuilderUiManifestValidation };

const LIVE_BOOTSTRAP_VERSION = 'live';

const toBootstrapSnapshot = (
  bootstrap: BuilderUiBootstrapState
): BuilderUiBootstrapSnapshotState => {
  const { snapshots, ...rest } = bootstrap;
  return rest;
};

export const createBuilderUiRegistrySnapshot = (
  manifest: BuilderUiManifest,
  version: string,
  registryKey: BuilderUiRegistryKey = manifest.activeRegistry
): BuilderUiRegistrySnapshot | undefined => {
  const registry = manifest.registries[registryKey];
  if (!registry) {
    return undefined;
  }
  return {
    version,
    boundary: manifest.boundary,
    activeRegistry: registryKey,
    registry,
    bootstrap: toBootstrapSnapshot(manifest.bootstrap),
  };
};

export const pinBuilderUiBootstrapVersion = (
  manifest: BuilderUiManifest,
  versionPin?: string
): BuilderUiManifest => ({
  ...manifest,
  bootstrap: {
    ...manifest.bootstrap,
    versionPin,
  },
});

export const applyBuilderUiBootstrapFullClosure = (
  manifest: BuilderUiManifest,
  version: string
): BuilderUiManifest => {
  const snapshot = createBuilderUiRegistrySnapshot(
    manifest,
    version,
    manifest.bootstrap.activeRegistry
  );
  const snapshots = snapshot
    ? [
        ...manifest.bootstrap.snapshots.filter((entry) => entry.version !== version),
        snapshot,
      ]
    : manifest.bootstrap.snapshots;

  return {
    ...manifest,
    activeRegistry: manifest.bootstrap.activeRegistry,
    bootstrap: {
      ...manifest.bootstrap,
      isSelfHosting: true,
      versionPin: version,
      snapshots,
    },
  };
};

const resolveBootstrapSnapshot = (manifest: BuilderUiManifest) => {
  if (!manifest.bootstrap.isSelfHosting) {
    return undefined;
  }
  const { snapshots, versionPin } = manifest.bootstrap;
  if (!snapshots.length) {
    return undefined;
  }
  if (versionPin) {
    return snapshots.find((snapshot) => snapshot.version === versionPin);
  }
  return snapshots[snapshots.length - 1];
};

export const switchBuilderUiRegistry = (
  manifest: BuilderUiManifest,
  nextRegistry: BuilderUiRegistryKey
): BuilderUiManifest => ({
  ...manifest,
  activeRegistry: nextRegistry,
  bootstrap: {
    ...manifest.bootstrap,
    activeRegistry: nextRegistry,
  },
});

export const loadBuilderUiRegistry = (manifest: BuilderUiManifest): BuilderUiRegistryLoadResult => {
  const validation = validateBuilderUiManifest(manifest);
  if (!validation.ok) {
    return { ok: false, validation };
  }

  const bootstrapSnapshot = resolveBootstrapSnapshot(manifest);
  if (bootstrapSnapshot) {
    return {
      ok: true,
      validation,
      snapshot: bootstrapSnapshot,
    };
  }

  const targetRegistryKey = manifest.bootstrap.isSelfHosting
    ? manifest.bootstrap.activeRegistry
    : manifest.activeRegistry;
  const registry =
    manifest.registries[targetRegistryKey] ??
    manifest.registries[manifest.bootstrap.fallbackRegistry];
  if (!registry) {
    return {
      ok: false,
      validation: {
        ok: false,
        errors: [`missing active registry ${targetRegistryKey}`],
      },
    };
  }

  const snapshot =
    createBuilderUiRegistrySnapshot(manifest, LIVE_BOOTSTRAP_VERSION, registry.key) ?? {
      version: LIVE_BOOTSTRAP_VERSION,
      boundary: manifest.boundary,
      activeRegistry: registry.key,
      registry,
      bootstrap: toBootstrapSnapshot(manifest.bootstrap),
    };

  return {
    ok: true,
    validation,
    snapshot,
  };
};

export const canLoadBuilderUiRegistryInIsolation = (manifest: BuilderUiManifest): boolean => {
  const result = loadBuilderUiRegistry(manifest);
  return result.ok;
};
