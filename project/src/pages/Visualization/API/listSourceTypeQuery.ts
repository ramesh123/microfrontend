const ANALYTICS_STUDIO_SOURCE_TYPE_Q = "source_type = 'database'";
const WORKFLOW_SOURCE_TYPE_Q = "source_type != 'database'";

export function buildListSourceTypeQuery(
  existingQ?: string,
  analyticsStudio?: boolean,
): string {
  const sourceTypeQ = analyticsStudio ? ANALYTICS_STUDIO_SOURCE_TYPE_Q : WORKFLOW_SOURCE_TYPE_Q;
  const trimmed = existingQ?.trim();
  if (!trimmed) return sourceTypeQ;
  return `(${trimmed}) AND (${sourceTypeQ})`;
}
