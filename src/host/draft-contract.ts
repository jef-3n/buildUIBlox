import type { GhostHotspot } from '../ghost/ghost-layer';
import type { FrameName } from './frame-types';

type StyleValue = string | number;

export type DraftStyler = Record<
  string,
  StyleValue | Record<string, Record<string, StyleValue>>
>;

export type DraftNodeProps = {
  text?: string;
  textPath?: string;
  tag?: string;
  src?: string;
  alt?: string;
  className?: string;
  styler?: DraftStyler;
  items?: unknown[];
  dataPath?: string;
  templateId?: string;
  bindings?: Record<string, string>;
};

export type DraftNode = {
  type: string;
  props?: DraftNodeProps;
  children?: string[];
};

export type DraftFrame = {
  grid: {
    columns: string;
    rows: string;
    areas: string[];
  };
  order: string[];
  placements: Record<string, { area?: string }>;
};

export type DraftAsset = {
  type: string;
  src: string;
  metadata?: Record<string, unknown>;
};

export type DraftMetadata = {
  draftId: string;
  appId: string;
  updatedAt: string;
  title?: string;
  summary?: string;
  [key: string]: unknown;
};

export type DraftArtifact = {
  rootNodeId: string;
  nodes: Record<string, DraftNode>;
  frames: Partial<Record<FrameName, DraftFrame>>;
  assets: {
    ghostMap?: GhostHotspot[];
    items?: Record<string, DraftAsset>;
  };
  metadata: DraftMetadata;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

const hasString = (value: unknown): value is string => typeof value === 'string';
const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

const isGhostRect = (value: unknown): value is GhostHotspot['rect'] =>
  isRecord(value) &&
  hasNumber(value.x) &&
  hasNumber(value.y) &&
  hasNumber(value.w) &&
  hasNumber(value.h);

const isGhostEmitter = (value: unknown): value is GhostHotspot['emitter'] => {
  if (typeof value === 'string') {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.type === 'string';
};

const isGhostHotspot = (value: unknown): value is GhostHotspot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.id)) return false;
  if (!isGhostRect(value.rect)) return false;
  if (typeof value.path !== 'undefined' && !hasString(value.path)) return false;
  if (typeof value.frame !== 'undefined' && !hasString(value.frame)) return false;
  if (typeof value.emitter !== 'undefined' && !isGhostEmitter(value.emitter)) return false;
  return true;
};

const isDraftNode = (value: unknown): value is DraftNode => {
  if (!isRecord(value)) return false;
  if (!hasString(value.type)) return false;
  if (typeof value.props === 'undefined') return true;
  if (!isRecord(value.props)) return false;
  if (typeof value.props.styler !== 'undefined' && !isRecord(value.props.styler)) {
    return false;
  }
  if (
    typeof value.props.bindings !== 'undefined' &&
    (!isRecord(value.props.bindings) ||
      !Object.values(value.props.bindings).every((entry) => typeof entry === 'string'))
  ) {
    return false;
  }
  if (
    typeof value.children !== 'undefined' &&
    (!Array.isArray(value.children) ||
      !value.children.every((entry) => typeof entry === 'string'))
  ) {
    return false;
  }
  return true;
};

const isDraftFrame = (value: unknown): value is DraftFrame => {
  if (!isRecord(value)) return false;
  if (!isRecord(value.grid)) return false;
  if (!hasString(value.grid.columns)) return false;
  if (!hasString(value.grid.rows)) return false;
  if (!Array.isArray(value.grid.areas)) return false;
  if (!value.grid.areas.every((entry) => typeof entry === 'string')) return false;
  if (!Array.isArray(value.order)) return false;
  if (!value.order.every((entry) => typeof entry === 'string')) return false;
  if (!isRecord(value.placements)) return false;
  return true;
};

const isDraftMetadata = (value: unknown): value is DraftMetadata => {
  if (!isRecord(value)) return false;
  if (!hasString(value.draftId)) return false;
  if (!hasString(value.appId)) return false;
  if (!hasString(value.updatedAt)) return false;
  if (typeof value.title !== 'undefined' && !hasString(value.title)) return false;
  if (typeof value.summary !== 'undefined' && !hasString(value.summary)) return false;
  return true;
};

export const isCompatibleDraftArtifact = (
  value?: unknown
): value is DraftArtifact => {
  if (!isRecord(value)) return false;
  if (!hasString(value.rootNodeId)) return false;
  if (!isRecord(value.nodes)) return false;
  if (!Object.values(value.nodes).every((entry) => isDraftNode(entry))) return false;
  if (!isRecord(value.frames)) return false;
  if (!Object.values(value.frames).every((entry) => isDraftFrame(entry))) return false;
  if (!isRecord(value.assets)) return false;
  if (typeof value.assets.items !== 'undefined' && !isRecord(value.assets.items)) {
    return false;
  }
  if (
    typeof value.assets.ghostMap !== 'undefined' &&
    (!Array.isArray(value.assets.ghostMap) ||
      !value.assets.ghostMap.every((entry) => isGhostHotspot(entry)))
  ) {
    return false;
  }
  if (!isDraftMetadata(value.metadata)) return false;
  return true;
};
