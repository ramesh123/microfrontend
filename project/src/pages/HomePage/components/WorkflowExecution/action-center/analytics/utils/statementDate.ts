export function formatStatementDate(d?: Date) {
  if (!d) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatStatementDateDisplay(stmtDateForApi: string, loadingDates: boolean) {
  if (loadingDates) return 'Loading...';
  if (!stmtDateForApi) return '—';
  try {
    const [year, month, day] = stmtDateForApi.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return stmtDateForApi;
  }
}
