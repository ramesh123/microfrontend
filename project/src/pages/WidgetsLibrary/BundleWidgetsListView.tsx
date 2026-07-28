
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import axios, { isAxiosError } from "axios";
import { ArrowLeft, Download, Layers3, Pencil } from "lucide-react";
import { toast } from "sonner";
import WidgetEditor from "./WidgetEditor";
import { type WidgetTableRow } from "./tableModels";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { API_BASE_URL } from "@/controllers/API/api";
import { getWidgetType } from "@/controllers/API/widgetsApi";

import {
  type BundleWidgetListItem,
  bundleTitleFromDetail,
  type WidgetBundleTableRow,
  widgetTypeIdFromRecord,
  widgetsFromBundleDetail,
  widgetsFromWidgetTypeRecords,
} from "./tableModels";
import {
  downloadJsonFile,
  exportWidgetBundle,
  resolveWidgetsBundleId,
  widgetBundleExportErrorMessage,
} from "./widgetBundleExport";

// type BundleWidgetsListViewProps = {
//   bundle: WidgetBundleTableRow;
//   onBack: () => void;
// };
type BundleWidgetsListViewProps = {
  bundle: WidgetBundleTableRow;
  onBack: () => void;
};

type WidgetBundleDetail = Record<string, unknown>;

type WidgetTypesPage = {
  data: Record<string, unknown>[];
};

const widgetsClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

widgetsClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token");
  if (token) {
    config.headers.set("authentication", token);
  }
  return config;
});

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const detail = error.response?.data;
    if (detail && typeof detail === "object" && "detail" in detail) {
      return String((detail as { detail: unknown }).detail);
    }
    return error.message;
  }
  return getDisplayErrorMessage(error, "Request failed");
}

const bundleDetailInflight = new Map<string, Promise<WidgetBundleDetail>>();
const bundleDetailCache = new Map<string, WidgetBundleDetail>();

async function requestWidgetBundle(id: string, useCache: boolean): Promise<WidgetBundleDetail> {
  if (!useCache) {
    const { data } = await widgetsClient.post<unknown>("/iot-widgets/get-widget-bundle", {
      widget_bundle_id: id,
      widgets_bundle_id: id,
    });
    const result = (data ?? {}) as WidgetBundleDetail;
    bundleDetailCache.set(id, result);
    return result;
  }

  const cached = bundleDetailCache.get(id);
  if (cached) return cached;

  const inflight = bundleDetailInflight.get(id);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      return await requestWidgetBundle(id, false);
    } finally {
      bundleDetailInflight.delete(id);
    }
  })();

  bundleDetailInflight.set(id, request);
  return request;
}

async function fetchWidgetBundle(widgetBundleId: string): Promise<WidgetBundleDetail> {
  const id = widgetBundleId.trim();
  if (!id) throw new Error("Widget bundle id is required.");
  return requestWidgetBundle(id, true);
}

const widgetTypesInflight = new Map<string, Promise<WidgetTypesPage>>();
const widgetTypesCache = new Map<string, WidgetTypesPage>();

async function fetchWidgetTypesForBundle(widgetBundleId: string): Promise<WidgetTypesPage> {
  const id = widgetBundleId.trim();
  if (!id) return { data: [] };

  const cached = widgetTypesCache.get(id);
  if (cached) return cached;

  const inflight = widgetTypesInflight.get(id);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const { data } = await widgetsClient.post<unknown>("/iot-widgets/list-widget-types-infos", {
        page: 0,
        page_size: 100,
        widgets_bundle_id: id,
        full_search: false,
        deprecated_filter: "ALL",
      });

      if (!data || typeof data !== "object") {
        const empty = { data: [] };
        widgetTypesCache.set(id, empty);
        return empty;
      }

      const page = data as Record<string, unknown>;
      const rows = Array.isArray(page.data) ? page.data : [];
      const result: WidgetTypesPage = {
        data: rows.filter((row): row is Record<string, unknown> => !!row && typeof row === "object"),
      };
      widgetTypesCache.set(id, result);
      return result;
    } finally {
      widgetTypesInflight.delete(id);
    }
  })();

  widgetTypesInflight.set(id, request);
  return request;
}

function buildImageUrlCandidates(imageRef: string): string[] {
  const trimmed = imageRef.trim();
  const semi = trimmed.indexOf(";");
  const path = (semi >= 0 ? trimmed.slice(semi + 1) : trimmed).trim().replace(/^\/+/, "");
  if (!path) return [];

  const segments = path.split("/").filter(Boolean);
  const basename = segments.length > 0 ? segments[segments.length - 1]! : null;
  const out: string[] = [];
  if (basename) out.push(basename);
  if (path && path !== basename) out.push(path);
  return out;
}

async function blobToDisplayUrl(blob: Blob, imageUrl: string): Promise<string> {
  const contentType = blob.type || "";
  if (contentType.startsWith("image/")) {
    return URL.createObjectURL(blob);
  }

  const text = await blob.text();
  if (text.trim().startsWith("<svg")) {
    return URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  }
  if (text.startsWith("data:image")) return text;

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(text.substring(0, 100))) {
    const ext = imageUrl.split(".").pop()?.toLowerCase() || "png";
    const mimeType =
      ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "svg" ? "image/svg+xml" : `image/${ext}`;
    return `data:${mimeType};base64,${text}`;
  }

  return text;
}

const widgetImageInflight = new Map<string, Promise<string>>();
const widgetImageCache = new Map<string, string>();

function primaryImageUrl(imageRef: string): string {
  const candidates = buildImageUrlCandidates(imageRef);
  return candidates[0] ?? imageRef.trim();
}

async function fetchWidgetImage(imageRef: string): Promise<string> {
  const key = imageRef.trim();
  if (!key) return "";

  const cached = widgetImageCache.get(key);
  if (cached !== undefined) return cached;

  const inflight = widgetImageInflight.get(key);
  if (inflight) return inflight;

  const request = (async () => {
    const image_url = primaryImageUrl(key);
    if (!image_url) {
      widgetImageCache.set(key, "");
      return "";
    }

    try {
      const { data } = await widgetsClient.post<Blob>(
        "/iot-widgets/get-image",
        { image_url },
        { responseType: "blob" },
      );
      if (data instanceof Blob) {
        const displayUrl = await blobToDisplayUrl(data, image_url);
        const result = displayUrl || "";
        widgetImageCache.set(key, result);
        return result;
      }
    } catch {
      /* fall through */
    }

    widgetImageCache.set(key, "");
    return "";
  })();

  widgetImageInflight.set(key, request);
  try {
    return await request;
  } finally {
    widgetImageInflight.delete(key);
  }
}

function WidgetTypeThumbnail({ image }: { image: string | null }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setSrc(null);
    setLoading(true);

    if (!image?.trim()) {
      setLoading(false);
      return;
    }

    void fetchWidgetImage(image).then((imageData) => {
      if (cancelled) return;
      setSrc(imageData || null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [image]);

  return (
    <div className="flex h-[4.5rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white px-2 shadow-sm">
      {loading ? (
        <div className="h-12 w-16 animate-pulse rounded bg-muted" />
      ) : src ? (
        <img src={src} alt="" className="max-h-[4rem] max-w-full object-contain" />
      ) : (
        <Layers3 className="h-7 w-7 text-muted-foreground/35" />
      )}
    </div>
  );
}

function WidgetListRow({
  widget,
  onEdit,
  onDownload,
}: {
  widget: BundleWidgetListItem;
  onEdit: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-md">
      <WidgetTypeThumbnail image={widget.image} />
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{widget.name}</span>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Edit widget"
          onClick={onEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Download widget"
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function BundleWidgetsListView({ bundle, onBack }: BundleWidgetsListViewProps) {
  const [widgets, setWidgets] = useState<BundleWidgetListItem[]>([]);
  const [bundleTitle, setBundleTitle] = useState(bundle.title);
  const [loading, setLoading] = useState(true);
  const loadGenRef = useRef(0);
  const [selectedWidget, setSelectedWidget] = useState<WidgetTableRow | null>(null);
  useEffect(() => {
    const gen = ++loadGenRef.current;
    const bundleId = resolveWidgetsBundleId(bundle);
    const fallbackTitle = bundle.title;

    setLoading(true);

    void (async () => {
      try {
        const [detail, typesPage] = await Promise.all([
          fetchWidgetBundle(bundleId),
          fetchWidgetTypesForBundle(bundleId),
        ]);

        if (loadGenRef.current !== gen) return;

        setBundleTitle(bundleTitleFromDetail(detail, fallbackTitle));

        const fromTypes = widgetsFromWidgetTypeRecords(typesPage.data);
        const fromDetail = widgetsFromBundleDetail(detail);
        setWidgets(fromTypes.length > 0 ? fromTypes : fromDetail);
      } catch (error) {
        if (loadGenRef.current !== gen) return;
        console.error(error);
        toast.error(apiErrorMessage(error));
        setWidgets([]);
      } finally {
        if (loadGenRef.current === gen) {
          setLoading(false);
        }
      }
    })();
  }, [bundle]);

  const headerTitle = useMemo(() => `${bundleTitle}: Widgets`, [bundleTitle]);

  const handleBundleDownload = useCallback(async () => {
    try {
      const title = await exportWidgetBundle(bundle, { fallbackTitle: bundleTitle });
      toast.success(`Widget bundle "${title}" downloaded successfully.`);
    } catch (error) {
      console.error(error);
      toast.error(widgetBundleExportErrorMessage(error));
    }
  }, [bundle, bundleTitle]);

  const handleWidgetDownload = useCallback(async (widget: BundleWidgetListItem) => {
    const widgetId = widgetTypeIdFromRecord(widget.raw) || widget.id.trim();
    if (!widgetId) {
      toast.error("Widget id is missing.");
      return;
    }

    try {
      const widgetData = await getWidgetType(widgetId);
      const title =
        (typeof widgetData.name === "string" && widgetData.name.trim()) ||
        (typeof widgetData.title === "string" && widgetData.title.trim()) ||
        widget.name;
      const filename = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_widget.json`;
      downloadJsonFile({ ...widgetData, exportedAt: new Date().toISOString() }, filename);
      toast.success(`Widget "${title}" downloaded successfully.`);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error));
    }
  }, []);

  if (selectedWidget) {
    return <WidgetEditor widget={selectedWidget} onClose={() => setSelectedWidget(null)} />;
  }
  return (
    <Card className="overflow-hidden border border-border bg-card py-0 shadow-md">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            title="Back to widget bundles"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="truncate text-base font-semibold text-foreground">{headerTitle}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          title="Export bundle"
          onClick={handleBundleDownload}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>

      <CardContent className="max-h-[min(70vh,42rem)] overflow-y-auto p-4">
        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center text-sm text-muted-foreground">
            Loading widgets…
          </div>
        ) : widgets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
            No widgets in this bundle.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {widgets.map((widget) => (
              <WidgetListRow
                key={widget.id}
                widget={widget}
                // onEdit={() => toast.info(`Edit "${widget.name}" is not wired yet.`)}
                // onEdit={() => setSelectedWidget({
                //   id: widget.id,
                //   title: widget.name,
                //   widgetType: widget.widgetType ?? "",
                //   bundles: widget.bundles ?? [],
                //   system: widget.system ?? false,
                //   deprecated: widget.deprecated ?? false,
                //   createdDisplay: "",
                //   createdSortKey: 0,
                // } as WidgetTableRow)}
                onEdit={() => setSelectedWidget({
                  id: widget.id,
                  title: widget.name,
                  widgetType: "",
                  bundles: [],
                  system: false,
                  deprecated: false,
                  createdDisplay: "",
                  createdSortKey: 0,
                } as WidgetTableRow)}
                onDownload={() => void handleWidgetDownload(widget)}
                />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 