import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  Gauge,
  Layers3,
  LineChart,
  Map as MapIcon,
  Maximize2,
  Move,
  Plus,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
  SquareMousePointer,
  Table2,
  Wifi,
  X,
  Download,
  Edit,
} from "lucide-react";
import { toast } from "sonner";

import {
  entityIdFromTb,
  getDashboard,
  getWidgetType,
  saveDashboard,
  getIotWidgetsImageFromBundleRef,
  isRenderableTbWidgetImageRef,
  listWidgetBundles,
  listWidgetTypes,
  listWidgetTypesInfos,
  TB_SYSTEM_TENANT_ID,
  type WidgetDeprecatedFilter,
  type WidgetsBundleSummary,
  type WidgetTypePage,
  type WidgetTypeSummary,
} from "@/controllers/thingsboarddashbaordapis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { WidgetEditPanel, type WidgetConfig } from "@/pages/WidgetsLibrary/WidgetEditPanel";
import { DashboardHeader } from "./DashboardHeader";
import { FiltersDialog } from "./FiltersDialog";

const GRID_CELL_WIDTH = 48;
const GRID_CELL_HEIGHT = 40;
const GRID_SIDE_PADDING = 24;
/** Top inset for the widget grid (snap/move clamp). Matches side padding; previously larger for an inline canvas title since removed. */
const GRID_TOP_OFFSET = GRID_SIDE_PADDING;
const DEFAULT_WIDGET_WIDTH = GRID_CELL_WIDTH * 8;
const DEFAULT_WIDGET_HEIGHT = GRID_CELL_HEIGHT * 7;
const MIN_WIDGET_WIDTH = GRID_CELL_WIDTH * 4;
const MIN_WIDGET_HEIGHT = GRID_CELL_HEIGHT * 4;
const DEFAULT_CANVAS_HEIGHT = 720;
const WIDGET_TYPES_PAGE_SIZE = 20;
const WIDGET_IMAGE_PREFETCH_CONCURRENCY = 3;

type CachedWidgetTypesPage = {
  rows: WidgetTypeSummary[];
  hasNext: boolean;
  totalElements: number | null;
};

type WidgetBundleId =
  | "charts"
  | "cards"
  | "alarm-widgets"
  | "tables"
  | "maps"
  | "gauges"
  | "buttons"
  | "control-widgets"
  | "status-indicators";

type WidgetTemplate = {
  id: string;
  name: string;
  description: string;
};

type WidgetBundle = {
  id: WidgetBundleId;
  name: string;
  description: string;
  accentClassName: string;
  icon: React.ComponentType<{ className?: string }>;
  templates: WidgetTemplate[];
};

const defaultDashboardWidgetConfig: WidgetConfig = {
  showTitle: false,
  title: "",
  titleTooltip: "",
  showTitleIcon: false,
  titleIcon: "",
  iconSize: "24px",
  iconColor: "",
  textColor: "",
  backgroundColor: "",
  padding: "",
  margin: "",
  borderRadius: "",
  dropShadow: false,
  enableFullscreen: false,
  resizable: true,
  preserveAspectRatio: false,
  hideMobile: false,
  hideDesktop: false,
  order: null,
  height: null,
};

/** Snapshot passed from `WidgetEditPanel` on Apply — matches `WidgetEditor.handleApplyChanges` inputs. */
type DashboardWidgetHtmlPreviewPayload = {
  htmlCode: string;
  cssCode: string;
  widgetConfig: WidgetConfig;
  titleColor: string;
  fontSettings: {
    size: string;
    sizeUnit: string;
    fontFamily: string;
    weight: string;
    style: string;
    lineHeight: string;
  };
};

type EditorWidget = {
  id: string;
  bundleId: WidgetBundleId;
  title: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Widget type ID from the API (for saving to backend) */
  widgetTypeId?: string;
  /** HTML/CSS preview built like `WidgetEditor` apply (iframe blob document). */
  htmlPreview?: DashboardWidgetHtmlPreviewPayload;
  /** Widget preview image blob URL */
  previewImageUrl?: string;
  /** Original TB image reference (e.g., "tb-image;/api/images/system/file.png") */
  widgetImageRef?: string;
};

type InteractionState = {
  widgetId: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
};

type DashboardEditorLocationState = {
  dashboard?: Record<string, unknown>;
  dashboardTitle?: string;
};

type SelectedBundleFilter = {
  alias: string;
  title: string;
  bundleId?: string;
};

const WIDGET_BUNDLES: WidgetBundle[] = [
  {
    id: "charts",
    name: "Charts",
    description: "Trend widgets and time series visuals",
    accentClassName: "from-orange-100 via-yellow-50 to-emerald-100",
    icon: LineChart,
    templates: [
      { id: "time-series", name: "Time series chart", description: "Realtime - last 1 minute" },
      { id: "bar-chart", name: "Bar chart", description: "Compare multiple data points" },
    ],
  },
  {
    id: "cards",
    name: "Cards",
    description: "Compact KPI and metric widgets",
    accentClassName: "from-blue-100 via-sky-50 to-indigo-100",
    icon: Layers3,
    templates: [
      { id: "metric-card", name: "Metric card", description: "Single KPI summary" },
      { id: "device-card", name: "Device status card", description: "Device quick summary" },
    ],
  },
  {
    id: "alarm-widgets",
    name: "Alarm widgets",
    description: "Alert summaries and alarm lists",
    accentClassName: "from-rose-100 via-red-50 to-orange-100",
    icon: Bell,
    templates: [
      { id: "alarm-counter", name: "Alarm counter", description: "Active alarm count" },
      { id: "alarm-list", name: "Alarm list", description: "Recent alarm stream" },
    ],
  },
  {
    id: "tables",
    name: "Tables",
    description: "Tabular widgets and entity lists",
    accentClassName: "from-slate-100 via-zinc-50 to-gray-100",
    icon: Table2,
    templates: [
      { id: "entity-table", name: "Entity table", description: "Devices and attributes" },
      { id: "timeseries-table", name: "Timeseries table", description: "Latest values grid" },
    ],
  },
  {
    id: "maps",
    name: "Maps",
    description: "Location-aware and map widgets",
    accentClassName: "from-cyan-100 via-sky-50 to-emerald-100",
    icon: MapIcon,
    templates: [
      { id: "marker-map", name: "Marker map", description: "Device markers on map" },
      { id: "route-map", name: "Route map", description: "Movement and route paths" },
    ],
  },
  {
    id: "gauges",
    name: "Analogue gauges",
    description: "Circular and radial indicators",
    accentClassName: "from-amber-100 via-orange-50 to-stone-100",
    icon: Gauge,
    templates: [
      { id: "radial-gauge", name: "Radial gauge", description: "Gauge for single metric" },
      { id: "knob-gauge", name: "Knob gauge", description: "Control-like gauge" },
    ],
  },
  {
    id: "buttons",
    name: "Buttons",
    description: "Action and command widgets",
    accentClassName: "from-violet-100 via-fuchsia-50 to-purple-100",
    icon: SquareMousePointer,
    templates: [
      { id: "action-button", name: "Action button", description: "Trigger a dashboard action" },
      { id: "navigate-button", name: "Navigate button", description: "Open a linked view" },
    ],
  },
  {
    id: "control-widgets",
    name: "Control widgets",
    description: "Switches and interactive controls",
    accentClassName: "from-teal-100 via-cyan-50 to-sky-100",
    icon: SlidersHorizontal,
    templates: [
      { id: "toggle-control", name: "Toggle control", description: "Switch and slider UI" },
      { id: "input-control", name: "Input control", description: "Interactive command field" },
    ],
  },
  {
    id: "status-indicators",
    name: "Status indicators",
    description: "Connectivity and state widgets",
    accentClassName: "from-lime-100 via-green-50 to-emerald-100",
    icon: Wifi,
    templates: [
      { id: "signal-status", name: "Signal status", description: "Signal strength summary" },
      { id: "health-status", name: "Health status", description: "Online/offline state" },
    ],
  },
];

function snap(value: number, step: number) {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getDashboardTitleFromPayload(payload: Record<string, unknown> | null): string {
  if (!payload) return "Untitled dashboard";
  return (
    getString(payload.title) ||
    getString(payload.name) ||
    getString(payload.dashboard_title) ||
    "Untitled dashboard"
  );
}

function coerceWidgetBundleId(raw: unknown): WidgetBundleId {
  const s = typeof raw === "string" ? raw.trim() : "";
  const found = WIDGET_BUNDLES.find((b) => b.id === s);
  return found ? found.id : "charts";
}

async function normalizeExistingWidgets(payload: Record<string, unknown> | null): Promise<EditorWidget[]> {
  if (!payload) return [];
  
  console.log("[normalizeExistingWidgets] Processing payload:", payload);
  
  let rawWidgets: any[] = [];
  if (Array.isArray(payload.widgets)) {
    rawWidgets = payload.widgets;
    console.log("[normalizeExistingWidgets] Found widgets array with", rawWidgets.length, "items");
  } else if (payload.widgets && typeof payload.widgets === "object") {
    rawWidgets = Object.values(payload.widgets);
    console.log("[normalizeExistingWidgets] Found widgets object with", rawWidgets.length, "items");
  } else {
    // Try configuration.widgets (ThingsBoard structure)
    const config = getRecord(payload.configuration);
    if (config && config.widgets && typeof config.widgets === "object") {
      rawWidgets = Object.values(config.widgets);
      console.log("[normalizeExistingWidgets] Found configuration.widgets with", rawWidgets.length, "items");
    }
  }

  console.log("[normalizeExistingWidgets] Total raw widgets:", rawWidgets.length);

  // Extract layout information from states if available
  const configuration = getRecord(payload.configuration) || payload;
  const states = getRecord(configuration.states);
  const defaultState = getRecord(states?.default);
  const layouts = getRecord(defaultState?.layouts);
  const mainLayout = getRecord(layouts?.main);
  const stateWidgetsLayout = getRecord(mainLayout?.widgets) || {};

  const legacyLayoutArray = Array.isArray(payload.layout) ? payload.layout : [];

  const normalized = await Promise.all(
    rawWidgets.map(async (widget, index) => {
      const widgetRecord = getRecord(widget) ?? {};
      const widgetId = getString(widgetRecord.id);
      
      // Try to find layout in states by widgetId, then fallback to legacy layout array
      const stateLayout = widgetId ? getRecord(stateWidgetsLayout[widgetId]) : null;
      const legacyLayout = getRecord(legacyLayoutArray[index]);
      const layoutRecord = stateLayout || legacyLayout || {};

      console.log(`[normalizeExistingWidgets] Widget ${index + 1}: id="${widgetId}"`, { stateLayout, legacyLayout });
      
      let apiWidgetData: any = null;
      if (widgetId) {
        try {
          console.log(`[normalizeExistingWidgets] Calling getWidgetType for widget id: ${widgetId}`);
          apiWidgetData = await getWidgetType(widgetId);
          console.log(`[normalizeExistingWidgets] Successfully fetched widget type for ${widgetId}:`, apiWidgetData);
        } catch (error) {
          console.warn(`Failed to fetch widget type for ${widgetId}:`, error);
        }
      } else {
        console.warn(`[normalizeExistingWidgets] Widget ${index + 1} has no valid id`);
      }

      // Use API data if available, otherwise fallback to widget record
      const source = apiWidgetData || widgetRecord;
      const config = getRecord(source.config) ?? {};
      const settings = getRecord(config.settings) ?? {};

      const width =
        getNumber(layoutRecord.width_px) ??
        (getNumber(layoutRecord.sizeX) != null ? getNumber(layoutRecord.sizeX)! * GRID_CELL_WIDTH :
         (getNumber(source.sizeX) != null ? getNumber(source.sizeX)! * GRID_CELL_WIDTH : 
          (getNumber(layoutRecord.w) != null ? getNumber(layoutRecord.w)! * GRID_CELL_WIDTH : DEFAULT_WIDGET_WIDTH)));
      const height =
        getNumber(layoutRecord.height_px) ??
        (getNumber(layoutRecord.sizeY) != null ? getNumber(layoutRecord.sizeY)! * GRID_CELL_HEIGHT :
         (getNumber(source.sizeY) != null ? getNumber(source.sizeY)! * GRID_CELL_HEIGHT :
          (getNumber(layoutRecord.h) != null ? getNumber(layoutRecord.h)! * GRID_CELL_HEIGHT : DEFAULT_WIDGET_HEIGHT)));
      const x =
        getNumber(layoutRecord.x_px) ??
        (getNumber(layoutRecord.col) != null ? getNumber(layoutRecord.col)! * GRID_CELL_WIDTH :
         (getNumber(source.col) != null ? getNumber(source.col)! * GRID_CELL_WIDTH :
          (getNumber(layoutRecord.x) != null ? getNumber(layoutRecord.x)! * GRID_CELL_WIDTH : GRID_SIDE_PADDING)));
      const y =
        getNumber(layoutRecord.y_px) ??
        (getNumber(layoutRecord.row) != null ? getNumber(layoutRecord.row)! * GRID_CELL_HEIGHT + GRID_TOP_OFFSET :
         (getNumber(source.row) != null ? getNumber(source.row)! * GRID_CELL_HEIGHT + GRID_TOP_OFFSET :
          (getNumber(layoutRecord.y) != null ? getNumber(layoutRecord.y)! * GRID_CELL_HEIGHT + GRID_TOP_OFFSET : GRID_TOP_OFFSET)));

      const title =
        getString(config.title) ||
        getString(source.title) ||
        getString(source.name) ||
        getString(widgetRecord.widget_title) ||
        `Widget ${index + 1}`;

      const htmlPreviewRaw = source.html_preview || settings.html_preview;
      let htmlPreview =
        htmlPreviewRaw && typeof htmlPreviewRaw === "object" && !Array.isArray(htmlPreviewRaw)
          ? (htmlPreviewRaw as DashboardWidgetHtmlPreviewPayload)
          : undefined;

      // If no htmlPreview, try to construct it from cardHtml/cardCss if they exist
      if (!htmlPreview && (settings.cardHtml || settings.cardCss)) {
        htmlPreview = {
          htmlCode: getString(settings.cardHtml),
          cssCode: getString(settings.cardCss),
          widgetConfig: {
            ...defaultDashboardWidgetConfig,
            showTitle: Boolean(config.showTitle),
            title: title,
            titleTooltip: getString(config.titleTooltip),
            showTitleIcon: Boolean(config.showTitleIcon),
            titleIcon: getString(config.titleIcon),
            iconSize: getString(config.iconSize) || defaultDashboardWidgetConfig.iconSize,
            iconColor: getString(config.iconColor),
            textColor: getString(config.color),
            backgroundColor: getString(config.backgroundColor),
            padding: getString(config.padding),
            margin: getString(config.margin),
            borderRadius: getString(config.borderRadius),
            dropShadow: Boolean(config.dropShadow),
            enableFullscreen: Boolean(config.enableFullscreen),
            resizable:
              config.resizable != null
                ? Boolean(config.resizable)
                : defaultDashboardWidgetConfig.resizable,
            preserveAspectRatio:
              config.preserveAspectRatio != null
                ? Boolean(config.preserveAspectRatio)
                : defaultDashboardWidgetConfig.preserveAspectRatio,
            hideMobile:
              config.hideMobile != null
                ? Boolean(config.hideMobile)
                : config.hideOnMobile != null
                  ? Boolean(config.hideOnMobile)
                  : defaultDashboardWidgetConfig.hideMobile,
            hideDesktop:
              config.hideDesktop != null
                ? Boolean(config.hideDesktop)
                : config.hideOnDesktop != null
                  ? Boolean(config.hideOnDesktop)
                  : defaultDashboardWidgetConfig.hideDesktop,
            order:
              typeof config.mobileOrder === "number"
                ? config.mobileOrder
                : typeof config.order === "number"
                  ? config.order
                  : defaultDashboardWidgetConfig.order,
            height:
              typeof config.mobileHeight === "number"
                ? config.mobileHeight
                : typeof config.height === "number"
                  ? config.height
                  : defaultDashboardWidgetConfig.height,
          },
          titleColor: getString(config.color) || "#000000",
          fontSettings: {
            size: "",
            sizeUnit: "px",
            fontFamily: "",
            weight: "",
            style: "",
            lineHeight: "",
          },
        };
      }

      const widgetImageRef = getString(source.widget_image_ref) || getString(source.image);
      let previewImageUrl: string | undefined;
      if (widgetImageRef && isRenderableTbWidgetImageRef(widgetImageRef)) {
        try {
          const blob = await getIotWidgetsImageFromBundleRef(widgetImageRef);
          if (blob) {
            previewImageUrl = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.warn("Failed to fetch widget preview image:", error);
        }
      }

      const explicitBundle = getString(source.bundle_id) || getString(source.typeFullFqn)?.split(".")[1];
      return {
        id: widgetId || `existing-widget-${index + 1}`,
        widgetTypeId: widgetId, // Store the widget type ID for saving
        bundleId: explicitBundle ? coerceWidgetBundleId(explicitBundle) : WIDGET_BUNDLES[index % WIDGET_BUNDLES.length].id,
        title,
        description: getString(source.description) || "Imported from dashboard payload",
        x,
        y: Math.max(GRID_TOP_OFFSET, y),
        width: Math.max(MIN_WIDGET_WIDTH, width ?? DEFAULT_WIDGET_WIDTH),
        height: Math.max(MIN_WIDGET_HEIGHT, height ?? DEFAULT_WIDGET_HEIGHT),
        ...(htmlPreview ? { htmlPreview } : {}),
        ...(previewImageUrl ? { previewImageUrl } : {}),
        ...(widgetImageRef ? { widgetImageRef } : {}),
      };
    }),
  );

  return normalized.filter((widget) => Number.isFinite(widget.width) && Number.isFinite(widget.height));
}

/** Merges loaded dashboard JSON with editor title + widget/layout for `save-dashboard` `payload`. */
function buildDashboardSavePayload(args: {
  dashboardId: string;
  dashboardTitle: string;
  dashboardPayload: Record<string, unknown> | null;
  widgets: EditorWidget[];
}): Record<string, unknown> {
  const { dashboardId, dashboardTitle, dashboardPayload, widgets } = args;
  const base = dashboardPayload ? { ...dashboardPayload } : {};

  // Build widgets configuration in ThingsBoard format
  const widgetsConfig: Record<string, unknown> = {};
  const layoutWidgets: Record<string, unknown> = {};

  for (const w of widgets) {
    // Use widgetTypeId as the key in widgets config (this is the widget type's ID from the API)
    // Fall back to widget instance id if widgetTypeId is not available
    const widgetTypeKey = w.widgetTypeId || w.id;
    
    console.log('[buildDashboardSavePayload] Widget:', w.title, 'widgetTypeId:', w.widgetTypeId, 'Using key:', widgetTypeKey);
    
    // Calculate grid position
    const sizeX = Math.round(w.width / GRID_CELL_WIDTH);
    const sizeY = Math.round(w.height / GRID_CELL_HEIGHT);
    const row = Math.round((w.y - GRID_TOP_OFFSET) / GRID_CELL_HEIGHT);
    const col = Math.round(w.x / GRID_CELL_WIDTH);

    // Build widget configuration
    const widgetConfig: Record<string, unknown> = {
      typeFullFqn: `system.${w.bundleId}.${w.title.toLowerCase().replace(/\s+/g, "_")}`,
      type: "static",
      sizeX,
      sizeY,
      config: {
        datasources: [
          {
            type: "static",
            name: "function",
            dataKeys: [
              {
                name: "f(x)",
                type: "function",
                label: "Random",
                color: "#2196f3",
                settings: {},
                _hash: Math.random(),
                funcBody: "var value = prevValue + Math.random() * 100 - 50;\nvar multiplier = Math.pow(10, 2 || 0);\nvar value = Math.round(value * multiplier) / multiplier;\nif (value < -1000) {\n\tvalue = -1000;\n} else if (value > 1000) {\n\tvalue = 1000;\n}\nreturn value;"
              }
            ]
          }
        ],
        timewindow: {
          realtime: {
            timewindowMs: 60000
          }
        },
        showTitle: w.htmlPreview?.widgetConfig?.showTitle ?? false,
        backgroundColor: w.htmlPreview?.widgetConfig?.backgroundColor ?? "rgb(255, 255, 255)",
        color: w.htmlPreview?.widgetConfig?.textColor ?? "rgba(0, 0, 0, 0.87)",
        padding: w.htmlPreview?.widgetConfig?.padding ?? "8px",
        settings: w.htmlPreview ? {
          cardHtml: w.htmlPreview.htmlCode,
          cardCss: w.htmlPreview.cssCode
        } : {},
        title: w.title,
        dropShadow: w.htmlPreview?.widgetConfig?.dropShadow ?? true,
        ...(w.widgetImageRef ? { widget_image_ref: w.widgetImageRef } : {})
      },
      row,
      col,
      id: widgetTypeKey
    };

    widgetsConfig[widgetTypeKey] = widgetConfig;

    // Build layout configuration
    layoutWidgets[widgetTypeKey] = {
      sizeX,
      sizeY,
      row,
      col
    };
  }

  // Build complete configuration object
  const configuration = {
    description: dashboardTitle,
    widgets: widgetsConfig,
    states: {
      default: {
        name: dashboardTitle,
        root: true,
        layouts: {
          main: {
            widgets: layoutWidgets,
            gridSettings: {
              layoutType: "default",
              backgroundColor: "#eeeeee",
              columns: 24,
              margin: 10,
              outerMargin: true,
              backgroundSizeMode: "100%"
            }
          }
        }
      }
    },
    entityAliases: {},
    filters: {},
    timewindow: {
      displayValue: "",
      hideAggregation: false,
      hideAggInterval: false,
      hideTimezone: false,
      selectedTab: 0,
      realtime: {
        realtimeType: 0,
        interval: 1000,
        timewindowMs: 60000,
        quickInterval: "CURRENT_DAY",
        hideInterval: false,
        hideLastInterval: false,
        hideQuickInterval: false
      },
      history: {
        historyType: 0,
        interval: 1000,
        timewindowMs: 60000,
        fixedTimewindow: {
          startTimeMs: Date.now() - 86400000,
          endTimeMs: Date.now()
        },
        quickInterval: "CURRENT_DAY",
        hideInterval: false,
        hideLastInterval: false,
        hideFixedInterval: false,
        hideQuickInterval: false
      },
      aggregation: {
        type: "AVG",
        limit: 25000
      }
    },
    settings: {
      stateControllerId: "entity",
      showTitle: false,
      showDashboardsSelect: true,
      showEntitiesSelect: true,
      showDashboardTimewindow: true,
      showDashboardExport: true,
      toolbarAlwaysOpen: true
    }
  };

  // Build the final payload structure
  return {
    title: dashboardTitle,
    image: getString(base.image) || "",
    mobileHide: Boolean(base.mobileHide),
    mobileOrder: getNumber(base.mobileOrder) ?? 0,
    configuration,
    name: dashboardTitle,
    resources: base.resources ?? null,
    id: base.id ?? {
      entityType: "DASHBOARD",
      id: dashboardId
    },
    createdTime: getNumber(base.createdTime) ?? Date.now(),
    tenantId: base.tenantId ?? {
      entityType: "TENANT",
      id: ""
    },
    assignedCustomers: base.assignedCustomers ?? null,
    version: typeof base.version === "number" ? base.version + 1 : 1,
    externalId: base.externalId ?? null
  };
}

function resolveWidgetBundleForAlias(alias: string): WidgetBundle {
  const key = alias.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  const map: Record<string, WidgetBundleId> = {
    charts: "charts",
    cards: "cards",
    alarm_widgets: "alarm-widgets",
    tables: "tables",
    maps: "maps",
    analogue_gauges: "gauges",
    buttons: "buttons",
    control_widgets: "control-widgets",
    status_indicators: "status-indicators",
    air_quality: "cards",
    scada: "control-widgets",
  };
  const id = map[key];
  if (id) {
    const found = WIDGET_BUNDLES.find((bundle) => bundle.id === id);
    if (found) return found;
  }
  return WIDGET_BUNDLES[0];
}

function bundleAliasFromFqn(fqn: string): string | null {
  const parts = fqn.split(".").filter(Boolean);
  if (parts.length < 2) return null;
  // ThingsBoard: `bundle.widget` (e.g. `cards.html_card`) → bundle alias is the first segment.
  if (parts.length === 2) return parts[0];
  // Scoped: `system.bundle.widget` → bundle alias is the second segment.
  return parts[1];
}

function normalizeWidgetBundleKey(alias: string): string {
  return alias.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
}

function fqnMatchesBundleAlias(fqn: string, bundleAlias: string): boolean {
  const fromFqn = bundleAliasFromFqn(fqn);
  if (!fromFqn) return false;
  return normalizeWidgetBundleKey(fromFqn) === normalizeWidgetBundleKey(bundleAlias);
}

/** Extract image filename from TB widget image reference (e.g., "tb-image;/api/images/system/file.png" → "file.png") */
function extractImageFilename(imageRef: string | null | undefined): string | null {
  if (!imageRef?.trim()) return null;
  const parts = imageRef.split(";");
  if (parts.length < 2) return null;
  const path = parts[1].trim();
  const filename = path.split("/").pop();
  return filename || null;
}

function widgetTypeRowKey(wt: WidgetTypeSummary): string {
  return wt.typeId || wt.fqn;
}

function widgetTypesPageCacheKey(
  filter: WidgetDeprecatedFilter,
  bundleId: string | undefined,
  pageIndex: number,
): string {
  return `${filter}|${bundleId ?? "all"}|${pageIndex}`;
}

function computeWidgetTypesPageHasNext(args: {
  page: WidgetTypePage;
  pageIndex: number;
  pageSize: number;
  totalElements: number | null;
}): boolean {
  const { page, pageIndex, pageSize, totalElements } = args;
  const incomingLen = page.data.length;
  if (incomingLen === 0) return false;
  const loadedCount = pageIndex * pageSize + incomingLen;
  if (typeof totalElements === "number" && loadedCount >= totalElements) return false;
  if (page.hasNext === true) return true;
  if (page.hasNext === false) return false;
  return incomingLen >= pageSize;
}

/** Bounded-concurrency preview loads (`/iot-widgets/get-image`) for the current page. */
async function batchPrefetchWidgetTypeImages(rows: WidgetTypeSummary[], signal: AbortSignal): Promise<void> {
  const refs: string[] = [];
  const seen = new Set<string>();
  for (const wt of rows) {
    const raw = wt.image?.trim();
    if (!raw || seen.has(raw)) continue;
    if (!isRenderableTbWidgetImageRef(raw)) continue;
    seen.add(raw);
    refs.push(raw);
  }
  if (refs.length === 0) return;

  let cursor = 0;
  async function worker(): Promise<void> {
    while (!signal.aborted) {
      const i = cursor++;
      if (i >= refs.length) return;
      await getIotWidgetsImageFromBundleRef(refs[i]);
    }
  }

  const n = Math.min(WIDGET_IMAGE_PREFETCH_CONCURRENCY, refs.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
}

function WidgetTypesPaginationBar({
  pageIndex,
  totalPages,
  totalElements,
  hasNextPage,
  loading,
  prefetching,
  onPrevious,
  onNext,
}: {
  pageIndex: number;
  totalPages: number | null;
  totalElements: number | null;
  hasNextPage: boolean;
  loading: boolean;
  prefetching: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const currentPage = pageIndex + 1;
  const canGoBack = pageIndex > 0 && !loading;
  const canGoForward = hasNextPage && !loading;

  const progressPct = useMemo(() => {
    if (totalPages != null && totalPages > 0) {
      return Math.min(100, Math.max(0, (currentPage / totalPages) * 100));
    }
    if (hasNextPage) return Math.min(95, currentPage * 12);
    return 100;
  }, [currentPage, totalPages, hasNextPage]);

  const rangeStart = totalElements != null && totalElements > 0 ? pageIndex * WIDGET_TYPES_PAGE_SIZE + 1 : null;
  const rangeEnd =
    totalElements != null && totalElements > 0
      ? Math.min(totalElements, (pageIndex + 1) * WIDGET_TYPES_PAGE_SIZE)
      : null;

  return (
    <nav
      aria-label="Widget list pagination"
      // className="rounded-2xl border border-border/50 bg-gradient-to-b from-muted/30 to-muted/10 p-2 shadow-sm ring-1 ring-black/[0.02]"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canGoBack}
          aria-label="Previous page"
          onClick={onPrevious}
          className={cn(
            "w-7 shrink-0 gap-1.5 rounded-xl border-border/60 bg-background/90 px-3 shadow-sm transition-all",
            "hover:-translate-x-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-md",
            "disabled:translate-x-0 disabled:opacity-40",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          {/* <span className="hidden sm:inline">Previous</span> */}
        </Button>

        <div className="min-w-0 flex-1 space-y-2 px-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-medium tabular-nums text-foreground shadow-sm ring-1 ring-border/50">
              {loading ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary" aria-hidden />
              ) : (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              )}
              Page {currentPage}
              {totalPages != null ? ` of ${totalPages}` : ""}
            </span>

            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/60"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={totalPages ?? 100}
              aria-valuenow={currentPage}
              aria-label="Pagination progress"
            >
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-primary/80 to-sky-400/90 transition-[width] duration-500 ease-out",
                  loading && "animate-pulse",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {prefetching ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-sky-500" aria-hidden />
              Loading artwork previews…
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canGoForward}
          aria-label="Next page"
          onClick={onNext}
          className={cn(
            " shrink-0 w-7 gap-1.5 rounded-xl border-border/60 bg-background/90 px-3 shadow-sm transition-all",
            "hover:translate-x-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-md",
            "disabled:translate-x-0 disabled:opacity-40",
          )}
        >
          {/* <span className="hidden sm:inline">Next</span> */}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

function widgetTypeMatchesSelectedBundle(wt: WidgetTypeSummary, filter: SelectedBundleFilter): boolean {
  if (fqnMatchesBundleAlias(wt.fqn, filter.alias)) return true;
  const wantAlias = normalizeWidgetBundleKey(filter.alias);
  const wantTitle = normalizeWidgetBundleKey(filter.title);
  for (const b of wt.bundles ?? []) {
    const n = typeof b.name === "string" ? normalizeWidgetBundleKey(b.name) : "";
    if (!n) continue;
    if (n === wantAlias || n === wantTitle) return true;
    if (wantAlias.includes(n) || n.includes(wantAlias)) return true;
  }
  return false;
}

function TbBundlePreviewImage({
  image,
  variant = "tile",
}: {
  image: string | null;
  variant?: "tile" | "hero";
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    setSrc(null);
    setPhase("loading");

    if (!image?.trim() || !isRenderableTbWidgetImageRef(image)) {
      setPhase("error");
      return;
    }

    void getIotWidgetsImageFromBundleRef(image).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setPhase("error");
        return;
      }
      const objectUrl = URL.createObjectURL(blob);
      createdUrl = objectUrl;
      setSrc(objectUrl);
      setPhase("ready");
    });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [image]);

  const frameClass =
    variant === "hero"
      ? "flex aspect-[4/3] min-h-[10.5rem] w-full items-center justify-center rounded-xl bg-gradient-to-b from-muted/35 via-background to-muted/20 px-3 py-4 ring-1 ring-border/50"
      : "flex h-[4.5rem] w-full items-center justify-center rounded-xl bg-white/95 px-2 shadow-sm ring-1 ring-black/5";

  const imgClass =
    variant === "hero" ? "max-h-[10rem] max-w-[96%] object-contain drop-shadow-sm" : "max-h-[3.5rem] max-w-full object-contain";

  return (
    <div className={frameClass}>
      {phase === "ready" && src ? (
        <img src={src} alt="" className={imgClass} />
      ) : phase === "loading" ? (
        <div
          className={cn(
            "animate-pulse rounded-lg bg-muted/50",
            variant === "hero" ? "h-32 w-[85%]" : "h-14 w-24",
          )}
        />
      ) : (
        <Layers3 className={cn("text-muted-foreground/35", variant === "hero" ? "h-14 w-14" : "h-8 w-8")} />
      )}
    </div>
  );
}

function ApiWidgetBundleCardPreview({ bundle }: { bundle: WidgetsBundleSummary }) {
  const tenantId = entityIdFromTb(bundle.tenantId);
  const isSystemTenant = tenantId === TB_SYSTEM_TENANT_ID;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-muted/10 p-3">
      <TbBundlePreviewImage image={bundle.image} variant="hero" />
    </div>
  );
}

/** Same document assembly as `WidgetEditor.handleApplyChanges` (HTML + CSS + card chrome). */
function buildWidgetPreviewHtmlDocument(payload: DashboardWidgetHtmlPreviewPayload): string {
  const { htmlCode, cssCode, widgetConfig, titleColor, fontSettings } = payload;
  return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              margin: 0;
              padding: 0;
              overflow: hidden;
              width: 100%;
              height: 100%;
            }
            ${cssCode}
            .preview-container {
              background-color: ${widgetConfig.backgroundColor || "transparent"};
              color: ${widgetConfig.textColor || "inherit"};
              padding: ${widgetConfig.padding || "0px"};
              margin: ${widgetConfig.margin || "0px"};
              border-radius: ${widgetConfig.borderRadius || "0px"};
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              ${widgetConfig.dropShadow ? "box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);" : ""}
              box-sizing: border-box;
            }
            .widget-title {
              color: ${titleColor};
              font-size: ${fontSettings.size ? `${fontSettings.size}${fontSettings.sizeUnit}` : "16px"};
              font-family: ${fontSettings.fontFamily || "inherit"};
              font-weight: ${fontSettings.weight || "400"};
              font-style: ${fontSettings.style || "normal"};
              line-height: ${fontSettings.lineHeight || "normal"};
              padding: 8px 12px;
              margin: 0;
              border-bottom: 1px solid rgba(0, 0, 0, 0.1);
              flex-shrink: 0;
            }
            .widget-content {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: auto;
              min-height: 0;
              position: relative;
            }
            .widget-content > * {
              max-width: 100%;
              max-height: 100%;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            ${widgetConfig.showTitle ? `<div class="widget-title" title="${widgetConfig.titleTooltip || ""}">${widgetConfig.title || "Widget Title"}</div>` : ""}
            <div class="widget-content">
              ${htmlCode}
            </div>
          </div>
        </body>
      </html>
    `;
}

function DashboardHtmlPreviewFrame({
  preview,
  className,
}: {
  preview: DashboardWidgetHtmlPreviewPayload;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const html = buildWidgetPreviewHtmlDocument(preview);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [preview]);

  if (!src) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[120px] items-center justify-center bg-muted/30 text-xs text-muted-foreground",
          className,
        )}
      >
        Loading preview…
      </div>
    );
  }

  return (
    <iframe
      src={src}
      title="Widget HTML preview"
      sandbox="allow-scripts"
      className={cn("h-full min-h-0 w-full flex-1 rounded border border-border/60 bg-white", className)}
    />
  );
}

type WidgetEditTab = "appearance" | "widget-card" | "actions" | "layout";

/** Local edit UI for adding a TB widget type from the picker; mirrors defaults used in WidgetEditor. */
function DashboardAddWidgetEditPanel({
  widgetName,
  widgetFqn,
  initialData,
  widgetImageRef,
  onClose,
  onApply,
}: {
  widgetName: string;
  widgetFqn: string;
  initialData?: DashboardWidgetHtmlPreviewPayload;
  widgetImageRef?: string;
  onClose: () => void;
  onApply: (payload: DashboardWidgetHtmlPreviewPayload) => void;
}) {
  const [activeTab, setActiveTab] = useState<WidgetEditTab>("appearance");
  const [editMode, setEditMode] = useState<"basic" | "advanced">("basic");
  const [hasBasicMode] = useState(false);
  const [isAdvancedTitleStyleOpen, setIsAdvancedTitleStyleOpen] = useState(false);
  const [titleStyleJson, setTitleStyleJson] = useState('{\n  "fontSize": "16px",\n  "fontWeight": 400\n}');
  const [isFontSettingsOpen, setIsFontSettingsOpen] = useState(false);
  const [fontSettings, setFontSettings] = useState(
    initialData?.fontSettings ?? {
      size: "",
      sizeUnit: "px",
      fontFamily: "",
      weight: "",
      style: "",
      lineHeight: "",
    }
  );
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [titleColor, setTitleColor] = useState(initialData?.titleColor ?? "#000000");
  const [htmlCode, setHtmlCode] = useState(initialData?.htmlCode ?? "");
  const [cssCode, setCssCode] = useState(initialData?.cssCode ?? "");
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(() =>
    initialData?.widgetConfig
      ? { ...defaultDashboardWidgetConfig, ...initialData.widgetConfig }
      : defaultDashboardWidgetConfig,
  );

  const currentPreview: DashboardWidgetHtmlPreviewPayload = {
    htmlCode,
    cssCode,
    widgetConfig,
    titleColor,
    fontSettings,
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
      {/* Preview Section */}
      <div className="flex min-h-[180px] min-w-0 flex-col border-b border-gray-300 bg-[#eef2f7] lg:h-full lg:w-[45%] lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex h-12 shrink-0 items-center border-b border-gray-300 bg-white px-4">
          <h3 className="text-sm font-medium text-gray-700">Widget Preview</h3>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-6">
          {htmlCode.trim() ? (
            <div className="h-full min-h-[160px] w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
              <DashboardHtmlPreviewFrame
                preview={currentPreview}
                className="h-full w-full rounded-none border-0"
              />
            </div>
          ) : widgetImageRef && isRenderableTbWidgetImageRef(widgetImageRef) ? (
            <div className="h-full w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
              <TbBundlePreviewImage image={widgetImageRef} variant="hero" />
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white">
              <div className="text-center">
                <Layers3 className="mx-auto h-16 w-16 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">No preview available</p>
                <p className="mt-1 text-xs text-gray-400">Add HTML/CSS to see preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Panel Section */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:w-[55%]">
        <WidgetEditPanel
          widgetName={widgetName}
          widgetFqn={widgetFqn}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          editMode={editMode}
          setEditMode={setEditMode}
          hasBasicMode={hasBasicMode}
          htmlCode={htmlCode}
          setHtmlCode={setHtmlCode}
          cssCode={cssCode}
          setCssCode={setCssCode}
          widgetConfig={widgetConfig}
          setWidgetConfig={setWidgetConfig}
          fontSettings={fontSettings}
          setFontSettings={setFontSettings}
          isFontSettingsOpen={isFontSettingsOpen}
          setIsFontSettingsOpen={setIsFontSettingsOpen}
          titleColor={titleColor}
          setTitleColor={setTitleColor}
          isColorPickerOpen={isColorPickerOpen}
          setIsColorPickerOpen={setIsColorPickerOpen}
          isAdvancedTitleStyleOpen={isAdvancedTitleStyleOpen}
          setIsAdvancedTitleStyleOpen={setIsAdvancedTitleStyleOpen}
          titleStyleJson={titleStyleJson}
          setTitleStyleJson={setTitleStyleJson}
          onClose={onClose}
          onApply={() =>
            onApply({
              htmlCode,
              cssCode,
              widgetConfig,
              titleColor,
              fontSettings,
            })
          }
          variant="minimized"
        />
      </div>
    </div>
  );
}

function WidgetSurface({ bundleId }: { bundleId: WidgetBundleId }) {
  if (bundleId === "tables") {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-2 text-[11px] font-medium text-muted-foreground">
          <span>Entity</span>
          <span>Status</span>
          <span>Reading</span>
          <span>Time</span>
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-4 gap-2 rounded-md bg-muted/40 p-2 text-xs">
            <span>Device {index + 1}</span>
            <span className="text-emerald-600">Online</span>
            <span>{25 + index}.0</span>
            <span>10:{12 + index}</span>
          </div>
        ))}
      </div>
    );
  }

  if (bundleId === "cards") {
    return (
      <div className="grid h-full grid-cols-2 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Temperature</div>
          <div className="mt-2 text-3xl font-semibold">22 C</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Active alarms</div>
          <div className="mt-2 text-3xl font-semibold">21</div>
        </div>
      </div>
    );
  }

  if (bundleId === "status-indicators") {
    return (
      <div className="flex h-full items-center justify-around">
        {["Gateway", "Battery", "Signal"].map((label, index) => (
          <div key={label} className="text-center">
            <div className={cn("mx-auto mb-3 h-12 w-12 rounded-full", index === 1 ? "bg-amber-100" : "bg-emerald-100")} />
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Realtime - last 1 minute</span>
        <span>Avg</span>
      </div>
      <div className="grid h-full grid-cols-12 items-end gap-1">
        {[34, 28, 42, 30, 48, 50, 44, 60, 38, 56, 62, 58].map((height, index) => (
          <div key={index} className="rounded-t-sm bg-sky-200/70" style={{ height: `${height}%` }} />
        ))}
      </div>
    </div>
  );
}


export default function ThingsboardDashboardEditorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dashboardId = "" } = useParams<{ dashboardId: string }>();
  const locationState = (location.state ?? {}) as DashboardEditorLocationState;

  const [dashboardTitle, setDashboardTitle] = useState(
    locationState.dashboardTitle || getDashboardTitleFromPayload(locationState.dashboard ?? null),
  );
  const [dashboardPayload, setDashboardPayload] = useState<Record<string, unknown> | null>(locationState.dashboard ?? null);
  const [widgets, setWidgets] = useState<EditorWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [widgetSheetOpen, setWidgetSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<"bundles" | "widgets">("bundles");
  const [searchTerm, setSearchTerm] = useState("");
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hasBootstrappedFromPayloadRef = useRef(locationState.dashboard != null);
  const widgetBundlesFetchGen = useRef(0);
  const widgetTypesScrollRef = useRef<HTMLDivElement | null>(null);
  const widgetTypesFetchSessionRef = useRef(0);
  const widgetTypesPageCacheRef = useRef<Map<string, CachedWidgetTypesPage>>(new Map());
  const [widgetBundlesFromApi, setWidgetBundlesFromApi] = useState<WidgetsBundleSummary[]>([]);
  const [widgetBundlesLoading, setWidgetBundlesLoading] = useState(false);
  const [widgetTypesFromApi, setWidgetTypesFromApi] = useState<WidgetTypeSummary[]>([]);
  const [widgetTypesLoading, setWidgetTypesLoading] = useState(false);
  const [widgetTypesPrefetching, setWidgetTypesPrefetching] = useState(false);
  const [widgetTypesPageIndex, setWidgetTypesPageIndex] = useState(0);
  const [widgetTypesHasNextPage, setWidgetTypesHasNextPage] = useState(false);
  const [widgetTypesTotalElements, setWidgetTypesTotalElements] = useState<number | null>(null);
  const [deprecatedFilter, setDeprecatedFilter] = useState<WidgetDeprecatedFilter>("ALL");
  const [selectedBundleFilter, setSelectedBundleFilter] = useState<SelectedBundleFilter | null>(null);
  /** Widget type chosen from the picker; sheet closes and this popover is shown at page level. */
  const [pendingAddWidgetType, setPendingAddWidgetType] = useState<WidgetTypeSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** Widget being edited */
  const [editingWidget, setEditingWidget] = useState<EditorWidget | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);

  const hydrateDashboard = useCallback(async (payload: Record<string, unknown>) => {
    console.log("[hydrateDashboard] Starting dashboard hydration with payload:", payload);
    setDashboardPayload(payload);
    setDashboardTitle(getDashboardTitleFromPayload(payload));

    if (!hasBootstrappedFromPayloadRef.current) {
      console.log("[hydrateDashboard] Processing widgets (first time or dashboard changed)");
      const normalized = await normalizeExistingWidgets(payload);
      console.log("[hydrateDashboard] Normalized widgets:", normalized);
      setWidgets(normalized);
      hasBootstrappedFromPayloadRef.current = true;
    } else {
      console.log("[hydrateDashboard] Skipping widget processing (already bootstrapped)");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Reset the bootstrap ref when dashboardId changes to allow reprocessing widgets
    hasBootstrappedFromPayloadRef.current = false;
    console.log("[initializeDashboard] Reset bootstrap ref for dashboardId:", dashboardId);

    async function initializeDashboard() {
      if (locationState.dashboard) {
        setLoading(true);
        await hydrateDashboard(locationState.dashboard);
        if (!cancelled) setLoading(false);
        return;
      }

      if (!dashboardId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const payload = await getDashboard(dashboardId);
        console.log("[initializeDashboard] Fetched dashboard payload:", payload);
        if (cancelled) return;
        await hydrateDashboard(payload);
      } catch (error) {
        if (cancelled) return;
        toast.error(getDisplayErrorMessage(error, "Failed to load dashboard."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initializeDashboard();

    return () => {
      cancelled = true;
    };
  }, [dashboardId, hydrateDashboard, locationState.dashboard]);

  const canvasHeight = useMemo(() => {
    const usedHeight = widgets.reduce((max, widget) => Math.max(max, widget.y + widget.height + GRID_SIDE_PADDING), GRID_TOP_OFFSET + 240);
    return Math.max(DEFAULT_CANVAS_HEIGHT, usedHeight);
  }, [widgets]);

  const showGrid = interaction != null;

  useEffect(() => {
    if (!interaction) return;

    function handlePointerMove(event: MouseEvent) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = Math.max(canvas.clientWidth - GRID_SIDE_PADDING * 2, MIN_WIDGET_WIDTH);
      const dx = event.clientX - interaction.startClientX;
      const dy = event.clientY - interaction.startClientY;

      setWidgets((previous) =>
        previous.map((widget) => {
          if (widget.id !== interaction.widgetId) return widget;

          if (interaction.mode === "move") {
            const nextX = clamp(
              snap(interaction.startX + dx, GRID_CELL_WIDTH),
              0,
              Math.max(0, maxWidth - widget.width),
            );
            const nextY = Math.max(GRID_TOP_OFFSET, snap(interaction.startY + dy, GRID_CELL_HEIGHT));
            return { ...widget, x: nextX, y: nextY };
          }

          const nextWidth = clamp(
            snap(interaction.startWidth + dx, GRID_CELL_WIDTH),
            MIN_WIDGET_WIDTH,
            Math.max(MIN_WIDGET_WIDTH, maxWidth - widget.x),
          );
          const nextHeight = Math.max(MIN_WIDGET_HEIGHT, snap(interaction.startHeight + dy, GRID_CELL_HEIGHT));
          return { ...widget, width: nextWidth, height: nextHeight };
        }),
      );
    }

    function handlePointerUp() {
      setInteraction(null);
    }

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
    };
  }, [interaction]);

  const filteredApiBundles = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return widgetBundlesFromApi;
    return widgetBundlesFromApi.filter(
      (bundle) =>
        bundle.title.toLowerCase().includes(query) ||
        bundle.description.toLowerCase().includes(query) ||
        bundle.alias.toLowerCase().includes(query) ||
        bundle.name.toLowerCase().includes(query),
    );
  }, [searchTerm, widgetBundlesFromApi]);

  const visibleWidgetTypes = useMemo(() => {
    if (sheetView !== "widgets") return [];
    const query = searchTerm.trim().toLowerCase();
    let list = widgetTypesFromApi;

    if (selectedBundleFilter?.bundleId) {
      const byBundleEntity = list.filter((wt) =>
        (wt.bundles ?? []).some((b) => entityIdFromTb(b.id) === selectedBundleFilter.bundleId),
      );
      if (byBundleEntity.length > 0) {
        list = byBundleEntity;
      } else {
        list = list.filter((wt) => widgetTypeMatchesSelectedBundle(wt, selectedBundleFilter));
      }
    } else if (selectedBundleFilter) {
      list = list.filter((wt) => widgetTypeMatchesSelectedBundle(wt, selectedBundleFilter));
    }

    if (!query) return list;
    return list.filter(
      (wt) =>
        wt.name.toLowerCase().includes(query) ||
        wt.description.toLowerCase().includes(query) ||
        wt.fqn.toLowerCase().includes(query) ||
        (wt.bundles ?? []).some((b) => (b.name ?? "").toLowerCase().includes(query)),
    );
  }, [searchTerm, selectedBundleFilter, sheetView, widgetTypesFromApi]);

  const widgetTypesTotalPages = useMemo(() => {
    if (widgetTypesTotalElements == null || widgetTypesTotalElements <= 0) return null;
    return Math.max(1, Math.ceil(widgetTypesTotalElements / WIDGET_TYPES_PAGE_SIZE));
  }, [widgetTypesTotalElements]);

  const widgetTypesEmptyHint = useMemo(() => {
    if (deprecatedFilter === "ACTUAL") return "No non-deprecated widgets for this bundle or filter.";
    if (deprecatedFilter === "DEPRECATED") return "No deprecated widgets for this bundle or filter.";
    return "No widgets for this bundle or filter.";
  }, [deprecatedFilter]);

  useEffect(() => {
    if (!widgetSheetOpen || sheetView !== "widgets") return;

    const session = ++widgetTypesFetchSessionRef.current;
    const controller = new AbortController();
    const filter = deprecatedFilter;
    const bundleId = selectedBundleFilter?.bundleId;
    const pageIndex = widgetTypesPageIndex;
    const cacheKey = widgetTypesPageCacheKey(filter, bundleId, pageIndex);
    const cached = widgetTypesPageCacheRef.current.get(cacheKey);

    if (cached) {
      setWidgetTypesFromApi(cached.rows);
      setWidgetTypesHasNextPage(cached.hasNext);
      setWidgetTypesTotalElements(cached.totalElements);
      setWidgetTypesLoading(false);
      setWidgetTypesPrefetching(false);
      return () => controller.abort();
    }

    setWidgetTypesLoading(true);
    setWidgetTypesPrefetching(false);
    setWidgetTypesFromApi([]);

    let cancelled = false;

    void (async () => {
      try {
        const bundleIdTrimmed = bundleId?.trim() ?? "";
        const page = bundleIdTrimmed
          ? await listWidgetTypesInfos({
              page: pageIndex,
              page_size: WIDGET_TYPES_PAGE_SIZE,
              widgets_bundle_id: bundleIdTrimmed,
              full_search: false,
              deprecated_filter: filter,
            })
          : await listWidgetTypes({
              page: pageIndex,
              page_size: WIDGET_TYPES_PAGE_SIZE,
              sort_property: "name",
              sort_order: "ASC",
              tenant_only: false,
              full_search: false,
              scada_first: false,
              deprecated_filter: filter,
              widgets_bundle_id: bundleId,
            });
        if (cancelled || widgetTypesFetchSessionRef.current !== session) return;

        const totalEl = typeof page.totalElements === "number" ? page.totalElements : null;
        const hasNext = computeWidgetTypesPageHasNext({
          page,
          pageIndex,
          pageSize: WIDGET_TYPES_PAGE_SIZE,
          totalElements: totalEl,
        });

        widgetTypesPageCacheRef.current.set(cacheKey, {
          rows: page.data,
          hasNext,
          totalElements: totalEl,
        });

        setWidgetTypesFromApi(page.data);
        setWidgetTypesHasNextPage(hasNext);
        setWidgetTypesTotalElements(totalEl);

        setWidgetTypesPrefetching(true);
        await batchPrefetchWidgetTypeImages(page.data, controller.signal);
      } catch (error) {
        if (cancelled || widgetTypesFetchSessionRef.current !== session) return;
        setWidgetTypesFromApi([]);
        setWidgetTypesHasNextPage(false);
        setWidgetTypesTotalElements(null);
        toast.error(getDisplayErrorMessage(error, "Failed to load widget types."));
      } finally {
        if (!cancelled && widgetTypesFetchSessionRef.current === session) {
          setWidgetTypesLoading(false);
          setWidgetTypesPrefetching(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [widgetSheetOpen, sheetView, deprecatedFilter, selectedBundleFilter?.bundleId, widgetTypesPageIndex]);

  useEffect(() => {
    if (sheetView !== "widgets") return;
    widgetTypesScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [widgetTypesPageIndex, sheetView]);

  const openWidgetPicker = useCallback(() => {
    setPendingAddWidgetType(null);
    setWidgetSheetOpen(true);
    setSheetView("bundles");
    setSelectedBundleFilter(null);
    setDeprecatedFilter("ALL");
    setSearchTerm("");
    setWidgetTypesPageIndex(0);
    setWidgetTypesFromApi([]);
    setWidgetTypesHasNextPage(false);
    setWidgetTypesTotalElements(null);
    widgetTypesPageCacheRef.current.clear();
    
    // Enable edit mode when opening widget picker
    setIsEditMode(true);

    const gen = ++widgetBundlesFetchGen.current;
    setWidgetBundlesLoading(true);

    void (async () => {
      try {
        const page = await listWidgetBundles({
          page: 0,
          page_size: 50,
          sort_property: "title",
          sort_order: "ASC",
          tenant_only: false,
          full_search: false,
          scada_first: false,
        });
        if (widgetBundlesFetchGen.current !== gen) return;
        setWidgetBundlesFromApi(page.data);
      } catch (error) {
        if (widgetBundlesFetchGen.current !== gen) return;
        setWidgetBundlesFromApi([]);
        toast.error(getDisplayErrorMessage(error, "Failed to load widget bundles."));
      } finally {
        if (widgetBundlesFetchGen.current === gen) {
          setWidgetBundlesLoading(false);
        }
      }
    })();
  }, []);

  const handleAddWidgetType = useCallback(
    async (widgetType: WidgetTypeSummary, options?: { closeSheet?: boolean; htmlPreview?: DashboardWidgetHtmlPreviewPayload }) => {
      const closeSheet = options?.closeSheet !== false;
      const htmlPreview = options?.htmlPreview;
      const fromFqn = bundleAliasFromFqn(widgetType.fqn);
      const fromBundleName = widgetType.bundles?.find((b) => b.name?.trim())?.name?.trim();
      const hint =
        fromFqn ??
        (fromBundleName
          ? fromBundleName.toLowerCase().replace(/\s+/g, "_")
          : "");
      const bundle = resolveWidgetBundleForAlias(hint);

      let previewImageUrl: string | undefined;
      let widgetImageRef: string | undefined;
      const imageFilename = extractImageFilename(widgetType.image);
      if (imageFilename && isRenderableTbWidgetImageRef(widgetType.image ?? "")) {
        widgetImageRef = widgetType.image ?? undefined;
        try {
          const blob = await getIotWidgetsImageFromBundleRef(widgetType.image ?? "");
          if (blob) {
            previewImageUrl = URL.createObjectURL(blob);
          }
        } catch (error) {
          console.warn("Failed to fetch widget preview image:", error);
        }
      }

      setWidgets((previous) => {
        const index = previous.length;
        const x = (index % 2) * (DEFAULT_WIDGET_WIDTH + GRID_SIDE_PADDING);
        const y = GRID_TOP_OFFSET + Math.floor(index / 2) * (DEFAULT_WIDGET_HEIGHT + GRID_SIDE_PADDING);

        // Always generate a unique UUID for each widget instance
        // Store the widget type ID separately for reference
        const widgetInstanceId = generateUUID();
        
        // Extract widget type ID from the API response
        // Try multiple paths: typeId, id.id (nested structure from API), or id
        const widgetTypeAny = widgetType as any;
        const extractedTypeId = widgetType.typeId || 
                                (widgetTypeAny.id && typeof widgetTypeAny.id === 'object' ? widgetTypeAny.id.id : null) ||
                                (typeof widgetTypeAny.id === 'string' ? widgetTypeAny.id : null);
        
        console.log('[handleAddWidgetType] Widget type:', widgetType.name, 'Extracted ID:', extractedTypeId);

        return [
          ...previous,
          {
            id: widgetInstanceId,
            widgetTypeId: extractedTypeId,
            bundleId: bundle.id,
            title: widgetType.name,
            description: widgetType.description || widgetType.fqn,
            x,
            y,
            width: DEFAULT_WIDGET_WIDTH,
            height: DEFAULT_WIDGET_HEIGHT,
            ...(htmlPreview ? { htmlPreview } : {}),
            ...(previewImageUrl ? { previewImageUrl } : {}),
            ...(widgetImageRef ? { widgetImageRef } : {}),
          },
        ];
      });
      if (closeSheet) {
        setWidgetSheetOpen(false);
        setSheetView("bundles");
        setSelectedBundleFilter(null);
        setWidgetTypesPageIndex(0);
      }
    },
    [],
  );

  const handleRemoveWidget = useCallback((widgetId: string) => {
    setWidgets((previous) => {
      const widgetToRemove = previous.find((w) => w.id === widgetId);
      if (widgetToRemove?.previewImageUrl) {
        URL.revokeObjectURL(widgetToRemove.previewImageUrl);
      }
      return previous.filter((widget) => widget.id !== widgetId);
    });
  }, []);

  const triggerPlaceholderAction = useCallback((label: string) => {
    if (label === "Expand to fullscreen") {
      setIsFullscreen(true);
    } else if (label === "Exit fullscreen") {
      setIsFullscreen(false);
    } else {
      toast.info(`${label} is not wired yet.`);
    }
  }, []);

  const handleSaveDashboard = useCallback(async () => {
    const id = dashboardId.trim();
    if (!id) {
      toast.error("Missing dashboard id.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildDashboardSavePayload({
        dashboardId: id,
        dashboardTitle,
        dashboardPayload,
        widgets,
      });
      console.log("Saving dashboard with payload:", JSON.stringify(payload, null, 2));
      await saveDashboard({ payload });
      setDashboardPayload(payload);
      toast.success("Dashboard saved.");
    } catch (error) {
      toast.error(getDisplayErrorMessage(error, "Failed to save dashboard."));
    } finally {
      setSaving(false);
    }
  }, [dashboardId, dashboardTitle, dashboardPayload, widgets]);

  return (
    <div className={`flex min-h-0 flex-col bg-background ${isFullscreen ? 'fixed inset-0 z-50' : 'h-[calc(100vh-4rem)]'}`}>
      <DashboardHeader
        dashboardTitle={dashboardTitle}
        widgetsCount={widgets.length}
        isEditMode={isEditMode}
        saving={saving}
        dashboardId={dashboardId}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onOpenWidgetPicker={openWidgetPicker}
        onSaveDashboard={() => void handleSaveDashboard()}
        onTriggerAction={triggerPlaceholderAction}
        onCancel={() => setIsEditMode(false)}
        onOpenFilters={() => setFiltersDialogOpen(true)}
      />

      <div className={`flex-1 overflow-auto relative ${isFullscreen ? 'bg-background' : 'bg-[#eef2f7]'}`}>
        {isFullscreen && (
          <div className="absolute top-4 right-4 z-50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 bg-background shadow-lg"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-4 w-4" />
              Exit Fullscreen
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
              Loading dashboard...
            </div>
          </div>
        ) : (
          <div className={`${isFullscreen ? 'h-full p-0' : 'min-h-full p-4'}`}>
            <div
              ref={canvasRef}
              className={`relative mx-auto overflow-hidden bg-background ${isFullscreen ? 'h-full' : 'rounded-md border border-border/70 shadow-sm'}`}
              style={isFullscreen ? { height: '100%', width: "100%", maxWidth: "100%" } : { minHeight: `${canvasHeight}px`, width: "100%", maxWidth: "100%" }}
            >
              {showGrid ? (
                <div
                  className="pointer-events-none absolute inset-0 z-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, rgba(148,163,184,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.2) 1px, transparent 1px)",
                    backgroundSize: `${GRID_CELL_WIDTH}px ${GRID_CELL_HEIGHT}px`,
                    backgroundPosition: `0 ${GRID_TOP_OFFSET}px`,
                  }}
                />
              ) : null}

              {widgets.length === 0 ? (
                <div className="flex min-h-[32rem] items-center justify-center px-6 py-16">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-14 gap-3 rounded-md border-dashed border-2 px-6 text-base shadow-sm"
                    onClick={openWidgetPicker}
                  >
                    <Plus className="h-8 w-8" />
                    Add new widget
                  </Button>
                </div>
              ) : null}

              {widgets.map((widget) => {
                const isActiveWidget = interaction?.widgetId === widget.id;
                return (
                <div
                  key={widget.id}
                  className={`absolute transition-all ${isActiveWidget ? 'z-30' : 'z-10'}`}
                  style={{
                    left: `${widget.x}px`,
                    top: `${widget.y}px`,
                    width: `${widget.width}px`,
                    height: `${widget.height}px`,
                  }}
                >
                  <Card className={`group relative flex h-full flex-col overflow-hidden rounded-sm bg-background shadow-lg ${
                    isActiveWidget 
                      ? 'border-2 border-blue-500 ring-2 ring-blue-200' 
                      : 'border border-sky-200'
                  }`}>
                    {isEditMode && (
                      <>
                        <div className="absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border/60 bg-white px-2 py-1.5 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          <div
                            className="flex h-8 w-8 cursor-move items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground rounded"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setInteraction({
                                widgetId: widget.id,
                                mode: "move",
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startX: widget.x,
                                startY: widget.y,
                                startWidth: widget.width,
                                startHeight: widget.height,
                              });
                            }}
                            title="Drag to move"
                          >
                            <Move className="h-4 w-4" />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingWidget(widget);
                            }}
                            title="Edit widget"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerPlaceholderAction("Export widget");
                            }}
                            title="Export widget"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-foreground hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveWidget(widget.id);
                            }}
                            title="Remove widget"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                    {widget.htmlPreview && widget.htmlPreview.htmlCode?.trim() ? (
                      <>
                        <div
                          className={`absolute inset-0 z-0 min-h-0 bg-white ${isEditMode ? '' : 'pointer-events-none'}`}
                          onMouseDown={isEditMode ? (event) => {
                            event.preventDefault();
                            setInteraction({
                              widgetId: widget.id,
                              mode: "move",
                              startClientX: event.clientX,
                              startClientY: event.clientY,
                              startX: widget.x,
                              startY: widget.y,
                              startWidth: widget.width,
                              startHeight: widget.height,
                            });
                          } : undefined}
                        >
                          <DashboardHtmlPreviewFrame
                            preview={widget.htmlPreview}
                            className="h-full w-full flex-none rounded-none border-0"
                          />
                        </div>
                        {isEditMode && (
                          <button
                            type="button"
                            className="absolute bottom-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-sm bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setInteraction({
                                widgetId: widget.id,
                                mode: "resize",
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startX: widget.x,
                                startY: widget.y,
                                startWidth: widget.width,
                                startHeight: widget.height,
                              });
                            }}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {widget.previewImageUrl ? (
                          <div
                            className={`absolute inset-0 z-0 ${isEditMode ? '' : 'pointer-events-none'}`}
                            onMouseDown={isEditMode ? (event) => {
                              event.preventDefault();
                              setInteraction({
                                widgetId: widget.id,
                                mode: "move",
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startX: widget.x,
                                startY: widget.y,
                                startWidth: widget.width,
                                startHeight: widget.height,
                              });
                            } : undefined}
                          >
                            <img
                              src={widget.previewImageUrl}
                              alt={widget.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <>
                            <div
                              className="flex cursor-move items-center justify-between border-b bg-slate-50 px-2 py-1"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                setInteraction({
                                  widgetId: widget.id,
                                  mode: "move",
                                  startClientX: event.clientX,
                                  startClientY: event.clientY,
                                  startX: widget.x,
                                  startY: widget.y,
                                  startWidth: widget.width,
                                  startHeight: widget.height,
                                });
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <Move className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="truncate text-sm font-medium text-foreground">{widget.title}</span>
                              </div>
                              {!isEditMode && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground"
                                    onClick={() => triggerPlaceholderAction("Widget settings")}
                                  >
                                    <SlidersHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground"
                                    onClick={() => handleRemoveWidget(widget.id)}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="flex min-h-0 flex-1 flex-col p-3">
                              <div className="mb-2 flex shrink-0 items-center justify-between text-[11px] text-muted-foreground">
                                <span>{widget.description}</span>
                                <span>{widget.width} x {widget.height}</span>
                              </div>
                              <div className="min-h-0 flex-1">
                                <WidgetSurface bundleId={widget.bundleId} />
                              </div>
                            </div>
                          </>
                        )}
                        {isEditMode && (
                          <button
                            type="button"
                            className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-sm bg-background/90 text-muted-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-muted"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setInteraction({
                                widgetId: widget.id,
                                mode: "resize",
                                startClientX: event.clientX,
                                startClientY: event.clientY,
                                startX: widget.x,
                                startY: widget.y,
                                startWidth: widget.width,
                                startHeight: widget.height,
                              });
                            }}
                          >
                            <Maximize2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </Card>
                </div>
              );
              })}
            </div>
          </div>
        )}
      </div>

      <Sheet
        open={widgetSheetOpen}
        onOpenChange={(open) => {
          setWidgetSheetOpen(open);
          if (!open) {
            setSheetView("bundles");
            setSelectedBundleFilter(null);
            setSearchTerm("");
            setWidgetTypesPageIndex(0);
            setWidgetTypesPrefetching(false);
          }
        }}
      >
        <SheetContent side="right" className="flex h-full min-h-0 w-[min(72rem,94vw)] flex-col gap-0 p-0" hideClose>
          <SheetHeader className="shrink-0 border-b border-border/70 px-5 py-4">
            <div className="flex items-center gap-3">
              {sheetView === "widgets" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSheetView("bundles");
                    setSelectedBundleFilter(null);
                    setWidgetTypesPageIndex(0);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="min-w-0 flex-1">
                <SheetTitle>
                  {sheetView === "bundles"
                    ? "Select widgets bundle"
                    : selectedBundleFilter?.title ?? "All widgets"}
                </SheetTitle>
                <SheetDescription>
                Choose a sample widget to place on the dashboard canvas
                </SheetDescription>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWidgetSheetOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          <div className="shrink-0 border-b border-border/60 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[16rem] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder={sheetView === "bundles" ? "Search widget bundles" : "Search widgets"}
                  className="pl-9"
                />
              </div>
              <div className="flex rounded-md border border-border/60 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={sheetView === "bundles" ? "secondary" : "ghost"}
                  className="!h-7"
                  onClick={() => {
                    setSheetView("bundles");
                    setSelectedBundleFilter(null);
                    setWidgetTypesPageIndex(0);
                  }}
                >
                  Widget bundles
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sheetView === "widgets" && selectedBundleFilter == null ? "secondary" : "ghost"}
                  className="!h-7"
                  onClick={() => {
                    setSheetView("widgets");
                    setSelectedBundleFilter(null);
                    setWidgetTypesPageIndex(0);
                  }}
                >
                  All widgets
                </Button>
              </div>
            </div>
            {sheetView === "widgets" ? (
              <div className="mt-3 space-y-3">
                <Tabs
                  value={deprecatedFilter}
                  onValueChange={(value) => {
                    if (value === "ALL" || value === "ACTUAL" || value === "DEPRECATED") {
                      setDeprecatedFilter(value);
                      setWidgetTypesPageIndex(0);
                    }
                  }}
                >
                  <TabsList className="grid h-10 w-full max-w-xl grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1 shadow-inner">
                    <TabsTrigger value="ALL" className="rounded-lg text-xs font-medium transition-all data-[state=active]:shadow-sm">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="ACTUAL" className="rounded-lg text-xs font-medium transition-all data-[state=active]:shadow-sm">
                      Actual
                    </TabsTrigger>
                    <TabsTrigger value="DEPRECATED" className="rounded-lg text-xs font-medium transition-all data-[state=active]:shadow-sm">
                      Deprecated
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <WidgetTypesPaginationBar
                  pageIndex={widgetTypesPageIndex}
                  totalPages={widgetTypesTotalPages}
                  totalElements={widgetTypesTotalElements}
                  hasNextPage={widgetTypesHasNextPage}
                  loading={widgetTypesLoading}
                  prefetching={widgetTypesPrefetching}
                  onPrevious={() => setWidgetTypesPageIndex((p) => Math.max(0, p - 1))}
                  onNext={() => setWidgetTypesPageIndex((p) => p + 1)}
                />
              </div>
            ) : null}
          </div>

          <div ref={widgetTypesScrollRef} className="min-h-0 flex-1 overflow-auto px-5 py-5">
            {sheetView === "bundles" ? (
              widgetBundlesLoading ? (
                <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
                  Loading widget bundles…
                </div>
              ) : filteredApiBundles.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  {widgetBundlesFromApi.length === 0
                    ? "No widget bundles are available."
                    : "No widget bundles match your search."}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filteredApiBundles.map((apiBundle, index) => {
                    const rowKey = entityIdFromTb(apiBundle.id) || `${apiBundle.alias}-${index}`;

                    return (
                      <button
                        key={rowKey}
                        type="button"
                        className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                        onClick={() => {
                          setSelectedBundleFilter({
                            alias: apiBundle.alias,
                            title: apiBundle.title,
                            bundleId: entityIdFromTb(apiBundle.id) || undefined,
                          });
                          setWidgetTypesPageIndex(0);
                          setSheetView("widgets");
                        }}
                      >
                        <ApiWidgetBundleCardPreview bundle={apiBundle} />
                        <div className="border-t border-border/60 px-3 py-2.5">
                          <span className="line-clamp-2 text-sm font-semibold text-foreground">{apiBundle.title}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : widgetTypesLoading ? (
              <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
                Loading widget types…
              </div>
            ) : visibleWidgetTypes.length === 0 ? (
              <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                {widgetTypesFromApi.length === 0
                  ? widgetTypesEmptyHint
                  : "No widgets on this page match your search."}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {visibleWidgetTypes.map((widgetType) => {
                    const rowKey = widgetTypeRowKey(widgetType);
                    return (
                      <div
                        key={rowKey}
                        className="group flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                      >
                        <div className="relative p-3">
                          {widgetType.deprecated ? (
                            <Badge
                              variant="secondary"
                              className="absolute right-4 top-4 z-10 text-[10px] font-medium shadow-sm"
                            >
                              Deprecated
                            </Badge>
                          ) : null}
                          <TbBundlePreviewImage image={widgetType.image} variant="hero" />
                        </div>
                        <div className="mt-auto flex items-center gap-2 border-t border-border/60 bg-card px-3 py-2.5">
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                            {widgetType.name}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 shrink-0 px-3"
                            onClick={() => {
                              setPendingAddWidgetType(widgetType);
                              setWidgetSheetOpen(false);
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {pendingAddWidgetType != null ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Dismiss widget editor"
            onClick={() => setPendingAddWidgetType(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit widget: ${pendingAddWidgetType.name}`}
            className="relative z-[1] flex h-[min(85dvh,50rem)] w-[min(100%,80rem)] max-w-[80rem] flex-col overflow-hidden rounded-lg bg-background shadow-2xl ring-1 ring-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <DashboardAddWidgetEditPanel
                key={widgetTypeRowKey(pendingAddWidgetType)}
                widgetName={pendingAddWidgetType.name}
                widgetFqn={pendingAddWidgetType.fqn}
                widgetImageRef={pendingAddWidgetType.image ?? undefined}
                onClose={() => setPendingAddWidgetType(null)}
                onApply={(payload) => {
                  handleAddWidgetType(pendingAddWidgetType, { htmlPreview: payload });
                  setPendingAddWidgetType(null);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {editingWidget != null ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Dismiss widget editor"
            onClick={() => setEditingWidget(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit widget: ${editingWidget.title}`}
            className="relative z-[1] flex h-[min(85dvh,50rem)] w-[min(100%,80rem)] max-w-[80rem] flex-col overflow-hidden rounded-lg bg-background shadow-2xl ring-1 ring-black/20"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <DashboardAddWidgetEditPanel
                key={editingWidget.id}
                widgetName={editingWidget.title}
                widgetFqn={editingWidget.description}
                initialData={editingWidget.htmlPreview}
                widgetImageRef={editingWidget.widgetImageRef}
                onClose={() => setEditingWidget(null)}
                onApply={(payload) => {
                  setWidgets((previous) =>
                    previous.map((w) =>
                      w.id === editingWidget.id
                        ? { ...w, htmlPreview: payload }
                        : w
                    )
                  );
                  setEditingWidget(null);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <FiltersDialog
        open={filtersDialogOpen}
        onOpenChange={setFiltersDialogOpen}
      />
    </div>
  );
}
