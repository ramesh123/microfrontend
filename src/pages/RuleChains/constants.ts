/** Primary route for Novex → Operations (rule chains). */
export const RULE_CHAINS_LIST_PATH = "/novex/operations";

/** Legacy / alternate nav path that maps to the same list view. */
export const RULE_CHAINS_LIST_PATH_ALT = "/operations";

export function ruleChainEditorPath(ruleChainId: string): string {
  return `${RULE_CHAINS_LIST_PATH}/rule-chain/${encodeURIComponent(ruleChainId)}`;
}
