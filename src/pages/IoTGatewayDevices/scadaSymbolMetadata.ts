/** SCADA symbol: optional JSON inside `<tb:metadata><![CDATA[...]]></tb:metadata>`. */

export const TB_SVG_NS = "https://thingsboard.io/svg";

const META_BLOCK = /<tb:metadata[^>]*>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/tb:metadata>/i;

export type ScadaBehaviorType = "value" | "action" | "widgetAction";

export type ScadaBehaviorRow = {
  id: string;
  name: string;
  type: ScadaBehaviorType;
  valueType?: string;
  hint?: string;
  group?: string;
  trueLabel?: string;
  falseLabel?: string;
  stateLabel?: string;
  defaultSettingsLabel?: string;
  [key: string]: unknown;
};

export type ScadaPropertyRow = {
  id: string;
  name: string;
  type: string;
  default?: unknown;
  hint?: string;
  group?: string;
  required?: boolean;
  rowClass?: string;
  fieldClass?: string;
  condition?: string;
  [key: string]: unknown;
};

export type ScadaTagRow = {
  tag: string;
  stateRenderFunction: string;
  clickActionFunction: string;
};

export const SCADA_TAG_STATE_RENDER_TEMPLATE = "function (ctx, element) {\n  \n}";
export const SCADA_TAG_CLICK_ACTION_TEMPLATE = "function (ctx, element, event) {\n  \n}";

export const SCADA_BEHAVIOR_TYPE_OPTIONS: { value: ScadaBehaviorType; label: string }[] = [
  { value: "value", label: "Value" },
  { value: "action", label: "Action" },
  { value: "widgetAction", label: "Widget action" },
];

export const SCADA_VALUE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "STRING", label: "String" },
  { value: "INTEGER", label: "Integer" },
  { value: "DOUBLE", label: "Double" },
  { value: "BOOLEAN", label: "Boolean" },
  { value: "JSON", label: "JSON" },
];

export const SCADA_PROPERTY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "switch", label: "Switch" },
  { value: "color", label: "Color" },
  { value: "color_settings", label: "Color settings" },
  { value: "select", label: "Select" },
  { value: "font", label: "Font" },
  { value: "units", label: "Units" },
  { value: "textarea", label: "Textarea" },
];

export function getTbTag(el: Element): string | null {
  const n = el.getAttributeNS(TB_SVG_NS, "tag");
  if (n?.trim()) return n.trim();
  const raw = el.getAttribute("tb:tag");
  return raw?.trim() || null;
}

export function collectTaggedElements(root: Document | Element): Element[] {
  const doc = "documentElement" in root ? root : null;
  const top = doc?.documentElement ?? (root as Element);
  if (!top) return [];
  const out: Element[] = [];
  const walk = (node: Element) => {
    if (getTbTag(node)) out.push(node);
    for (const ch of node.children) walk(ch as Element);
  };
  walk(top);
  return out;
}

export function parseTbMetadata(svg: string): Record<string, unknown> {
  const m = svg.match(META_BLOCK);
  if (!m?.[1]) return {};
  try {
    const j = JSON.parse(m[1].trim()) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function normalizeBehaviorType(v: unknown): ScadaBehaviorType {
  const s = String(v ?? "value").trim();
  if (s === "action" || s === "widgetAction") return s;
  return "value";
}

function normalizeBehaviorRow(raw: unknown): ScadaBehaviorRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) return null;
  return {
    ...o,
    id,
    name: String(o.name ?? ""),
    type: normalizeBehaviorType(o.type),
    valueType: o.valueType != null ? String(o.valueType) : undefined,
    hint: o.hint != null ? String(o.hint) : undefined,
    group: o.group != null ? String(o.group) : undefined,
    trueLabel: o.trueLabel != null ? String(o.trueLabel) : undefined,
    falseLabel: o.falseLabel != null ? String(o.falseLabel) : undefined,
    stateLabel: o.stateLabel != null ? String(o.stateLabel) : undefined,
    defaultSettingsLabel:
      o.defaultSettingsLabel != null
        ? String(o.defaultSettingsLabel)
        : o.defaultLabel != null
          ? String(o.defaultLabel)
          : undefined,
  };
}

function normalizePropertyRow(raw: unknown): ScadaPropertyRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) return null;
  return {
    ...o,
    id,
    name: String(o.name ?? ""),
    type: String(o.type ?? "text").trim() || "text",
    hint: o.hint != null ? String(o.hint) : undefined,
    group: o.group != null ? String(o.group) : undefined,
    default: o.default,
    required: o.required === true,
    rowClass: o.rowClass != null ? String(o.rowClass) : undefined,
    fieldClass: o.fieldClass != null ? String(o.fieldClass) : undefined,
    condition: o.condition != null ? String(o.condition) : undefined,
  };
}

function extractArray(meta: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const key of keys) {
    const v = meta[key];
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try {
        const parsed = JSON.parse(v) as unknown;
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return [parsed];
      } catch {
        /* ignore */
      }
    }
  }
  return [];
}

export function readBehaviorRows(meta: Record<string, unknown>): ScadaBehaviorRow[] {
  return extractArray(meta, "behavior", "behaviorConfig", "behaviors")
    .map(normalizeBehaviorRow)
    .filter((r): r is ScadaBehaviorRow => r != null);
}

export function readPropertyRows(meta: Record<string, unknown>): ScadaPropertyRow[] {
  return extractArray(meta, "properties", "propertiesConfig", "property")
    .map(normalizePropertyRow)
    .filter((r): r is ScadaPropertyRow => r != null);
}

/** Unique `tb:tag` values from SVG markup (first-seen order). */
export function collectSvgTagNames(svg: string): string[] {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return [];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const el of collectTaggedElements(doc)) {
      const tag = getTbTag(el);
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      out.push(tag);
    }
    return out;
  } catch {
    return [];
  }
}

function normalizeMetadataTag(raw: unknown): ScadaTagRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const tag = String(o.tag ?? "").trim();
  if (!tag) return null;
  const actions = o.actions;
  let clickActionFunction = "";
  if (actions && typeof actions === "object" && !Array.isArray(actions)) {
    const click = (actions as Record<string, unknown>).click;
    if (click && typeof click === "object" && !Array.isArray(click)) {
      clickActionFunction = String((click as Record<string, unknown>).actionFunction ?? "");
    }
  }
  return {
    tag,
    stateRenderFunction: typeof o.stateRenderFunction === "string" ? o.stateRenderFunction : "",
    clickActionFunction,
  };
}

export function readTagRows(meta: Record<string, unknown>, svgTagNames: string[]): ScadaTagRow[] {
  const metaByTag = new Map<string, ScadaTagRow>();
  for (const item of extractArray(meta, "tags")) {
    const row = normalizeMetadataTag(item);
    if (row) metaByTag.set(row.tag, row);
  }
  const seen = new Set<string>();
  const rows: ScadaTagRow[] = [];
  for (const name of svgTagNames) {
    const tag = name.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    const hit = metaByTag.get(tag);
    rows.push(
      hit ?? {
        tag,
        stateRenderFunction: "",
        clickActionFunction: "",
      },
    );
  }
  return rows;
}

export function tagRowsToMetadataTags(rows: ScadaTagRow[]): Record<string, unknown>[] {
  return rows
    .filter((r) => r.tag.trim())
    .map((row) => {
      const entry: Record<string, unknown> = { tag: row.tag.trim() };
      const stateFn = row.stateRenderFunction.trim();
      const clickFn = row.clickActionFunction.trim();
      if (stateFn) entry.stateRenderFunction = stateFn;
      if (clickFn) {
        entry.actions = { click: { actionFunction: clickFn } };
      }
      return entry;
    });
}

export function readWidgetSize(meta: Record<string, unknown>): { cols: number; rows: number } {
  const wx = meta.widgetSizeX;
  const wy = meta.widgetSizeY;
  if (typeof wx === "number" && typeof wy === "number") {
    return { cols: wx, rows: wy };
  }
  const ws = meta.widgetSize;
  if (ws && typeof ws === "object" && !Array.isArray(ws)) {
    const o = ws as Record<string, unknown>;
    const cols = Number(o.cols ?? o.x ?? wx ?? 3);
    const rows = Number(o.rows ?? o.y ?? wy ?? 4);
    return {
      cols: Number.isFinite(cols) ? cols : 3,
      rows: Number.isFinite(rows) ? rows : 4,
    };
  }
  const cols = Number(wx ?? 3);
  const rows = Number(wy ?? 4);
  return {
    cols: Number.isFinite(cols) ? cols : 3,
    rows: Number.isFinite(rows) ? rows : 4,
  };
}

export function buildTbMetadataPatch(input: {
  title: string;
  description: string;
  searchTags: string[];
  widgetCols: number;
  widgetRows: number;
  stateRenderFunction: string;
  behavior: ScadaBehaviorRow[];
  properties: ScadaPropertyRow[];
  tags: ScadaTagRow[];
}): Record<string, unknown> {
  return {
    title: input.title,
    description: input.description,
    searchTags: input.searchTags,
    widgetSizeX: input.widgetCols,
    widgetSizeY: input.widgetRows,
    stateRenderFunction: input.stateRenderFunction,
    behavior: input.behavior,
    properties: input.properties,
    tags: tagRowsToMetadataTags(input.tags),
  };
}

export function mergeTbMetadataIntoSvg(svg: string, patch: Record<string, unknown>): string {
  const prev = parseTbMetadata(svg);
  const merged: Record<string, unknown> = { ...prev, ...patch };
  delete merged.behaviorConfig;
  delete merged.propertiesConfig;
  delete merged.widgetSize;
  const json = JSON.stringify(merged);
  const block = `<tb:metadata><![CDATA[${json}]]></tb:metadata>`;
  let next = svg.match(META_BLOCK) ? svg.replace(META_BLOCK, block) : insertMetadataAfterSvgOpen(svg, block);
  if (!/xmlns:tb\s*=/.test(next)) {
    next = next.replace(/<svg\b/i, '<svg xmlns:tb="https://thingsboard.io/svg" ');
  }
  return next;
}

function insertMetadataAfterSvgOpen(svg: string, block: string): string {
  const m = svg.match(/^[\s\S]*?<svg\b[^>]*>/i);
  if (!m) return svg;
  const end = m[0].length;
  return `${svg.slice(0, end)}${block}${svg.slice(end)}`;
}

export function updateTbTagAtIndex(svg: string, flatIndex: number, newTag: string | null): string {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return svg;
    const list = collectTaggedElements(doc);
    const el = list[flatIndex];
    if (!el) return svg;
    const t = newTag?.trim();
    if (!t) {
      el.removeAttributeNS(TB_SVG_NS, "tag");
      el.removeAttribute("tb:tag");
    } else {
      el.setAttributeNS(TB_SVG_NS, "tag", t);
    }
    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch {
    return svg;
  }
}
