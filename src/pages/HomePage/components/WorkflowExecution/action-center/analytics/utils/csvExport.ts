export function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'data';
}

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'object'
      ? JSON.stringify(value)
      : typeof value === 'number'
        ? value.toLocaleString()
        : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function downloadGridDataAsCsv(
  rows: Record<string, unknown>[],
  columnDefs: Array<{ field?: string; headerName?: string }>,
  baseFilename: string,
) {
  if (!rows.length) return false;

  const fields =
    columnDefs.length > 0
      ? (columnDefs
          .map((col) => col.field ?? col.headerName)
          .filter((field): field is string => Boolean(field)) as string[])
      : Object.keys(rows[0] || {}).filter((key) => key !== 'originalData');

  const headers = fields.map((field) => {
    const col = columnDefs.find((c) => (c.field ?? c.headerName) === field);
    return col?.headerName ?? field;
  });

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) =>
      fields.map((field) => escapeCsvCell(row[field])).join(','),
    ),
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${sanitizeFilenamePart(baseFilename)}_${dateStr}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
  return true;
}
