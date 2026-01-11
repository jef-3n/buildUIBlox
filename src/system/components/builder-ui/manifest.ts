export const BUILDER_UI_REGISTRY_BOUNDARY = '/system/components/builder-ui/';

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
};

export type BuilderUiManifest = {
  version: 'builder-ui-manifest/v1';
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
    version: 'builder-ui-manifest/v1',
    boundary: BUILDER_UI_REGISTRY_BOUNDARY,
    activeRegistry: 'local',
    bootstrap: {
      isSelfHosting: false,
      activeRegistry: 'local',
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

export const builderUiManifest = createBuilderUiManifest({
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
      ],
    },
    remote: {
      key: 'remote',
      source: 'remote',
      entries: [],
    },
  },
});
