import type { DraftArtifact } from './draft-contract';
import {
  COMPILED_SCHEMA_VERSION,
  type CompiledArtifact,
  type CompiledFrame,
  type CompiledNode,
} from './compiled-contract';
import type { FrameName } from './frame-types';

type CompileOptions = {
  compiledId?: string;
  baseArtifact?: CompiledArtifact;
};

const createCompiledId = (draftId: string) =>
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
  const runtime = baseArtifact ? baseArtifact.runtime : buildRuntimeFromDraft(draft);
  const nextNodes = Object.fromEntries(
    Object.entries(runtime.nodes).map(([id, node]) => [id, cloneNode(node)])
  );
  applyDraftStyling(draft, nextNodes);
  const ghostMap = draft.assets.ghostMap ?? runtime.ghostMap;

  return {
    schemaVersion: COMPILED_SCHEMA_VERSION,
    compiledId,
    draftId: draft.metadata.draftId,
    appId: draft.metadata.appId,
    compiledAt: new Date().toISOString(),
    css: baseArtifact?.css ?? '',
    runtime: {
      ...runtime,
      nodes: nextNodes,
      ghostMap,
    },
    integrity: {
      sourceHash: `${draft.metadata.draftId}:${draft.metadata.updatedAt}`,
      compilerVersion: 'local-compiler',
    },
  };
};
