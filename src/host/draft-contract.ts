import type { GhostHotspot } from '../ghost/ghost-layer';

type StyleValue = string | number;

export type DraftStyler = Record<
  string,
  StyleValue | Record<string, Record<string, StyleValue>>
>;

export type DraftNode = {
  props?: {
    styler?: DraftStyler;
    bindings?: Record<string, string>;
  };
};

export type DraftArtifact = {
  draftId: string;
  appId: string;
  updatedAt: string;
  elements: Record<string, DraftNode>;
  ghostMap?: GhostHotspot[];
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
  return true;
};

export const isCompatibleDraftArtifact = (
  value?: unknown
): value is DraftArtifact => {
  if (!isRecord(value)) return false;
  if (!hasString(value.draftId)) return false;
  if (!hasString(value.appId)) return false;
  if (!hasString(value.updatedAt)) return false;
  if (!isRecord(value.elements)) return false;
  if (!Object.values(value.elements).every((entry) => isDraftNode(entry))) return false;
  if (
    typeof value.ghostMap !== 'undefined' &&
    (!Array.isArray(value.ghostMap) ||
      !value.ghostMap.every((entry) => isGhostHotspot(entry)))
  ) {
    return false;
  }
  return true;
};
