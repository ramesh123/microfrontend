import { useMemo } from "react";
import type { CSSProperties } from "react";

import { isThemeDarkAppearance, useTheme } from "@/context/theme";

import { RULE_CHAIN_SEGMENTS_TB, type RuleChainSegmentTb } from "./ruleChainTbSegmentTheme";

/** Map app theme to React Flow `data-color-mode` for the rule chain canvas. */
export function useRuleChainFlowColorMode(): "light" | "dark" {
  const { theme } = useTheme();
  return useMemo(() => (isThemeDarkAppearance(theme) ? "dark" : "light"), [theme]);
}

export function segmentByBadge(badge: string): RuleChainSegmentTb | undefined {
  return RULE_CHAIN_SEGMENTS_TB.find((s) => s.badge === badge);
}

/** CSS custom properties for Datafusion-style rule nodes (light + dark icon/label columns). */
export function ruleChainNodeCssVars(categoryCode: string, categoryColor: string): CSSProperties {
  const seg = segmentByBadge(categoryCode);
  return {
    ["--tb-seg" as string]: categoryColor,
    ["--rc-icon-col" as string]: seg?.iconColBg ?? "#f1f5f9",
    ["--rc-icon-col-dark" as string]: seg?.iconColBgDark ?? "#1e293b",
    ["--rc-label-col-light" as string]: seg?.labelColBgLight ?? "#1e293b",
    ["--rc-label-col-dark" as string]: seg?.labelColBgDark ?? "#0f172a",
  };
}

/** Chain input node accent (Datafusion primary blue). */
export const RULE_CHAIN_INPUT_CSS_VARS: CSSProperties = {
  ["--tb-seg" as string]: "#1e88e5",
  ["--rc-icon-col" as string]: "#1e88e5",
  ["--rc-icon-col-dark" as string]: "#1565c0",
  ["--rc-label-col-light" as string]: "#ffffff",
  ["--rc-label-col-dark" as string]: "#0d2137",
};
