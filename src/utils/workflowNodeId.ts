/** Current API `node_id` for intelligent deduplication (Fuzzy Match). */
export const DEDUPLICATION_NODE_ID = "deduplication";
/** Prior API / palette ids; still recognized for existing saved flows. */
export const DEDUPLICATION_NODE_ID_LEGACY_HYPHEN = "de-duplication";
export const DEDUPLICATION_NODE_ID_LEGACY = "fuzzy_match";

export const MASKING_NODE_ID = "masking";

export function isDeduplicationNodeId(nodeId: string | undefined | null): boolean {
  if (nodeId == null || String(nodeId).trim() === "") return false;
  return (
    nodeId === DEDUPLICATION_NODE_ID ||
    nodeId === DEDUPLICATION_NODE_ID_LEGACY_HYPHEN ||
    nodeId === DEDUPLICATION_NODE_ID_LEGACY
  );
}

/** Normalize API / palette variants: "final report", "final-report" → "final_report" */
export function normalizeWorkflowNodeId(raw: string | undefined | null): string {
  if (raw == null || raw === "") return "";
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isMaskingNodeId(nodeId: string | undefined | null): boolean {
  if (nodeId == null || String(nodeId).trim() === "") return false;
  const id = normalizeWorkflowNodeId(nodeId);
  return id === MASKING_NODE_ID || id === "data_masking" || id.includes("masking");
}

export function isMaskingNodePage(
  nodeDetailsData: { data?: { node_id?: string; display_name?: string; name?: string } } | null | undefined
): boolean {
  if (!nodeDetailsData?.data) return false;
  if (isMaskingNodeId(nodeDetailsData.data.node_id)) return true;
  const label = String(
    nodeDetailsData.data.display_name ?? nodeDetailsData.data.name ?? ""
  )
    .trim()
    .toLowerCase();
  return label === "masking" || label === "data masking";
}
