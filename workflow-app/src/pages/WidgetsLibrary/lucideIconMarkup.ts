import { createElement, icons } from "lucide";
import type { IconNode } from "lucide";

export function parseIconSizePx(size: string | undefined, fallback = 24): number {
  if (!size) return fallback;
  const n = parseInt(size, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function formatIconSizePx(px: number, min = 8, max = 128): string {
  const clamped = Math.min(max, Math.max(min, Math.round(px)));
  return `${clamped}px`;
}

/** Renders a Lucide icon as an HTML string for iframe / static previews (browser-safe). */
export function renderLucideIconMarkup(
  name: string,
  options?: { size?: number; color?: string; className?: string }
): string {
  if (!name || typeof document === "undefined") return "";

  const iconNode = (icons as Record<string, IconNode | undefined>)[name];
  if (!iconNode) return "";

  const size = options?.size ?? 24;
  const color = options?.color ?? "currentColor";

  const svg = createElement(iconNode, {
    width: size,
    height: size,
    stroke: color,
    ...(options?.className ? { class: options.className } : {}),
    "aria-hidden": "true",
  });

  return svg.outerHTML;
}
