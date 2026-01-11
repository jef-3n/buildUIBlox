import type { GhostHotspot } from '../ghost/ghost-layer';
import { hasArray, hasString, isRecord } from './validation';

export const GHOST_MAP_SCHEMA_VERSION = 'ghost-map.v1' as const;

export const COMPATIBLE_GHOST_MAP_SCHEMA_VERSIONS = new Set<string>([
  GHOST_MAP_SCHEMA_VERSION,
]);

export type GhostMapSnapshot = {
  schemaVersion: typeof GHOST_MAP_SCHEMA_VERSION;
  hotspots: GhostHotspot[];
};

const isGhostHotspot = (value: unknown): value is GhostHotspot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.id)) return false;
  if (!isRecord(value.rect)) return false;
  return true;
};

export const isCompatibleGhostMapSnapshot = (
  value?: unknown
): value is GhostMapSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_GHOST_MAP_SCHEMA_VERSIONS.has(value.schemaVersion)) return false;
  if (!hasArray(value.hotspots, isGhostHotspot)) return false;
  return true;
};
