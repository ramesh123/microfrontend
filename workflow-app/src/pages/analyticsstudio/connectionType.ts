export function resolveAnalyticsStudioConnectionType(nodeId: string, nodeName?: string): string {
  const id = nodeId.toLowerCase();
  if (id.includes("postgres")) return "postgresql";
  if (id.includes("dynamo")) return "dynamodb";
  if (id.includes("mysql")) return "mysql";
  if (id.includes("mssql") || id.includes("sqlserver")) return "mssql";
  if (id.includes("oracle")) return "oracle";
  if (id.includes("snowflake")) return "snowflake";
  return (nodeName ?? nodeId).toLowerCase();
}

export function resolveAnalyticsStudioNodeIdFromConnectionType(connectionType: string): string {
  const type = connectionType.toLowerCase().trim();
  if (type === "postgresql" || type === "postgres") return "postgresql";
  if (type === "dynamodb") return "dynamodb";
  if (type === "mysql") return "mysql";
  if (type === "mssql" || type === "sqlserver") return "mssql";
  if (type === "oracle") return "oracle";
  if (type === "snowflake") return "snowflake";
  return type;
}
