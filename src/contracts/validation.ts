export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const hasString = (value: unknown): value is string => typeof value === 'string';

export const hasOptionalString = (value: unknown): value is string | undefined =>
  typeof value === 'string' || typeof value === 'undefined';

export const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && !Number.isNaN(value);

export const hasOptionalNumber = (value: unknown): value is number | undefined =>
  typeof value === 'number' || typeof value === 'undefined';

export const hasOptionalBoolean = (value: unknown): value is boolean | undefined =>
  typeof value === 'boolean' || typeof value === 'undefined';

export const hasArray = <T = unknown>(
  value: unknown,
  itemCheck?: (entry: unknown) => entry is T
): value is T[] => {
  if (!Array.isArray(value)) {
    return false;
  }
  if (!itemCheck) {
    return true;
  }
  return value.every((entry) => itemCheck(entry));
};
