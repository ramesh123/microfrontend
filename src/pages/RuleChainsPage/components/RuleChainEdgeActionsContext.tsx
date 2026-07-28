import { createContext, useContext } from "react";

export type RuleChainEdgeActions = {
  onEditEdge: (edgeId: string) => void;
};

export const RuleChainEdgeActionsContext = createContext<RuleChainEdgeActions | null>(null);

export function useRuleChainEdgeActions(): RuleChainEdgeActions | null {
  return useContext(RuleChainEdgeActionsContext);
}
