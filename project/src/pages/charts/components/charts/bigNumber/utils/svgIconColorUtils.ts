const ICON_TINT_STYLE_ID = 'big-number-icon-tint';

const SHAPE_SELECTOR =
  'path,circle,rect,polygon,ellipse,line,polyline,g,use,symbol path,symbol circle,symbol rect';

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp255(n).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Normalize picker output to #rrggbb for tinting. */
export function normalizeIconColor(color?: string): string | null {
  const c = color?.trim();
  if (!c) return null;

  if (/^#[0-9a-fA-F]{6}$/i.test(c)) return c.toUpperCase();

  const short = c.match(/^#([0-9a-fA-F]{3})$/i);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  const rgb = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    return rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  return null;
}

export function svgTextToDataUrl(svgText: string): string {
  const encoded = encodeURIComponent(svgText.trim()).replace(/'/g, '%27').replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

/** Decode inline SVG or data-URL SVG to markup. */
export function dataUrlToSvgText(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('<svg')) return trimmed;

  if (trimmed.startsWith('data:image/svg+xml')) {
    const comma = trimmed.indexOf(',');
    if (comma < 0) return null;
    const meta = trimmed.slice(0, comma);
    const payload = trimmed.slice(comma + 1);
    if (meta.includes(';base64,')) {
      try {
        return atob(payload);
      } catch {
        return null;
      }
    }
    try {
      return decodeURIComponent(payload);
    } catch {
      return null;
    }
  }

  return null;
}

/** Stable data URL for mask / img src (original colours preserved). */
export function getSvgDisplayUrl(source: string): string {
  if (!source?.trim()) return '';
  const svgText = dataUrlToSvgText(source);
  if (!svgText) return source.trim();
  return source.trim().startsWith('<svg') ? svgTextToDataUrl(svgText) : source.trim();
}

function applyColorWithDomParser(svgText: string, hex: string): string | null {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return null;
  }

  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== 'svg') return null;

    const parserError = doc.querySelector('parsererror');
    if (parserError) return null;

    let styleEl = svg.querySelector(`style[data-${ICON_TINT_STYLE_ID}]`);
    if (!styleEl) {
      styleEl = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
      styleEl.setAttribute(`data-${ICON_TINT_STYLE_ID}`, 'true');
      svg.insertBefore(styleEl, svg.firstChild);
    }

    styleEl.textContent = `
      ${SHAPE_SELECTOR} {
        fill: ${hex} !important;
        stroke: ${hex} !important;
      }
      [fill="none"], [fill='none'] { fill: none !important; }
      [stroke="none"], [stroke='none'] { stroke: none !important; }
    `;

    svg.querySelectorAll(SHAPE_SELECTOR).forEach((el) => {
      const fill = el.getAttribute('fill');
      const stroke = el.getAttribute('stroke');
      if (fill !== 'none' && fill !== 'transparent') {
        el.setAttribute('fill', hex);
      }
      if (stroke && stroke !== 'none' && stroke !== 'transparent') {
        el.setAttribute('stroke', hex);
      }

      const styleAttr = el.getAttribute('style');
      if (styleAttr) {
        let next = styleAttr;
        if (/fill\s*:/i.test(next)) {
          next = next.replace(/fill\s*:\s*[^;]+/gi, `fill:${hex}`);
        } else {
          next = `fill:${hex};${next}`;
        }
        if (/stroke\s*:/i.test(next)) {
          next = next.replace(/stroke\s*:\s*[^;]+/gi, `stroke:${hex}`);
        }
        el.setAttribute('style', next);
      }
    });

    svg.setAttribute('color', hex);
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return null;
  }
}

/** Mutate SVG markup fills/strokes (fallback when mask is unavailable). */
export function applyColorToSvgMarkup(svgText: string, color: string): string {
  const hex = normalizeIconColor(color);
  if (!hex) return svgText;

  const fromDom = applyColorWithDomParser(svgText, hex);
  if (fromDom) return fromDom;

  let svg = svgText.trim();
  svg = svg.replace(/<svg\b([^>]*)>/i, (_match, attrs: string) => {
    const next = attrs
      .replace(/\sfill="[^"]*"/gi, '')
      .replace(/\sstroke="[^"]*"/gi, '');
    return `<svg${next} fill="${hex}" color="${hex}">`;
  });

  const shapeTags = ['path', 'circle', 'rect', 'polygon', 'ellipse', 'line', 'polyline', 'g'];
  for (const tag of shapeTags) {
    const re = new RegExp(`<${tag}\\b([^>]*?)\\/?>`, 'gi');
    svg = svg.replace(re, (_m, attrs: string) => {
      let next = attrs
        .replace(/\sfill="(?!none|transparent)[^"]*"/gi, '')
        .replace(/\sstroke="(?!none|transparent)[^"]*"/gi, '')
        .replace(/style="([^"]*)"/gi, (_s, style: string) => {
          let st = style;
          if (/fill\s*:/i.test(st)) st = st.replace(/fill\s*:\s*[^;]+/gi, `fill:${hex}`);
          else st = `fill:${hex};${st}`;
          if (/stroke\s*:/i.test(st)) st = st.replace(/stroke\s*:\s*[^;]+/gi, `stroke:${hex}`);
          return `style="${st}"`;
        });
      if (!/\bfill="/i.test(next) && !/fill\s*:/i.test(next)) next += ` fill="${hex}"`;
      return `<${tag}${next}>`;
    });
  }

  return svg;
}

/** Monochrome black SVG for CSS mask (alpha-only, ignores original fill colours). */
export function getSvgMaskUrl(source: string): string {
  if (!source?.trim()) return '';
  const svgText = dataUrlToSvgText(source);
  if (!svgText) return getSvgDisplayUrl(source);
  return svgTextToDataUrl(applyColorToSvgMarkup(svgText, '#000000'));
}

/** Returns data URL with embedded colour overrides (fallback). */
export function getColoredSvgDataUrl(source: string, color?: string): string {
  if (!source?.trim()) return '';
  const svgText = dataUrlToSvgText(source);
  if (!svgText) return source.trim();

  const tint = normalizeIconColor(color);
  if (!tint) {
    return getSvgDisplayUrl(source);
  }

  return svgTextToDataUrl(applyColorToSvgMarkup(svgText, tint));
}

export function isSvgSource(value?: string): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  return v.startsWith('<svg') || v.startsWith('data:image/svg+xml');
}
