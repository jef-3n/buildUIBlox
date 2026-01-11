import type { FrameName } from './frame-types';
import type { GhostHotspot } from '../ghost/ghost-layer';

type StyleValue = string | number;

export const COMPILED_SCHEMA_VERSION = 'compiled.v1' as const;

export const COMPATIBLE_COMPILED_SCHEMA_VERSIONS = new Set<string>([COMPILED_SCHEMA_VERSION]);

export type CompiledNode = {
  type: string;
  props?: {
    text?: string;
    textPath?: string;
    tag?: string;
    src?: string;
    alt?: string;
    className?: string;
    styler?: Record<string, StyleValue | Record<string, Record<string, StyleValue>>>;
    items?: unknown[];
    dataPath?: string;
    templateId?: string;
  };
  children?: string[];
};

export type CompiledFrame = {
  grid: {
    columns: string;
    rows: string;
    areas: string[];
  };
  order: string[];
  placements: Record<string, { area?: string }>;
};

export type CompiledArtifact = {
  schemaVersion: typeof COMPILED_SCHEMA_VERSION;
  compiledId: string;
  draftId: string;
  appId: string;
  compiledAt: string;
  css: string;
  runtime: {
    nodes: Record<string, CompiledNode>;
    layout: {
      frames: Partial<Record<FrameName, CompiledFrame>>;
    };
    data?: Record<string, unknown>;
    ghostMap?: GhostHotspot[];
  };
  integrity: { sourceHash: string; compilerVersion: string };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

const hasString = (value: unknown) => typeof value === 'string';

export const isCompatibleCompiledArtifact = (
  artifact?: unknown
): artifact is CompiledArtifact => {
  if (!isRecord(artifact)) return false;
  if (!hasString(artifact.schemaVersion)) return false;
  if (!COMPATIBLE_COMPILED_SCHEMA_VERSIONS.has(artifact.schemaVersion)) {
    return false;
  }

  if (!hasString(artifact.compiledId)) return false;
  if (!hasString(artifact.draftId)) return false;
  if (!hasString(artifact.appId)) return false;
  if (!hasString(artifact.compiledAt)) return false;
  if (!hasString(artifact.css)) return false;

  if (!isRecord(artifact.runtime)) return false;
  if (!isRecord(artifact.runtime.nodes)) return false;
  if (!isRecord(artifact.runtime.layout)) return false;
  if (!isRecord(artifact.runtime.layout.frames)) return false;

  return true;
};
