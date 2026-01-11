import type { FrameName } from './frame-types';

const frameNames: FrameName[] = ['desktop', 'tablet', 'mobile'];

const parsePathSegments = (path: string) =>
  path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);

const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const cloneContainer = (value: unknown) => {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (isObjectLike(value)) {
    return { ...value };
  }
  return {};
};

const hasStylerFrameSegment = (segments: string[], index: number) => {
  return segments[index] === 'frames' && segments[index - 1] === 'styler';
};

const isDraftStylerPath = (segments: string[]) => {
  return (
    segments[0] === 'elements' &&
    segments.length >= 4 &&
    segments[2] === 'props' &&
    segments[3] === 'styler'
  );
};

const isDraftBindingPath = (segments: string[]) => {
  return (
    segments[0] === 'elements' &&
    segments.length >= 4 &&
    segments[2] === 'props' &&
    segments[3] === 'bindings'
  );
};

export const normalizeDraftStylerPath = (path: string, activeFrame: FrameName) => {
  const segments = parsePathSegments(path);
  if (!segments.length) return null;
  if (!isDraftStylerPath(segments)) return null;

  const applyIsolation = (index: number) => {
    const frameSegment = segments[index + 1];
    if (frameNames.includes(frameSegment as FrameName)) {
      return frameSegment === activeFrame;
    }
    segments.splice(index + 1, 0, activeFrame);
    return true;
  };

  for (let index = 0; index < segments.length; index += 1) {
    if (hasStylerFrameSegment(segments, index)) {
      if (!applyIsolation(index)) {
        return null;
      }
    }
  }

  return segments.join('.');
};

export const normalizeDraftBindingPath = (path: string) => {
  const segments = parsePathSegments(path);
  if (!segments.length) return null;
  if (!isDraftBindingPath(segments)) return null;
  return segments.join('.');
};

const isBlockedRootPath = (segments: string[]) => {
  if (!segments.length) return true;
  if (!isDraftStylerPath(segments) && !isDraftBindingPath(segments)) return true;
  if (segments[0] === 'elements' && segments.length === 2) return true;
  if (segments[0] === 'elements' && segments.length === 3) return true;
  return false;
};

const mergeObjects = (
  base: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(next)) {
    const existing = merged[key];
    if (isObjectLike(existing) && isObjectLike(value)) {
      merged[key] = mergeObjects(existing, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
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

export const setDraftPathValue = <T extends Record<string, unknown>>(
  target: T,
  path: string,
  value: unknown
): T | null => {
  const segments = parsePathSegments(path);
  if (!segments.length || isBlockedRootPath(segments)) {
    return null;
  }

  const clonedRoot = cloneContainer(target) as T;
  let cursor: Record<string, unknown> = clonedRoot;
  let source: unknown = target;
  const existing = getPathValue(target, path);

  for (let index = 0; index < segments.length; index += 1) {
    const key = segments[index];
    const isLast = index === segments.length - 1;

    if (isLast) {
      if (isObjectLike(existing) && isObjectLike(value)) {
        cursor[key] = mergeObjects(existing, value);
      } else {
        cursor[key] = value;
      }
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
