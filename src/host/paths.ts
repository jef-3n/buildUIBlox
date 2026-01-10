import type { FrameName } from './frame-types';

export type ElementPath = `elements.${string}`;
export type FramePath = `frames.${FrameName}`;
export type StylerPath = `${ElementPath}.props.styler`;
export type BindingPath = `${ElementPath}.props.bindings.${string}`;

export const elementPathPattern = /^elements\.(?<id>.+)$/;
export const framePathPattern = /^frames\.(?<frame>desktop|tablet|mobile)$/;
export const stylerPathPattern = /^elements\.(?<id>.+)\.props\.styler$/;
export const bindingPathPattern = /^elements\.(?<id>.+)\.props\.bindings\.(?<binding>.+)$/;

export const buildElementPath = (nodeId: string): ElementPath => `elements.${nodeId}`;
export const buildFramePath = (frame: FrameName): FramePath => `frames.${frame}`;
export const buildStylerPath = (nodeId: string): StylerPath =>
  `${buildElementPath(nodeId)}.props.styler`;
export const buildBindingPath = (nodeId: string, bindingKey: string): BindingPath =>
  `${buildElementPath(nodeId)}.props.bindings.${bindingKey}`;

export const getElementIdFromPath = (path: string) => {
  const match = elementPathPattern.exec(path);
  return match?.groups?.id ?? path;
};
