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
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

const hasString = (value: unknown): value is string => typeof value === 'string';

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
  return true;
};
