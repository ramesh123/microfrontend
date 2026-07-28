import { humanizeRuleNodeClazz } from "../ruleChainTbAdapter";
import type { RuleChainFlowNodeData } from "../components/RuleChainFlowNode";

/** ThingsBoard-style subtitle: “Filter - script”. */
export function ruleChainNodeTooltipSubtitle(d: RuleChainFlowNodeData): string {
  const code = d.categoryCode?.trim();
  const category =
    code && code.length > 0 ? code.charAt(0).toUpperCase() + code.slice(1).toLowerCase() : "";
  const kind =
    d.type?.trim() ||
    (d.clazz?.trim() ? humanizeRuleNodeClazz(d.clazz) : "") ||
    d.paletteSubtitle?.trim() ||
    "";
  if (category && kind) return `${category} - ${kind}`;
  return kind || category;
}
