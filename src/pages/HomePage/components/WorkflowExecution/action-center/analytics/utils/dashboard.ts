export function getDashboardId(
  dashboard: { dashboard_id?: string | number; id?: string | number; dashboardId?: string | number } | null | undefined,
): string | null {
  if (!dashboard) return null;
  const id = dashboard.dashboard_id ?? dashboard.id ?? dashboard.dashboardId;
  return id != null ? String(id) : null;
}

export function resolveDashboardDisplayTitle(
  dashboard: { dashboard_title?: string | null; title?: string | null } | null | undefined,
): string | null {
  if (!dashboard) return null;
  const rawTitle = dashboard.dashboard_title ?? dashboard.title;
  if (typeof rawTitle !== 'string') return null;
  const trimmed = rawTitle.trim();
  return trimmed.length > 0 ? trimmed : null;
}
