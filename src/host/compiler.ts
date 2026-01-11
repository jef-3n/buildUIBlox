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
  for (const [nodeId, nodeDraft] of Object.entries(draft.elements)) {
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

const buildRuntimeFromDraft = (draft: DraftArtifact) => {
  const nodeIds = Object.keys(draft.elements);
  const nodes = Object.fromEntries(
    nodeIds.map((nodeId) => [
      nodeId,
      {
        type: 'box',
        props: {
          styler: draft.elements[nodeId]?.props?.styler ?? {},
        },
      } satisfies CompiledNode,
    ])
  );
  const placements = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, {}]));
  const frame: CompiledFrame = {
    grid: {
      columns: 'minmax(0, 1fr)',
      rows: `repeat(${Math.max(1, nodeIds.length)}, auto)`,
      areas: nodeIds.length ? nodeIds.map((id) => `"${id}"`) : ['"root"'],
    },
    order: nodeIds,
    placements,
  };
  return {
    nodes,
    layout: {
      frames: {
        desktop: frame,
        tablet: frame,
        mobile: frame,
      } satisfies Partial<Record<FrameName, CompiledFrame>>,
    },
    ghostMap: draft.ghostMap,
  };
};

export const compileDraftArtifact = (
  draft: DraftArtifact,
  options: CompileOptions = {}
): CompiledArtifact => {
  const compiledId = options.compiledId ?? createCompiledId(draft.draftId);
  const baseArtifact = options.baseArtifact;
  const runtime = baseArtifact ? baseArtifact.runtime : buildRuntimeFromDraft(draft);
  const nextNodes = Object.fromEntries(
    Object.entries(runtime.nodes).map(([id, node]) => [id, cloneNode(node)])
  );
  applyDraftStyling(draft, nextNodes);
  const ghostMap = draft.ghostMap ?? runtime.ghostMap;

  return {
    schemaVersion: COMPILED_SCHEMA_VERSION,
    compiledId,
    draftId: draft.draftId,
    appId: draft.appId,
    compiledAt: new Date().toISOString(),
    css: baseArtifact?.css ?? '',
    runtime: {
      ...runtime,
      nodes: nextNodes,
      ghostMap,
    },
    integrity: {
      sourceHash: `${draft.draftId}:${draft.updatedAt}`,
      compilerVersion: 'local-compiler',
    },
  };
};
