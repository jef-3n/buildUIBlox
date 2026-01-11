type StyleValue = string | number;

export type DraftStyler = Record<
  string,
  StyleValue | Record<string, Record<string, StyleValue>>
>;

export type DraftNode = {
  props?: {
    styler?: DraftStyler;
  };
};

export type DraftArtifact = {
  draftId: string;
  appId: string;
  updatedAt: string;
  elements: Record<string, DraftNode>;
};
