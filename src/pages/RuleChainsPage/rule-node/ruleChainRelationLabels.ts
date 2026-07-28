/** Display label for a single relation type (Success, True, False, …). */
export function formatRelationTypeLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  if (lower === "true") return "True";
  if (lower === "false") return "False";
  return t;
}

const RELATION_LABEL_ORDER: Record<string, number> = {
  failure: 0,
  false: 1,
  true: 2,
  success: 3,
};

/** ThingsBoard-style ordering for combined link labels (Failure / False / True). */
export function orderRelationLabelsForDisplay(labels: string[]): string[] {
  const uniq = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  return uniq.sort((a, b) => {
    const pa = RELATION_LABEL_ORDER[a.toLowerCase()] ?? 50;
    const pb = RELATION_LABEL_ORDER[b.toLowerCase()] ?? 50;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });
}

/** Combined pill text for parallel edges between the same two nodes. */
export function combineRelationLabels(labels: string[]): string {
  const ordered = orderRelationLabelsForDisplay(labels);
  const formatted = ordered.map(formatRelationTypeLabel).filter(Boolean);
  return formatted.length ? formatted.join(" / ") : "—";
}
