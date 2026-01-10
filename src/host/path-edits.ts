import type { FrameName } from './frame-types';

const frameNames: FrameName[] = ['desktop', 'tablet', 'mobile'];

const parsePathSegments = (path: string) =>
  path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

const cloneContainer = (value: unknown) => {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (isObjectLike(value)) {
    return { ...value };
  }
  return {};
};

const hasLayoutFrameSegment = (segments: string[], index: number) => {
  return segments[index] === 'frames' && segments[index - 1] === 'layout';
};

const hasStylerFrameSegment = (segments: string[], index: number) => {
  return segments[index] === 'frames' && segments[index - 1] === 'styler';
};

export const normalizeFrameScopedPath = (path: string, activeFrame: FrameName) => {
  const segments = parsePathSegments(path);
  if (!segments.length) return null;

  const applyIsolation = (index: number) => {
    const frameSegment = segments[index + 1];
    if (frameNames.includes(frameSegment as FrameName)) {
      return frameSegment === activeFrame;
    }
    segments.splice(index + 1, 0, activeFrame);
    return true;
  };

  for (let index = 0; index < segments.length; index += 1) {
    if (hasLayoutFrameSegment(segments, index) || hasStylerFrameSegment(segments, index)) {
      if (!applyIsolation(index)) {
        return null;
      }
    }
  }

  return segments.join('.');
};

const isBlockedRootPath = (segments: string[]) => {
  if (!segments.length) return true;
  const [root, second, third, fourth] = segments;
  if (root === 'runtime' && segments.length === 1) return true;
  if (root === 'runtime' && second === 'data' && segments.length === 2) return true;
  if (root === 'runtime' && second === 'layout' && segments.length === 2) return true;
  if (root === 'runtime' && second === 'layout' && third === 'frames' && segments.length === 3) return true;
  if (
    root === 'runtime' &&
    second === 'layout' &&
    third === 'frames' &&
    frameNames.includes(fourth as FrameName) &&
    segments.length === 4
  ) {
    return true;
  }
  if (root === 'runtime' && second === 'nodes' && segments.length === 2) return true;
  if (root === 'runtime' && second === 'nodes' && segments.length === 3) return true;
  return false;
};

export const getPathValue = (data: unknown, path?: string) => {
  if (!data || !path) return undefined;
  const segments = parsePathSegments(path);
  return segments.reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
};

export const setPathValue = <T extends Record<string, unknown>>(
  target: T,
  path: string,
  value: unknown
): T | null => {
  const segments = parsePathSegments(path);
  if (!segments.length || isBlockedRootPath(segments)) {
    return null;
  }

  const existing = getPathValue(target, path);
  if (isObjectLike(existing) && isObjectLike(value)) {
    return null;
  }

  const clonedRoot = cloneContainer(target) as T;
  let cursor: Record<string, unknown> = clonedRoot;
  let source: unknown = target;

  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    const isLast = index === segments.length - 1;

    if (isLast) {
      cursor[key] = value;
      break;
    }

    const sourceValue = isObjectLike(source) ? (source as Record<string, unknown>)[key] : undefined;
    const next = cloneContainer(sourceValue);
    cursor[key] = next as Record<string, unknown>;
    cursor = next as Record<string, unknown>;
    source = sourceValue;
  }

  return clonedRoot;
};
