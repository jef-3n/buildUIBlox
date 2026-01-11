import type {
  BuilderUiManifest,
  BuilderUiRegistryKey,
  BuilderUiRegistry,
  BuilderUiManifestValidation,
} from './manifest';
import { validateBuilderUiManifest } from './manifest';

export type BuilderUiRegistrySnapshot = {
  boundary: string;
  activeRegistry: BuilderUiRegistryKey;
  registry: BuilderUiRegistry;
  bootstrap: BuilderUiManifest['bootstrap'];
};

export type BuilderUiRegistryLoadResult =
  | { ok: true; snapshot: BuilderUiRegistrySnapshot; validation: BuilderUiManifestValidation }
  | { ok: false; validation: BuilderUiManifestValidation };

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

  const registry = manifest.registries[manifest.activeRegistry];
  if (!registry) {
    return {
      ok: false,
      validation: {
        ok: false,
        errors: [`missing active registry ${manifest.activeRegistry}`],
      },
    };
  }

  return {
    ok: true,
    validation,
    snapshot: {
      boundary: manifest.boundary,
      activeRegistry: manifest.activeRegistry,
      registry,
      bootstrap: manifest.bootstrap,
    },
  };
};

export const canLoadBuilderUiRegistryInIsolation = (manifest: BuilderUiManifest): boolean => {
  const result = loadBuilderUiRegistry(manifest);
  return result.ok;
};
