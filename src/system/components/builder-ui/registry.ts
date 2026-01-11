import type {
  BuilderUiManifest,
  BuilderUiRegistryKey,
  BuilderUiRegistry,
  BuilderUiManifestValidation,
  BuilderUiRegistrySnapshot,
  BuilderUiBootstrapState,
  BuilderUiBootstrapSnapshotState,
  BuilderUiPublishMetadata,
  BuilderUiPublishRecord,
  BuilderUiRollbackRecord,
} from './manifest';
import { validateBuilderUiManifest } from './manifest';

export type BuilderUiRegistryLoadResult =
  | { ok: true; snapshot: BuilderUiRegistrySnapshot; validation: BuilderUiManifestValidation }
  | { ok: false; validation: BuilderUiManifestValidation };

const LIVE_BOOTSTRAP_VERSION = 'live';

const SNAPSHOT_PATH_PREFIX = '/system/components/builder-ui/snapshots';

const createSnapshotPath = (version: string) => `${SNAPSHOT_PATH_PREFIX}/${version}/manifest.json`;

const toBootstrapSnapshot = (
  bootstrap: BuilderUiBootstrapState
): BuilderUiBootstrapSnapshotState => {
  const { snapshots, ...rest } = bootstrap;
  return rest;
};

const toPublishRecord = (metadata: BuilderUiPublishMetadata, version: string): BuilderUiPublishRecord => ({
  version,
  tag: metadata.tag,
  notes: metadata.notes,
  publishedAt: metadata.publishedAt,
});

const toRollbackRecord = (
  version: string,
  previousVersion?: string,
  reason?: string,
  rolledBackAt: string = new Date().toISOString()
): BuilderUiRollbackRecord => ({
  fromVersion: previousVersion,
  toVersion: version,
  reason,
  rolledBackAt,
});

export const createBuilderUiRegistrySnapshot = (
  manifest: BuilderUiManifest,
  version: string,
  registryKey: BuilderUiRegistryKey = manifest.activeRegistry,
  publish?: BuilderUiPublishMetadata
): BuilderUiRegistrySnapshot | undefined => {
  const registry = manifest.registries[registryKey];
  if (!registry) {
    return undefined;
  }
  return {
    version,
    path: createSnapshotPath(version),
    boundary: manifest.boundary,
    activeRegistry: registryKey,
    registry,
    bootstrap: toBootstrapSnapshot(manifest.bootstrap),
    publish,
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
  version: string,
  publish?: BuilderUiPublishMetadata
): BuilderUiManifest => {
  const snapshot = createBuilderUiRegistrySnapshot(
    manifest,
    version,
    manifest.bootstrap.activeRegistry,
    publish
  );
  const snapshots = snapshot
    ? [
        ...manifest.bootstrap.snapshots.filter((entry) => entry.version !== version),
        snapshot,
      ]
    : manifest.bootstrap.snapshots;
  const publishHistory = publish
    ? [
        ...manifest.bootstrap.publishHistory.filter((entry) => entry.version !== version),
        toPublishRecord(publish, version),
      ]
    : manifest.bootstrap.publishHistory;

  return {
    ...manifest,
    activeRegistry: manifest.bootstrap.activeRegistry,
    bootstrap: {
      ...manifest.bootstrap,
      isSelfHosting: true,
      versionPin: version,
      snapshots,
      publishHistory,
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
      path: createSnapshotPath(LIVE_BOOTSTRAP_VERSION),
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

export const rollbackBuilderUiBootstrapVersion = (
  manifest: BuilderUiManifest,
  version: string,
  reason?: string,
  rolledBackAt: string = new Date().toISOString()
): BuilderUiManifest => ({
  ...manifest,
  bootstrap: {
    ...manifest.bootstrap,
    versionPin: version,
    rollbackHistory: [
      ...manifest.bootstrap.rollbackHistory,
      toRollbackRecord(version, manifest.bootstrap.versionPin, reason, rolledBackAt),
    ],
  },
});
