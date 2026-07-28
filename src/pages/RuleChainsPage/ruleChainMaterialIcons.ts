/**
 * Default Material Icons **ligature** names per ThingsBoard segment (mat-icon + material-icons).
 * Used when the API omits `icon` / `iconUrl`; rendered as font text, not SVG.
 */
export function ruleChainMaterialIconFallback(segmentOrTypeLabel: string | undefined): string | undefined {
  if (!segmentOrTypeLabel?.trim()) return undefined;
  const k = segmentOrTypeLabel.trim().toUpperCase();
  const map: Record<string, string> = {
    /** Funnel — ThingsBoard filter palette / nodes */
    FILTER: "filter_list",
    /** Plus with lines — enrichment / originator fields */
    ENRICHMENT: "playlist_add",
    TRANSFORMATION: "transform",
    ACTION: "bolt",
    EXTERNAL: "cloud_upload",
    /** Input / flow — square-with-arrow style in TB */
    FLOW: "input",
  };
  return map[k];
}
