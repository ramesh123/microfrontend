export type Rgb = { r: number; g: number; b: number };
export type Hsv = { h: number; s: number; v: number };
export type Rgba = Rgb & { a: number };

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function normalizeHex(hex: string): string {
  const raw = hex.replace(/^#/, "").trim();
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`.toUpperCase();
  }
  if (raw.length === 6) return `#${raw}`.toUpperCase();
  return "#000000";
}

export function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  return { h, s: s * 100, v: max * 100 };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(v, 0, 100) / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function parseColorInput(value: string): { rgb: Rgb; alpha: number } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("#")) {
    const hex = normalizeHex(trimmed);
    if (hex === "#000000" && trimmed.replace("#", "").length < 3) return null;
    return { rgb: hexToRgb(hex), alpha: 100 };
  }

  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbaMatch) {
    return {
      rgb: {
        r: clamp(Number(rgbaMatch[1]), 0, 255),
        g: clamp(Number(rgbaMatch[2]), 0, 255),
        b: clamp(Number(rgbaMatch[3]), 0, 255),
      },
      alpha:
        rgbaMatch[4] != null
          ? clamp(
              Number(rgbaMatch[4]) <= 1 ? Number(rgbaMatch[4]) * 100 : Number(rgbaMatch[4]),
              0,
              100
            )
          : 100,
    };
  }

  return null;
}

export function colorToOutput(hex: string, alpha: number): string {
  if (alpha >= 100) return normalizeHex(hex);
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${(alpha / 100).toFixed(2)})`;
}

export function parseInitialColor(value: string): { hex: string; hsv: Hsv; alpha: number } {
  const parsed = parseColorInput(value || "#000000");
  if (!parsed) {
    return { hex: "#000000", hsv: { h: 0, s: 0, v: 0 }, alpha: 100 };
  }
  const hex = rgbToHex(parsed.rgb);
  return { hex, hsv: rgbToHsv(parsed.rgb), alpha: parsed.alpha };
}

/** Hue at full saturation/value as CSS color */
export function hueToRgbString(h: number): string {
  const { r, g, b } = hsvToRgb({ h, s: 100, v: 100 });
  return `rgb(${r}, ${g}, ${b})`;
}

export const COLOR_PICKER_PRESETS_ROW_1 = [
  "#334155",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#0D9488",
  "#2563EB",
  "#4F46E5",
  "#9333EA",
  "#DB2777",
  "#57534E",
] as const;

export const COLOR_PICKER_PRESETS_ROW_2 = [
  "#94A3B8",
  "#FCA5A5",
  "#FDBA74",
  "#FDE047",
  "#86EFAC",
  "#5EEAD4",
  "#93C5FD",
  "#A5B4FC",
  "#D8B4FE",
  "#F9A8D4",
  "#D6D3D1",
] as const;
