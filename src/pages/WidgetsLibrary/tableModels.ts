import { format } from "date-fns";

import type { WidgetBundleRecord, WidgetTypeRecord } from "@/controllers/API/widgetsApi";

export type WidgetTableRow = {
  id: string;
  raw: WidgetTypeRecord;
  createdDisplay: string;
  createdSortKey: number;
  title: string;
  bundles: string[];
  widgetType: string;
  system: boolean;
  deprecated: boolean;
};

export type WidgetBundleTableRow = {
  id: string;
  raw: WidgetBundleRecord;
  createdDisplay: string;
  createdSortKey: number;
  title: string;
  alias: string;
  widgetsCount: number;
  system: boolean;
};

export type BundleWidgetListItem = {
  id: string;
  name: string;
  image: string | null;
  raw: Record<string, unknown>;
};

export const PAGINATION_STEPS = [10, 20, 50, 100];

/** e.g. `tb-image;/api/images/system/air_quality_widgets_bundle.svg` → `air_quality_widgets_bundle.svg` */
export function tbImageRefToFilename(imageRef: string | null | undefined): string | null {
  if (!imageRef || typeof imageRef !== "string") return null;
  const trimmed = imageRef.trim();
  if (!trimmed) return null;

  const semi = trimmed.indexOf(";");
  const path = (semi >= 0 ? trimmed.slice(semi + 1) : trimmed).trim();
  const segments = path.split("/").filter(Boolean);
  const filename = segments.length > 0 ? segments[segments.length - 1]! : trimmed;
  return filename || null;
}

function entityIdFromTb(ref: unknown): string {
  if (ref == null) return "";
  if (typeof ref === "string") return ref.trim();
  if (typeof ref === "object" && "id" in ref) {
    return entityIdFromTb((ref as { id?: unknown }).id);
  }
  return "";
}

/** ThingsBoard widgets bundle UUID from a list/detail record. */
export function widgetsBundleIdFromRecord(raw: WidgetBundleRecord): string {
  return entityIdFromTb(raw.id ?? raw.widgetsBundleId ?? raw.widgets_bundle_id);
}

/** ThingsBoard widget type UUID from a list/detail record. */
export function widgetTypeIdFromRecord(raw: Record<string, unknown>): string {
  return entityIdFromTb(raw.id ?? raw.widgetTypeId ?? raw.widget_type_id);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }
  return undefined;
}

function flattenTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenTextList(item));
  }
  if (typeof value === "string") {
    return value.trim() ? [value.trim()] : [];
  }
  if (typeof value === "object" && value) {
    const obj = value as Record<string, unknown>;
    const nested = firstText(obj.name, obj.title, obj.alias, obj.label, obj.bundleAlias, obj.bundleTitle);
    return nested ? [nested] : [];
  }
  return [];
}

function formatCreated(raw: Record<string, unknown>): string {
  const timestamp = raw.createdTime ?? raw.created_time;
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    try {
      return format(timestamp, "yyyy-MM-dd HH:mm:ss");
    } catch {
      return String(timestamp);
    }
  }
  if (typeof timestamp === "string" && timestamp.trim()) return timestamp.trim();
  return "—";
}

function createdSortKey(raw: Record<string, unknown>): number {
  const timestamp = raw.createdTime ?? raw.created_time;
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) return timestamp;
  if (typeof timestamp === "string") {
    const parsed = Number(timestamp);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function extractBundles(raw: WidgetTypeRecord): string[] {
  const values = [
    raw.bundles,
    raw.widgetBundles,
    raw.widget_bundles,
    raw.widgetBundle,
    raw.widget_bundle,
    raw.bundleAliases,
    raw.bundle_aliases,
    raw.bundleAlias,
    raw.bundle_alias,
    raw.bundleNames,
    raw.bundle_names,
    raw.bundleName,
    raw.bundle_name,
    raw.bundleTitles,
    raw.bundle_titles,
    raw.bundleTitle,
    raw.bundle_title,
  ];

  const unique = new Set<string>();
  values.flatMap((value) => flattenTextList(value)).forEach((value) => unique.add(value));
  return Array.from(unique);
}

function extractWidgetTypeLabel(raw: WidgetTypeRecord): string {
  const descriptor =
    raw.descriptor && typeof raw.descriptor === "object"
      ? (raw.descriptor as Record<string, unknown>)
      : null;

  return (
    firstText(
      raw.widgetType,
      raw.widget_type,
      descriptor?.widgetType,
      descriptor?.widget_type,
      descriptor?.type,
      raw.type,
      raw.fqn,
      raw.fullFqn,
    ) || "—"
  );
}

function isSystemWidget(raw: Record<string, unknown>): boolean {
  const direct = firstBoolean(raw.system, raw.isSystem, raw.is_system, raw.builtIn, raw.built_in);
  if (typeof direct === "boolean") return direct;

  const tenantOnly = firstBoolean(raw.tenantOnly, raw.tenant_only);
  if (typeof tenantOnly === "boolean") return !tenantOnly;

  return false;
}

function isDeprecatedWidget(raw: WidgetTypeRecord): boolean {
  return firstBoolean(raw.deprecated, raw.isDeprecated, raw.is_deprecated) ?? false;
}

function extractBundleAlias(raw: WidgetBundleRecord): string {
  return firstText(raw.alias, raw.name, raw.bundleAlias, raw.bundle_alias) || "—";
}

function extractWidgetsCount(raw: WidgetBundleRecord): number {
  const count =
    raw.widgetsCount ??
    raw.widgets_count ??
    raw.widgetTypesCount ??
    raw.widget_types_count ??
    raw.widgetCount ??
    raw.widget_count;

  if (typeof count === "number" && Number.isFinite(count)) return count;
  if (typeof count === "string") {
    const parsed = Number(count);
    if (Number.isFinite(parsed)) return parsed;
  }

  const collection =
    raw.widgets ?? raw.widgetTypes ?? raw.widget_types ?? raw.items ?? raw.widgetTypeInfos ?? raw.widget_type_infos;

  return Array.isArray(collection) ? collection.length : 0;
}

export function toWidgetTableRow(raw: WidgetTypeRecord): WidgetTableRow {
  const title = firstText(raw.name, raw.title, raw.alias, raw.fullFqn, raw.fqn) || "—";
  const created = createdSortKey(raw);
  const fallbackId = `${title}-${created}`;

  return {
    id: entityIdFromTb(raw.id ?? raw.widgetTypeId ?? raw.widget_type_id) || fallbackId,
    raw,
    createdDisplay: formatCreated(raw),
    createdSortKey: created,
    title,
    bundles: extractBundles(raw),
    widgetType: extractWidgetTypeLabel(raw),
    system: isSystemWidget(raw),
    deprecated: isDeprecatedWidget(raw),
  };
}

function widgetImageFromRecord(raw: Record<string, unknown>): string | null {
  const descriptor =
    raw.descriptor && typeof raw.descriptor === "object"
      ? (raw.descriptor as Record<string, unknown>)
      : null;
  const image = firstText(raw.image, descriptor?.image);
  return image || null;
}

function widgetNameFromRecord(raw: Record<string, unknown>, index: number): string {
  const descriptor =
    raw.descriptor && typeof raw.descriptor === "object"
      ? (raw.descriptor as Record<string, unknown>)
      : null;
  return (
    firstText(raw.name, raw.title, raw.alias, descriptor?.name, raw.fullFqn, raw.fqn) ||
    `Widget ${index + 1}`
  );
}

export function bundleTitleFromDetail(detail: Record<string, unknown>, fallback = ""): string {
  return firstText(detail.title, detail.name, detail.alias, fallback) || fallback || "Widgets bundle";
}

/** Widget rows from widget type records (list-widget-types-infos or embedded in bundle detail). */
export function widgetsFromWidgetTypeRecords(records: WidgetTypeRecord[]): BundleWidgetListItem[] {
  return widgetsFromBundleDetail({ widgetTypes: records });
}

/** Widget rows from `POST /iot-widgets/get-widget-bundle` response. */
export function widgetsFromBundleDetail(detail: Record<string, unknown>): BundleWidgetListItem[] {
  const collection =
    detail.widgetTypeInfos ??
    detail.widget_type_infos ??
    detail.widgetTypes ??
    detail.widget_types ??
    detail.widgets ??
    detail.items;

  if (!Array.isArray(collection)) return [];

  return collection
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((raw, index) => {
      const name = widgetNameFromRecord(raw, index);
      const fallbackId = `${name}-${index}`;
      return {
        id: widgetTypeIdFromRecord(raw) || fallbackId,
        name,
        image: widgetImageFromRecord(raw),
        raw,
      };
    });
}

export function toWidgetBundleTableRow(raw: WidgetBundleRecord): WidgetBundleTableRow {
  const title = firstText(raw.title, raw.name, raw.alias) || "—";
  const created = createdSortKey(raw);
  const fallbackId = `${title}-${created}`;

  return {
    id: widgetsBundleIdFromRecord(raw) || fallbackId,
    raw,
    createdDisplay: formatCreated(raw),
    createdSortKey: created,
    title,
    alias: extractBundleAlias(raw),
    widgetsCount: extractWidgetsCount(raw),
    system: isSystemWidget(raw),
  };
}
