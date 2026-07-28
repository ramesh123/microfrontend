/** Normalized connector icon id (lowercase, underscores). */
export function normalizeConnectorIconId(icon: string): string {
  return icon.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

/** Maps normalized ids to lazyIconsMapping keys (some entries use spaces). */
const LAZY_ICON_KEY_ALIASES: Record<string, string> = {
  aws_lambda: "aws lambda",
  lambda: "aws lambda",
  databricks_lakehouse: "databricks lakehouse",
  databricks: "databricks lakehouse",
  blob_storage: "blob storage",
  postgres_sql: "postgres-sql",
  postgres: "postgresql",
};

export function resolveConnectorIconLookupKey(icon: string): string {
  const id = normalizeConnectorIconId(icon);
  return LAZY_ICON_KEY_ALIASES[id] ?? id;
}

/** Maps normalized ids to keys in CredVault `images.ts`. */
export const CONNECTOR_IMAGES_KEY_BY_ID: Record<string, string> = {
  aws_lambda: "AWS Lambda",
  lambda: "AWS Lambda",
  databricks_lakehouse: "Databricks Lakehouse",
  databricks: "Databricks Lakehouse",
  blob_storage: "Blob Storage",
};

export function resolveConnectorImagesKey(icon: string): string | undefined {
  return CONNECTOR_IMAGES_KEY_BY_ID[normalizeConnectorIconId(icon)];
}
