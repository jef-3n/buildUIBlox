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
  frameTransforms: FrameTransformState;
  drawers: UiDrawersState;
};

export type FramePan = {
  x: number;
  y: number;
};

export type FrameTransform = {
  scale: number;
  pan: FramePan;
};

export type FrameTransformState = Record<FrameName, FrameTransform>;

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
export const MIN_UI_SCALE = 1;
export const MAX_UI_SCALE = 5;

export const clampUiScale = (value: number) =>
  Math.min(MAX_UI_SCALE, Math.max(MIN_UI_SCALE, Math.round(value)));

export const DEFAULT_FRAME_PAN: FramePan = { x: 0, y: 0 };

export const createFrameTransformState = (
  scale: number = DEFAULT_UI_SCALE
): FrameTransformState => {
  const clampedScale = clampUiScale(scale);
  return {
    desktop: { scale: clampedScale, pan: { ...DEFAULT_FRAME_PAN } },
    tablet: { scale: clampedScale, pan: { ...DEFAULT_FRAME_PAN } },
    mobile: { scale: clampedScale, pan: { ...DEFAULT_FRAME_PAN } },
  };
};

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

const isScaleLevel = (value: unknown): value is number =>
  hasNumber(value) && Number.isInteger(value) && value >= MIN_UI_SCALE && value <= MAX_UI_SCALE;

const isFramePan = (value: unknown): value is FramePan => {
  if (!isRecord(value)) return false;
  if (!hasNumber(value.x)) return false;
  if (!hasNumber(value.y)) return false;
  return true;
};

const isFrameTransform = (value: unknown): value is FrameTransform => {
  if (!isRecord(value)) return false;
  if (!isScaleLevel(value.scale)) return false;
  if (!isFramePan(value.pan)) return false;
  return true;
};

export const isFrameTransformState = (value: unknown): value is FrameTransformState => {
  if (!isRecord(value)) return false;
  return VALID_FRAMES.every((frame) => isFrameTransform(value[frame]));
};

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
  if (!isScaleLevel(value.scale)) return false;
  if (!isFrameTransformState(value.frameTransforms)) return false;
  if (!isUiDrawersState(value.drawers)) return false;
  return true;
};
