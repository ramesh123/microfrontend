/** Client-side inspection of SCADA SVG (tb tags, metadata, layout). */

export type ScadaSvgAnalysis = {
  hasSvgRoot: boolean;
  hasTbNamespace: boolean;
  viewBox: string | null;
  widthAttr: string | null;
  heightAttr: string | null;
  aspectLabel: string | null;
  tbTags: string[];
  elementIds: string[];
  metadataRaw: string | null;
  metadataJson: Record<string, unknown> | null;
  warnings: string[];
};

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

/**
 * Parse SVG markup for `tb:tag`, `xmlns:tb`, optional `<tb:metadata><![CDATA[{...}]]>`, and layout hints.
 */
export function analyzeScadaSvg(svg: string): ScadaSvgAnalysis {
  const trimmed = svg.trim();
  const warnings: string[] = [];
  const hasSvgRoot = /^<\s*svg[\s>]/i.test(trimmed) || trimmed.includes("<svg");
  if (!hasSvgRoot) warnings.push("Missing root <svg> element.");

  const hasTbNamespace =
    /xmlns:tb\s*=\s*["']https:\/\/thingsboard\.io\/svg["']/i.test(trimmed) ||
    /xmlns:tb\s*=\s*['"]https:\/\/thingsboard\.io\/svg['"]/i.test(trimmed);
  if (!hasTbNamespace)
    warnings.push("Missing xmlns:tb on the root <svg> — SCADA tag bindings may not load correctly in dashboards.");

  const viewMatch = trimmed.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewMatch?.[1]?.trim() ?? null;

  const wMatch = trimmed.match(/\bwidth\s*=\s*["']([^"'%]+)["']/i);
  const hMatch = trimmed.match(/\bheight\s*=\s*["']([^"'%]+)["']/i);
  const widthAttr = wMatch?.[1]?.trim() ?? null;
  const heightAttr = hMatch?.[1]?.trim() ?? null;

  let aspectLabel: string | null = null;
  const wn = widthAttr != null ? Number.parseFloat(widthAttr) : NaN;
  const hn = heightAttr != null ? Number.parseFloat(heightAttr) : NaN;
  if (Number.isFinite(wn) && Number.isFinite(hn) && wn > 0 && hn > 0) {
    const g = gcd(wn * 1000, hn * 1000);
    const rw = (wn * 1000) / g;
    const rh = (hn * 1000) / g;
    aspectLabel = `${Math.round(rw)}:${Math.round(rh)}`;
  } else if (viewBox) {
    const parts = viewBox.trim().split(/\s+/);
    if (parts.length === 4) {
      const vw = Number.parseFloat(parts[2]);
      const vh = Number.parseFloat(parts[3]);
      if (Number.isFinite(vw) && Number.isFinite(vh) && vw > 0 && vh > 0) {
        const g = gcd(vw * 1000, vh * 1000);
        aspectLabel = `${Math.round((vw * 1000) / g)}:${Math.round((vh * 1000) / g)} (from viewBox)`;
      }
    }
  }

  const tbTags: string[] = [];
  const reTag = /\btb:tag\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = reTag.exec(trimmed)) !== null) {
    tbTags.push(m[1]);
  }

  const elementIds: string[] = [];
  const reId = /\bid\s*=\s*["']([^"']+)["']/gi;
  while ((m = reId.exec(trimmed)) !== null) {
    elementIds.push(m[1]);
  }

  let metadataRaw: string | null = null;
  let metadataJson: Record<string, unknown> | null = null;
  const cdata = trimmed.match(/<tb:metadata[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/tb:metadata>/i);
  if (cdata?.[1]) {
    metadataRaw = cdata[1].trim();
    try {
      metadataJson = JSON.parse(metadataRaw) as Record<string, unknown>;
    } catch {
      warnings.push("tb:metadata CDATA is present but not valid JSON.");
    }
  }

  if (tbTags.length === 0) warnings.push("No tb:tag attributes found — assign tags (editor or XML) for interactivity.");

  return {
    hasSvgRoot,
    hasTbNamespace,
    viewBox,
    widthAttr,
    heightAttr,
    aspectLabel,
    tbTags: uniqueStrings(tbTags),
    elementIds: uniqueStrings(elementIds),
    metadataRaw,
    metadataJson,
    warnings,
  };
}
