import type { Viewport } from "@xyflow/react";

import { RULE_CHAIN_MAX_ZOOM, RULE_CHAIN_MIN_ZOOM } from "./ruleChainCanvasLogic";

const STORAGE_PREFIX = "vite-rc-viewport:";

/** Default canvas zoom when no saved / TB viewport (readable node cards + ports). */
export const RULE_CHAIN_DEFAULT_ZOOM = 0.95;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** ThingsBoard-style `additionalInfo.uiState` (zoomLevel + offset or panX/panY). */
export function parseRuleChainViewportFromAdditionalInfo(ai: unknown): Viewport | null {
  if (!isRecord(ai)) return null;
  const u = ai.uiState ?? ai.ui_state;
  if (!isRecord(u)) return null;
  const zoomRaw = u.zoomLevel ?? u.zoom ?? u.zoom_level;
  const zoom = typeof zoomRaw === "number" && Number.isFinite(zoomRaw) ? zoomRaw : Number(zoomRaw);
  const z =
    Number.isFinite(zoom) && zoom > 0
      ? Math.min(RULE_CHAIN_MAX_ZOOM, Math.max(RULE_CHAIN_MIN_ZOOM, zoom))
      : RULE_CHAIN_DEFAULT_ZOOM;

  const off = u.offset;
  let x = 0;
  let y = 0;
  if (isRecord(off)) {
    x = typeof off.x === "number" && Number.isFinite(off.x) ? off.x : Number(off.x) || 0;
    y = typeof off.y === "number" && Number.isFinite(off.y) ? off.y : Number(off.y) || 0;
  } else {
    const px = u.panX ?? u.pan_x;
    const py = u.panY ?? u.pan_y;
    x = typeof px === "number" && Number.isFinite(px) ? px : Number(px) || 0;
    y = typeof py === "number" && Number.isFinite(py) ? py : Number(py) || 0;
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y, zoom: z };
}

export function readStoredRuleChainViewport(chainId: string): Viewport | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + chainId);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Viewport>;
    if (typeof p.x !== "number" || typeof p.y !== "number" || typeof p.zoom !== "number") return null;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.zoom)) return null;
    return {
      x: p.x,
      y: p.y,
      zoom: Math.min(RULE_CHAIN_MAX_ZOOM, Math.max(RULE_CHAIN_MIN_ZOOM, p.zoom)),
    };
  } catch {
    return null;
  }
}

export function writeStoredRuleChainViewport(chainId: string, vp: Viewport): void {
  try {
    sessionStorage.setItem(
      STORAGE_PREFIX + chainId,
      JSON.stringify({
        x: vp.x,
        y: vp.y,
        zoom: vp.zoom,
      }),
    );
  } catch {
    /* quota / private mode */
  }
}
