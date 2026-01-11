import type { FrameName } from '../host/frame-types';
import { hasNumber, hasString, isRecord } from './validation';

export type ActiveSurface = 'canvas' | 'frames' | 'metadata' | 'telemetry' | 'unknown';

export type DrawerName = 'top' | 'left' | 'right' | 'bottom';

export type UiDrawerState = {
  open: boolean;
  size: number;
};

export type UiDrawersState = Record<DrawerName, UiDrawerState>;

export type UiState = {
  activeFrame: FrameName;
  activeSurface: ActiveSurface;
  scale: number;
  drawers: UiDrawersState;
};

export const UI_STATE_SCHEMA_VERSION = 'ui-state.v1' as const;

export const COMPATIBLE_UI_STATE_SCHEMA_VERSIONS = new Set<string>([
  UI_STATE_SCHEMA_VERSION,
]);

export type UiStateSnapshot = UiState & {
  schemaVersion: typeof UI_STATE_SCHEMA_VERSION;
};

const VALID_FRAMES: FrameName[] = ['desktop', 'tablet', 'mobile'];
const VALID_SURFACES: ActiveSurface[] = [
  'canvas',
  'frames',
  'metadata',
  'telemetry',
  'unknown',
];

const VALID_DRAWERS: DrawerName[] = ['top', 'left', 'right', 'bottom'];

export const DEFAULT_UI_SCALE = 1;

export const DEFAULT_UI_DRAWERS: UiDrawersState = {
  top: { open: true, size: 56 },
  left: { open: true, size: 240 },
  right: { open: true, size: 320 },
  bottom: { open: false, size: 48 },
};

export const createUiDrawersState = (): UiDrawersState => ({
  top: { ...DEFAULT_UI_DRAWERS.top },
  left: { ...DEFAULT_UI_DRAWERS.left },
  right: { ...DEFAULT_UI_DRAWERS.right },
  bottom: { ...DEFAULT_UI_DRAWERS.bottom },
});

const isFrameName = (value: unknown): value is FrameName =>
  typeof value === 'string' && VALID_FRAMES.includes(value as FrameName);

const isActiveSurface = (value: unknown): value is ActiveSurface =>
  typeof value === 'string' && VALID_SURFACES.includes(value as ActiveSurface);

const isDrawerName = (value: unknown): value is DrawerName =>
  typeof value === 'string' && VALID_DRAWERS.includes(value as DrawerName);

const isUiDrawerState = (value: unknown): value is UiDrawerState => {
  if (!isRecord(value)) return false;
  if (typeof value.open !== 'boolean') return false;
  if (!hasNumber(value.size)) return false;
  return true;
};

const isUiDrawersState = (value: unknown): value is UiDrawersState => {
  if (!isRecord(value)) return false;
  return VALID_DRAWERS.every((drawer) => isUiDrawerState(value[drawer]));
};

export const isCompatibleUiStateSnapshot = (
  value?: unknown
): value is UiStateSnapshot => {
  if (!isRecord(value)) return false;
  if (!hasString(value.schemaVersion)) return false;
  if (!COMPATIBLE_UI_STATE_SCHEMA_VERSIONS.has(value.schemaVersion)) return false;
  if (!isFrameName(value.activeFrame)) return false;
  if (!isActiveSurface(value.activeSurface)) return false;
  if (!hasNumber(value.scale)) return false;
  if (!isUiDrawersState(value.drawers)) return false;
  return true;
};
