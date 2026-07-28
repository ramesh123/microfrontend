import useFlowStore from "@/stores/flowStore";

/** Distinct upstream output column names for the selected workflow node (sorted). */
export function collectUpstreamColumns(flowNodeId: string | undefined): string[] {
  if (!flowNodeId) return [];
  const upstream = useFlowStore.getState().getUpstreamNodes(flowNodeId);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of upstream) {
    const cols = n?.data?.node?.output?.columns;
    if (!Array.isArray(cols)) continue;
    for (const c of cols) {
      if (typeof c !== "string" || c.trim() === "") continue;
      if (seen.has(c)) continue;
      seen.add(c);
      out.push(c);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}
