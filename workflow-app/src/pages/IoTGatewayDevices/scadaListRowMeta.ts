import type { ScadaSymbolListItem } from "@/controllers/API/scadaSymbolsApi";

function pickNumStr(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(Math.round(v * 1000) / 1000);
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

/** Best-effort resolution from gateway list payload (keys vary by backend). */
export function getScadaRowResolution(row: ScadaSymbolListItem): string {
  const r = row.raw;
  const w = pickNumStr(r.width ?? r.imageWidth ?? r.svgWidth ?? r.image_width);
  const h = pickNumStr(r.height ?? r.imageHeight ?? r.svgHeight ?? r.image_height);
  if (w && h) return `${w}×${h}`;
  const res = typeof r.resolution === "string" ? r.resolution.trim() : "";
  if (res) return res;
  return "—";
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

/** Best-effort file size from gateway list payload. */
export function getScadaRowSizeLabel(row: ScadaSymbolListItem): string {
  const r = row.raw;
  const s = r.fileSize ?? r.size ?? r.dataSize ?? r.bytes ?? r.file_size;
  if (typeof s === "number" && Number.isFinite(s) && s >= 0) return formatBytes(s);
  if (typeof s === "string" && s.trim()) return s.trim();
  return "—";
}
