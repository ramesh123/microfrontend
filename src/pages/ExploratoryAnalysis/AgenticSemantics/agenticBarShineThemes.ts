import type { CSSProperties } from "react";

/** Soft vertical gloss — strong highlights read dated on thin bars. */
export const BAR_SHINE_OVERLAY =
  "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.045) 100%)";

export type BarTheme = { baseGradient: string; trackColor: string };

export const BAR_THEMES = {
  trust: {
    baseGradient:
      "linear-gradient(90deg, #4f46e5 0%, #6d28d9 45%, #6366f1 72%, #0891b2 100%)",
    trackColor: "rgba(99, 102, 241, 0.12)",
  },
  completeness: {
    baseGradient:
      "linear-gradient(90deg, #047857 0%, #059669 48%, #0d9488 100%)",
    trackColor: "rgba(16, 185, 129, 0.11)",
  },
  validity: {
    baseGradient:
      "linear-gradient(90deg, #b45309 0%, #d97706 50%, #ca8a04 100%)",
    trackColor: "rgba(245, 158, 11, 0.13)",
  },
  referential: {
    baseGradient:
      "linear-gradient(90deg, #0f766e 0%, #14b8a6 50%, #0d9488 100%)",
    trackColor: "rgba(20, 184, 166, 0.11)",
  },
  freshness: {
    baseGradient:
      "linear-gradient(90deg, #0369a1 0%, #0284c7 50%, #0369a1 100%)",
    trackColor: "rgba(14, 165, 233, 0.11)",
  },
  duplicate: {
    baseGradient:
      "linear-gradient(90deg, #9f1239 0%, #be123c 52%, #9f1239 100%)",
    trackColor: "rgba(244, 63, 94, 0.11)",
  },
  tier_high: {
    baseGradient:
      "linear-gradient(90deg, #166534 0%, #16a34a 50%, #15803d 100%)",
    trackColor: "rgba(34, 197, 94, 0.11)",
  },
  tier_mid: {
    baseGradient:
      "linear-gradient(90deg, #a16207 0%, #ca8a04 50%, #a16207 100%)",
    trackColor: "rgba(234, 179, 8, 0.13)",
  },
  tier_low: {
    baseGradient:
      "linear-gradient(90deg, #9a3412 0%, #ea580c 50%, #c2410c 100%)",
    trackColor: "rgba(249, 115, 22, 0.12)",
  },
} as const satisfies Record<string, BarTheme>;

export type BarThemeKey = keyof typeof BAR_THEMES;

/** Even lighter gloss for validation rows (short bars). */
const VIOLATION_SHINE =
  "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 48%, rgba(0,0,0,0.04) 100%)";

const VIOLATION_THEMES = {
  severe: {
    base: "linear-gradient(90deg, #7f1d1d 0%, #b91c1c 100%)",
    track: "rgba(185, 28, 28, 0.1)",
  },
  high: {
    base: "linear-gradient(90deg, #9f1239 0%, #e11d48 100%)",
    track: "rgba(225, 29, 72, 0.09)",
  },
  moderate: {
    base: "linear-gradient(90deg, #9a3412 0%, #ea580c 100%)",
    track: "rgba(234, 88, 12, 0.09)",
  },
  light: {
    base: "linear-gradient(90deg, #57534e 0%, #78716c 100%)",
    track: "rgba(120, 113, 108, 0.1)",
  },
} as const;

type ViolationSeverityKey = keyof typeof VIOLATION_THEMES;

function violationSeverityFromPct(pct: number): ViolationSeverityKey {
  const p = Math.min(100, Math.max(0, pct));
  if (p >= 72) return "severe";
  if (p >= 40) return "high";
  if (p >= 18) return "moderate";
  return "light";
}

/** Cohesive stone → amber → rose ramp (no “success green” on failure rows). */
export function violationBarFillStyle(pct: number): CSSProperties {
  const t = VIOLATION_THEMES[violationSeverityFromPct(pct)];
  return {
    backgroundImage: `${VIOLATION_SHINE}, ${t.base}`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  };
}

export function violationBarTrackStyle(pct: number): CSSProperties {
  return { backgroundColor: VIOLATION_THEMES[violationSeverityFromPct(pct)].track };
}

export function scorecardBarCategory(field: string, value: number): BarThemeKey {
  const f = field.toLowerCase();
  if (f === "trust_score") return "trust";
  if (f.includes("completeness")) return "completeness";
  if (f.includes("validity")) return "validity";
  if (f.includes("referential")) return "referential";
  if (f.includes("freshness")) return "freshness";
  if (f.includes("duplicate")) return "duplicate";
  if (value >= 85) return "tier_high";
  if (value >= 60) return "tier_mid";
  return "tier_low";
}

export function barFillStyleFromKey(key: BarThemeKey): CSSProperties {
  const { baseGradient } = BAR_THEMES[key];
  return {
    backgroundImage: `${BAR_SHINE_OVERLAY}, ${baseGradient}`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  };
}

export function barTrackStyleFromKey(key: BarThemeKey): CSSProperties {
  return { backgroundColor: BAR_THEMES[key].trackColor };
}

export function scorecardBarFillStyle(field: string, value: number): CSSProperties {
  return barFillStyleFromKey(scorecardBarCategory(field, value));
}

export function scorecardBarTrackStyle(field: string, value: number): CSSProperties {
  return barTrackStyleFromKey(scorecardBarCategory(field, value));
}
