export const BUILDER_UI_REGISTRY_BOUNDARY = '/system/components/builder-ui/';
export const BUILDER_UI_MANIFEST_VERSION = 'builder-ui-manifest/v1' as const;

export type BuilderUiRegistryKey = 'local' | 'remote';

export type BuilderUiComponentEntry = {
  id: string;
  label: string;
  modulePath: string;
  exportName?: string;
};

export type BuilderUiRegistry = {
  key: BuilderUiRegistryKey;
  source: 'local' | 'remote';
  entries: BuilderUiComponentEntry[];
};

export type BuilderUiBootstrapState = {
  isSelfHosting: boolean;
  activeRegistry: BuilderUiRegistryKey;
  versionPin?: string;
  fallbackRegistry: BuilderUiRegistryKey;
  snapshots: BuilderUiRegistrySnapshot[];
  publishHistory: BuilderUiPublishRecord[];
  rollbackHistory: BuilderUiRollbackRecord[];
};

export type BuilderUiPublishRecord = {
  version: string;
  tag: string;
  notes?: string;
  publishedAt: string;
};

export type BuilderUiRollbackRecord = {
  fromVersion?: string;
  toVersion: string;
  reason?: string;
  rolledBackAt: string;
};

export type BuilderUiPublishMetadata = {
  tag: string;
  notes?: string;
  publishedAt: string;
};

export type BuilderUiBootstrapSnapshotState = Omit<BuilderUiBootstrapState, 'snapshots'>;

export type BuilderUiRegistrySnapshot = {
  version: string;
  path: string;
  boundary: string;
  activeRegistry: BuilderUiRegistryKey;
  registry: BuilderUiRegistry;
  bootstrap: BuilderUiBootstrapSnapshotState;
  publish?: BuilderUiPublishMetadata;
};

export type BuilderUiManifest = {
  version: typeof BUILDER_UI_MANIFEST_VERSION;
  boundary: string;
  activeRegistry: BuilderUiRegistryKey;
  bootstrap: BuilderUiBootstrapState;
  registries: Record<BuilderUiRegistryKey, BuilderUiRegistry>;
};

export type BuilderUiManifestValidation = {
  ok: boolean;
  errors: string[];
};

const registryKeyList: BuilderUiRegistryKey[] = ['local', 'remote'];

const isRegistryKey = (value: string): value is BuilderUiRegistryKey =>
  registryKeyList.includes(value as BuilderUiRegistryKey);

const hasBoundaryPrefix = (boundary: string, entryId: string) =>
  entryId.startsWith(boundary);

export const validateBuilderUiManifest = (manifest: BuilderUiManifest): BuilderUiManifestValidation => {
  const errors: string[] = [];

  if (manifest.boundary !== BUILDER_UI_REGISTRY_BOUNDARY) {
    errors.push(`boundary must be ${BUILDER_UI_REGISTRY_BOUNDARY}`);
  }

  if (!isRegistryKey(manifest.activeRegistry)) {
    errors.push('activeRegistry must be local or remote');
  }

  if (!isRegistryKey(manifest.bootstrap.activeRegistry)) {
    errors.push('bootstrap.activeRegistry must be local or remote');
  }

  if (!isRegistryKey(manifest.bootstrap.fallbackRegistry)) {
    errors.push('bootstrap.fallbackRegistry must be local or remote');
  }

  registryKeyList.forEach((key) => {
    const registry = manifest.registries[key];
    if (!registry) {
      errors.push(`missing registry: ${key}`);
      return;
    }
    if (registry.key !== key) {
      errors.push(`registry key mismatch for ${key}`);
    }
    registry.entries.forEach((entry) => {
      if (!hasBoundaryPrefix(manifest.boundary, entry.id)) {
        errors.push(`entry ${entry.id} must live under ${manifest.boundary}`);
      }
      if (!entry.modulePath.trim()) {
        errors.push(`entry ${entry.id} is missing modulePath`);
      }
    });
  });

  return { ok: errors.length === 0, errors };
};

export const createBuilderUiManifest = (
  overrides: Partial<BuilderUiManifest> = {}
): BuilderUiManifest => {
  const manifest: BuilderUiManifest = {
    version: BUILDER_UI_MANIFEST_VERSION,
    boundary: BUILDER_UI_REGISTRY_BOUNDARY,
    activeRegistry: 'local',
    bootstrap: {
      isSelfHosting: false,
      activeRegistry: 'local',
      fallbackRegistry: 'local',
      snapshots: [],
      publishHistory: [],
      rollbackHistory: [],
    },
    registries: {
      local: {
        key: 'local',
        source: 'local',
        entries: [],
      },
      remote: {
        key: 'remote',
        source: 'remote',
        entries: [],
      },
    },
  };

  return {
    ...manifest,
    ...overrides,
    bootstrap: {
      ...manifest.bootstrap,
      ...overrides.bootstrap,
    },
    registries: {
      ...manifest.registries,
      ...overrides.registries,
    },
  };
};

let builderUiManifest = createBuilderUiManifest({
  registries: {
    local: {
      key: 'local',
      source: 'local',
      entries: [
        {
          id: `${BUILDER_UI_REGISTRY_BOUNDARY}toolbar`,
          label: 'Toolbar Drawer',
          modulePath: `${BUILDER_UI_REGISTRY_BOUNDARY}toolbar`,
        },
        {
          id: `${BUILDER_UI_REGISTRY_BOUNDARY}left-drawer`,
          label: 'Warehouse Drawer',
          modulePath: `${BUILDER_UI_REGISTRY_BOUNDARY}left-drawer`,
        },
        {
          id: `${BUILDER_UI_REGISTRY_BOUNDARY}right-panel`,
          label: 'Inspector Panel',
          modulePath: `${BUILDER_UI_REGISTRY_BOUNDARY}right-panel`,
        },
        {
          id: `${BUILDER_UI_REGISTRY_BOUNDARY}bottom-panel`,
          label: 'Telemetry Panel',
          modulePath: `${BUILDER_UI_REGISTRY_BOUNDARY}bottom-panel`,
        },
      ],
    },
    remote: {
      key: 'remote',
      source: 'remote',
      entries: [],
    },
  },
});

export const getBuilderUiManifest = () => builderUiManifest;

export const setBuilderUiManifest = (next: BuilderUiManifest) => {
  builderUiManifest = next;
  return builderUiManifest;
};

export { builderUiManifest };
