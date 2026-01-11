import type { FrameName } from './frame-types';

export type NodePath = `nodes.${string}`;
export type FramePath = `frames.${FrameName}`;
export type StylerPath = `${NodePath}.props.styler`;
export type BindingPath = `${NodePath}.props.bindings.${string}`;

export const nodePathFormat = 'nodes.{nodeId}' as const;
export const framePathFormat = 'frames.{frame}' as const;
export const stylerPathFormat = 'nodes.{nodeId}.props.styler' as const;
export const bindingPathFormat = 'nodes.{nodeId}.props.bindings.{bindingKey}' as const;

export const nodePathPattern = /^nodes\.(?<id>.+)$/;
export const framePathPattern = /^frames\.(?<frame>desktop|tablet|mobile)$/;
export const stylerPathPattern = /^nodes\.(?<id>.+)\.props\.styler$/;
export const bindingPathPattern = /^nodes\.(?<id>.+)\.props\.bindings\.(?<binding>.+)$/;

export const buildNodePath = (nodeId: string): NodePath => `nodes.${nodeId}`;
export const buildFramePath = (frame: FrameName): FramePath => `frames.${frame}`;
export const buildStylerPath = (nodeId: string): StylerPath =>
  `${buildNodePath(nodeId)}.props.styler`;
export const buildBindingPath = (nodeId: string, bindingKey: string): BindingPath =>
  `${buildNodePath(nodeId)}.props.bindings.${bindingKey}`;

export const getNodeIdFromPath = (path: string) => {
  const match = nodePathPattern.exec(path);
  return match?.groups?.id ?? path;
};
