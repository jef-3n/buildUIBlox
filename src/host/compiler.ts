import type { DraftArtifact } from './draft-contract';
import {
  COMPILED_SCHEMA_VERSION,
  type CompiledArtifact,
  type CompiledFrame,
  type CompiledNode,
} from './compiled-contract';
import type { FrameName } from './frame-types';
import {
  type GlobalDesignTokens,
  isCompatibleGlobalDesignTokens,
} from '../contracts/global-session';

type CompileOptions = {
  compiledId?: string;
  baseArtifact?: CompiledArtifact;
  tokenConfig?: GlobalDesignTokens;
};

export const createCompiledId = (draftId: string) =>
  `compiled-${draftId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const cloneNode = (node: CompiledNode): CompiledNode => ({
  ...node,
  props: node.props
    ? {
        ...node.props,
        styler: node.props.styler ? { ...node.props.styler } : undefined,
      }
    : undefined,
  children: node.children ? [...node.children] : undefined,
});

type StyleValue = string | number;

const ATOMIC_CSS_MARKER_START = '/*atomic:begin*/';
const ATOMIC_CSS_MARKER_END = '/*atomic:end*/';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isStyleValue = (value: unknown): value is StyleValue =>
  typeof value === 'string' || typeof value === 'number';

const toCssProperty = (property: string) => {
  if (property.startsWith('--') || property.includes('-')) {
    return property;
  }
  return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
};

const normalizeCssValue = (value: StyleValue) => `${value}`;

const hashStyleKey = (input: string) => {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const resolveTokenValue = (
  value: StyleValue,
  tokens?: GlobalDesignTokens
): StyleValue => {
  if (!tokens || typeof value !== 'string') {
    return value;
  }
  const tokenPath = value.startsWith('token:') ? value.slice(6) : value;
  if (!tokenPath.startsWith('palette.') && !tokenPath.startsWith('typography.')) {
    return value;
  }
  const parts = tokenPath.split('.');
  let cursor: unknown = tokens;
  for (const part of parts) {
    if (!isRecord(cursor)) {
      return value;
    }
    cursor = cursor[part];
  }
  if (typeof cursor === 'string' || typeof cursor === 'number') {
    return cursor;
  }
  return value;
};

const resolveTypographyToken = (
  value: StyleValue,
  tokens?: GlobalDesignTokens
): Record<string, StyleValue> | undefined => {
  if (!tokens || typeof value !== 'string') {
    return undefined;
  }
  const tokenPath = value.startsWith('token:') ? value.slice(6) : value;
  if (!tokenPath.startsWith('typography.')) {
    return undefined;
  }
  const parts = tokenPath.split('.');
  let cursor: unknown = tokens;
  for (const part of parts) {
    if (!isRecord(cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }
  if (!isRecord(cursor)) {
    return undefined;
  }
  const entries = Object.entries(cursor);
  if (!entries.every(([, entry]) => isStyleValue(entry))) {
    return undefined;
  }
  return cursor as Record<string, StyleValue>;
};

const mergeClassNames = (existing: string | undefined, next: string[]) => {
  if (!existing && next.length === 0) return undefined;
  const current = existing?.split(/\s+/).filter(Boolean) ?? [];
  const merged = new Set([...current, ...next]);
  return Array.from(merged).join(' ');
};

const resolveStyleRecord = (
  styles: Record<string, StyleValue>,
  tokens?: GlobalDesignTokens
) => {
  const resolved: Record<string, StyleValue> = {};
  for (const [property, rawValue] of Object.entries(styles)) {
    if (property === 'frames') continue;
    if (property === 'typography') {
      const typographyToken = resolveTypographyToken(rawValue, tokens);
      if (typographyToken) {
        for (const [tokenProp, tokenValue] of Object.entries(typographyToken)) {
          resolved[tokenProp] = resolveTokenValue(tokenValue, tokens);
        }
        continue;
      }
    }
    resolved[property] = resolveTokenValue(rawValue, tokens);
  }
  return resolved;
};

const compileAtomicStyles = (
  nodes: Record<string, CompiledNode>,
  tokens?: GlobalDesignTokens
) => {
  const styleClassMap = new Map<string, string>();
  const cssRules: string[] = [];

  const ensureClass = (property: string, value: StyleValue, frame?: FrameName) => {
    const cssProperty = toCssProperty(property);
    const cssValue = normalizeCssValue(value);
    const key = `${frame ?? 'base'}|${cssProperty}|${cssValue}`;
    const existing = styleClassMap.get(key);
    if (existing) {
      return existing;
    }
    const className = `s${hashStyleKey(key)}`;
    styleClassMap.set(key, className);
    const selector = frame
      ? `.frame[data-frame="${frame}"] .${className}`
      : `.${className}`;
    cssRules.push(`${selector}{${cssProperty}:${cssValue}}`);
    return className;
  };

  for (const node of Object.values(nodes)) {
    const styler = node.props?.styler;
    if (!styler) {
      continue;
    }
    const { frames, ...base } = styler as Record<
      string,
      StyleValue | Record<string, Record<string, StyleValue>>
    > & {
      frames?: Record<string, Record<string, StyleValue>>;
    };
    const nodeClasses: string[] = [];

    const resolvedBase = resolveStyleRecord(base as Record<string, StyleValue>, tokens);
    for (const [property, value] of Object.entries(resolvedBase)) {
      nodeClasses.push(ensureClass(property, value));
    }

    if (frames && isRecord(frames)) {
      for (const [frameName, frameStyles] of Object.entries(frames)) {
        if (!isRecord(frameStyles)) continue;
        const resolvedFrame = resolveStyleRecord(
          frameStyles as Record<string, StyleValue>,
          tokens
        );
        for (const [property, value] of Object.entries(resolvedFrame)) {
          nodeClasses.push(ensureClass(property, value, frameName as FrameName));
        }
      }
    }

    const nextClassName = mergeClassNames(node.props?.className, nodeClasses);
    node.props = {
      ...node.props,
      className: nextClassName,
      styler: undefined,
    };
  }

  return cssRules.join('');
};

const mergeAtomicCss = (baseCss: string, atomicCss: string) => {
  const atomicBlock = `${ATOMIC_CSS_MARKER_START}${atomicCss}${ATOMIC_CSS_MARKER_END}`;
  if (!baseCss) {
    return atomicBlock;
  }
  if (baseCss.includes(ATOMIC_CSS_MARKER_START) && baseCss.includes(ATOMIC_CSS_MARKER_END)) {
    const pattern = new RegExp(
      `${ATOMIC_CSS_MARKER_START}[\\s\\S]*?${ATOMIC_CSS_MARKER_END}`,
      'g'
    );
    return baseCss.replace(pattern, atomicBlock);
  }
  return `${baseCss}${atomicBlock}`;
};

const getDraftTokenConfig = (draft: DraftArtifact): GlobalDesignTokens | undefined => {
  const tokens = draft.metadata?.tokens;
  if (!isCompatibleGlobalDesignTokens(tokens)) {
    return undefined;
  }
  return tokens;
};

const applyDraftStyling = (
  draft: DraftArtifact,
  nodes: Record<string, CompiledNode>
) => {
  for (const [nodeId, nodeDraft] of Object.entries(draft.nodes)) {
    const node = nodes[nodeId];
    if (!node) {
      continue;
    }
    const nextProps = { ...(node.props ?? {}) };
    if (nodeDraft.props?.styler) {
      nextProps.styler = { ...(nextProps.styler ?? {}), ...nodeDraft.props.styler };
    }
    nodes[nodeId] = { ...node, props: nextProps };
  }
};

const compileNodeProps = (draftNode: DraftArtifact['nodes'][string]) => {
  if (!draftNode.props) {
    return undefined;
  }
  const { bindings, styler, ...rest } = draftNode.props;
  const boundProps = bindings ? { ...bindings } : {};
  return {
    ...rest,
    ...boundProps,
    ...(styler ? { styler } : {}),
  } satisfies CompiledNode['props'];
};

const buildRuntimeFromDraft = (draft: DraftArtifact) => {
  const nodeIds = Object.keys(draft.nodes);
  const nodes = Object.fromEntries(
    nodeIds.map((nodeId) => [
      nodeId,
      {
        type: draft.nodes[nodeId]?.type ?? 'box',
        props: compileNodeProps(draft.nodes[nodeId]),
        children: draft.nodes[nodeId]?.children,
      } satisfies CompiledNode,
    ])
  );

  const hasFrames = Object.keys(draft.frames).length > 0;
  const defaultPlacements = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, {}]));
  const defaultFrame: CompiledFrame = {
    grid: {
      columns: 'minmax(0, 1fr)',
      rows: `repeat(${Math.max(1, nodeIds.length)}, auto)`,
      areas: nodeIds.length ? nodeIds.map((id) => `"${id}"`) : ['"root"'],
    },
    order: nodeIds,
    placements: defaultPlacements,
  };

  const frames = hasFrames
    ? (draft.frames as Partial<Record<FrameName, CompiledFrame>>)
    : ({
        desktop: defaultFrame,
        tablet: defaultFrame,
        mobile: defaultFrame,
      } satisfies Partial<Record<FrameName, CompiledFrame>>);

  return {
    nodes,
    layout: {
      frames,
    },
    ghostMap: draft.assets.ghostMap,
  };
};

export const compileDraftArtifact = (
  draft: DraftArtifact,
  options: CompileOptions = {}
): CompiledArtifact => {
  const compiledId = options.compiledId ?? createCompiledId(draft.metadata.draftId);
  const baseArtifact = options.baseArtifact;
  const tokenConfig = options.tokenConfig ?? getDraftTokenConfig(draft);
  const runtime = buildRuntimeFromDraft(draft);
  const runtimeWithData = baseArtifact?.runtime.data
    ? { ...runtime, data: baseArtifact.runtime.data }
    : runtime;
  const nextNodes = Object.fromEntries(
    Object.entries(runtimeWithData.nodes).map(([id, node]) => [id, cloneNode(node)])
  );
  applyDraftStyling(draft, nextNodes);
  const atomicCss = compileAtomicStyles(nextNodes, tokenConfig);
  const ghostMap =
    draft.assets.ghostMap ?? baseArtifact?.runtime.ghostMap ?? runtimeWithData.ghostMap;
  const css = mergeAtomicCss(baseArtifact?.css ?? '', atomicCss);

  return {
    schemaVersion: COMPILED_SCHEMA_VERSION,
    compiledId,
    draftId: draft.metadata.draftId,
    appId: draft.metadata.appId,
    compiledAt: new Date().toISOString(),
    css,
    runtime: {
      ...runtimeWithData,
      nodes: nextNodes,
      ghostMap,
    },
    integrity: {
      sourceHash: `${draft.metadata.draftId}:${draft.metadata.updatedAt}`,
      compilerVersion: 'local-compiler',
    },
  };
};
