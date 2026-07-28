/** When RBAC omits allowed_actions, show all file row actions (matches list table behavior). */
export function isMasterDataFileActionAllowed(
  subMenuRestrictions: { allowed_actions?: string[] } | null | undefined,
  actionId: string,
): boolean {
  const allowed = subMenuRestrictions?.allowed_actions;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.includes(actionId);
}
