export type GhostRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export const buildHotspotStyle = (rect: GhostRect) =>
  `left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;`;
