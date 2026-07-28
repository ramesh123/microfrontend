import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Cpu,
  Download,
  FileSpreadsheet,
  Layers,
  Loader2,
  MapPin,
  Radio,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { isAxiosError } from "axios";

import api from "@/controllers/API/api";
import { downloadCreateDevicesTemplate, createDevicesFromTemplate } from "@/controllers/API/devicesApi";
import {
  createUploadedFileRecordsForSheets,
  getExcelSheetNamesForUploadedFile,
  viewUploadedFileData,
} from "@/controllers/API/filesApi";
import type { FileUploadApiResponse } from "@/pages/MasterDataPage/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';

const IMPORT_STEP_LABELS = ["Download Template", "Upload File", "Review", "Create"] as const;
type ImportStep = 1 | 2 | 3 | 4;

/** `file_category` for excel-actions + create-file (align with Master Data). */
const DEVICE_IMPORT_FILE_CATEGORY = "source_data";

function StepConnector({ variant }: { variant: "empty" | "progress" | "full" }) {
  const trackClass = "relative h-[3px] min-w-[1rem] flex-1 rounded-full bg-muted/80";
  if (variant === "full") {
    return <div className={cn(trackClass, "bg-primary")} aria-hidden />;
  }
  if (variant === "empty") {
    return <div className={trackClass} aria-hidden />;
  }
  return (
    <div className={trackClass} aria-hidden>
      <div className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-primary transition-[width] duration-300 ease-out" />
    </div>
  );
}

function connectorVariant(step: ImportStep, index: 0 | 1 | 2): "empty" | "progress" | "full" {
  if (index === 0) {
    if (step >= 2) return "full";
    return "empty";
  }
  if (index === 1) {
    if (step >= 3) return "full";
    if (step === 2) return "progress";
    return "empty";
  }
  if (step >= 4) return "full";
  if (step === 3) return "progress";
  return "empty";
}

/** Vertically center connector with step circle (not label). */
const STEPPER_CONNECTOR_ALIGN_CLASS = "self-start pt-[calc(theme(spacing.7)/2-1.5px)] sm:pt-[calc(theme(spacing.8)/2-1.5px)]";

function ImportStepper({ step, className }: { step: ImportStep; className?: string }) {
  const circle = (n: ImportStep) => {
    const completed = step > n;
    const active = step === n;
    return (
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors sm:h-8 sm:w-8 sm:text-xs",
          completed && "border-2 border-primary bg-background text-primary shadow-none",
          active && "border-0 bg-primary text-primary-foreground shadow-sm",
          !completed && !active && "border-2 border-muted-foreground/35 bg-background text-muted-foreground",
        )}
        aria-current={active ? "step" : undefined}
        aria-label={completed ? `Step ${n} completed` : active ? `Step ${n}, current` : `Step ${n}`}
      >
        {completed ? <Check className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" strokeWidth={2.5} aria-hidden /> : n}
      </div>
    );
  };

  return (
    <nav
      className={cn(
        "px-4",
        className,
      )}
      aria-label="Import progress"
    >
      <div className="flex w-full min-w-0 flex-nowrap items-start gap-x-2 overflow-x-auto pb-0.5 sm:gap-x-3">
        {([1, 2, 3, 4] as const).map((n, i) => {
          const label = IMPORT_STEP_LABELS[n - 1];
          const completed = step > n;
          const active = step === n;
          return (
            <React.Fragment key={n}>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {circle(n)}
                <span
                  className={cn(
                    "max-w-[5.5rem] text-left text-[11px] font-medium leading-tight sm:max-w-[7.5rem] sm:text-xs md:max-w-[9rem] lg:max-w-none",
                    (completed || active) && "text-primary",
                    !completed && !active && "text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < 3 ? (
                <div
                  className={cn(
                    "flex min-w-[0.75rem] flex-1 px-0.5 sm:min-w-[1rem]",
                    STEPPER_CONNECTOR_ALIGN_CLASS,
                  )}
                >
                  <StepConnector variant={connectorVariant(step, i as 0 | 1 | 2)} />
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}

type TemplateColumnRow = {
  columnName: string;
  required: boolean;
  description: string;
  example: string;
};

const DEVICES_SHEET_ROWS: TemplateColumnRow[] = [
  {
    columnName: "device_name",
    required: true,
    description: "Unique name of the device",
    example: "PUMP-1001",
  },
  {
    columnName: "device_type",
    required: true,
    description: "Type/category of the device",
    example: "Pump",
  },
  {
    columnName: "product",
    required: true,
    description: "Associated product or model",
    example: "Centrifugal Pump X200",
  },
];

const SENSORS_SHEET_ROWS: TemplateColumnRow[] = [
  {
    columnName: "device_name",
    required: true,
    description: "Must match device_name from Sheet 1",
    example: "PUMP-1001",
  },
  {
    columnName: "sensor_name",
    required: true,
    description: "Name of the sensor",
    example: "Temperature",
  },
  {
    columnName: "sensor_tag",
    required: true,
    description: "Unique tag/identifier (must match Sheet 1 when same sensor)",
    example: "TMP-1001-T",
  },
  {
    columnName: "healthy_value",
    required: true,
    description: "Healthy value for the sensor",
    example: "0",
  },
  {
    columnName: "sensor_id",
    required: true,
    description: "Sensor ID to be mapped to the sensor ",
    example: "TK-01-LVL",
  },
  {
    columnName: "sensor_type",
    required: true,
    description: "Sensor type to be used for the sensor ",
    example: "Primary Radar",
  },
  
];


function TemplateColumnTable({ rows }: { rows: TemplateColumnRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background shadow-inner">
      <Table>
        <TableHeader>
          <TableRow className="border-border/60 hover:bg-transparent">
            <TableHead className="h-11 w-[min(14rem,28%)] bg-muted/40 pl-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Column name
            </TableHead>
            <TableHead className="h-11 w-24 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Required
            </TableHead>
            <TableHead className="h-11 min-w-[12rem] bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </TableHead>
            <TableHead className="h-11 w-[min(11rem,22%)] bg-muted/40 pr-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Example
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow
              key={`${row.columnName}-${i}`}
              className="border-border/50 transition-colors hover:bg-muted/25"
            >
              <TableCell className="py-3 pl-4 align-middle">
                <code className="rounded-md bg-muted/60 px-2 py-1 font-mono text-[0.8125rem] font-medium text-foreground">
                  {row.columnName}
                </code>
              </TableCell>
              <TableCell className="py-3 align-middle">
                {row.required ? (
                  <Badge className="border-0 bg-primary/14 px-2.5 font-medium text-primary shadow-none hover:bg-primary/20">
                    Yes
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-border/80 font-medium text-muted-foreground">
                    No
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-xl py-3 align-middle text-sm leading-relaxed text-muted-foreground">
                {row.description}
              </TableCell>
              <TableCell className="py-3 pr-4 align-middle text-sm font-medium text-foreground">{row.example}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const REVIEW_PREVIEW_ROW_LIMIT = 75;

type ParsedImportSheet = {
  name: string;
  headers: string[];
  previewRows: string[][];
  totalDataRows: number;
  /** Set when view-data fails for this sheet only */
  loadError?: string;
};

function cellToDisplayString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function viewResponseToParsedSheet(sheetName: string, raw: unknown): ParsedImportSheet {
  if (!raw || typeof raw !== "object") {
    return {
      name: sheetName,
      headers: [],
      previewRows: [],
      totalDataRows: 0,
      loadError: "Empty response from server.",
    };
  }
  const o = raw as {
    columns?: unknown;
    data?: unknown;
    status?: boolean;
    message?: string;
  };
  let headers: string[] = Array.isArray(o.columns) ? o.columns.map(String) : [];
  const dataRaw = o.data;
  const rowsIn: unknown[] = Array.isArray(dataRaw) ? dataRaw : [];

  if (headers.length === 0 && rowsIn.length > 0) {
    const first = rowsIn[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      headers = Object.keys(first as Record<string, unknown>);
    }
  }

  const rows = rowsIn.map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const rec = row as Record<string, unknown>;
      return headers.map((h) => cellToDisplayString(rec[h]));
    }
    if (Array.isArray(row)) {
      return headers.map((_, i) => cellToDisplayString(row[i]));
    }
    return headers.map(() => "");
  });

  const previewRows = rows.slice(0, REVIEW_PREVIEW_ROW_LIMIT);
  return {
    name: sheetName,
    headers,
    previewRows,
    totalDataRows: rows.length,
  };
}

function ImportReviewDataTables({ sheets }: { sheets: ParsedImportSheet[] }) {
  const defaultTab = sheets[0]?.name ?? "sheet-0";
  if (!sheets.length) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        No sheets found in this workbook.
      </p>
    );
  }

  return (
    <Tabs defaultValue={defaultTab} className="w-full gap-0">
      <div className="inline-block max-w-full overflow-x-auto border-b border-border/80">
        <TabsList
          className={cn(
            "mb-0 inline-flex h-auto w-max flex-none flex-wrap items-end justify-start gap-x-1 rounded-none border-0 bg-transparent p-0 sm:gap-x-2",
          )}
        >
          {sheets.map((s, idx) => (
            <TabsTrigger
              key={s.name}
              value={s.name}
              className={cn(
                "relative -mb-px inline-flex max-w-[11rem] shrink-0 justify-center gap-1 rounded-none border-0 border-b-2 border-transparent bg-transparent px-2.5 py-2 text-xs font-medium shadow-none ring-0 transition-colors whitespace-nowrap sm:max-w-[13rem] sm:text-sm",
                "text-muted-foreground hover:text-foreground/90",
                "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
              )}
            >
              <span className="truncate">{s.name}</span>
              <span className="hidden shrink-0 font-normal opacity-80 sm:inline">({idx + 1})</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {sheets.map((s) => (
        <TabsContent key={s.name} value={s.name} className="mt-4 outline-none focus-visible:outline-none">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
            <span>
              {s.headers.length} column{s.headers.length === 1 ? "" : "s"}
              <span className="text-border"> · </span>
              {s.totalDataRows} data row{s.totalDataRows === 1 ? "" : "s"}
            </span>
            {s.totalDataRows > s.previewRows.length ? (
              <span className="text-xs">
                Showing first {s.previewRows.length} rows in preview
              </span>
            ) : null}
          </div>
          {s.loadError ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {s.loadError}
            </p>
          ) : s.headers.length === 0 ? (
            <p className="text-sm text-muted-foreground">This sheet has no columns in the server response.</p>
          ) : (
            <div className="max-h-[min(28rem,55vh)] overflow-auto rounded-lg border border-border/70 bg-background shadow-inner">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="sticky left-0 z-20 h-10 w-12 min-w-12 border-r border-border/60 bg-muted/50 text-center text-xs font-semibold text-muted-foreground">
                      #
                    </TableHead>
                    {s.headers.map((h, hi) => (
                      <TableHead
                        key={`h-${hi}`}
                        className="h-10 min-w-[8rem] whitespace-nowrap bg-muted/40 text-xs font-semibold text-foreground"
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s.previewRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={s.headers.length + 1}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        No data rows under this header.
                      </TableCell>
                    </TableRow>
                  ) : (
                    s.previewRows.map((row, ri) => (
                      <TableRow key={ri} className="border-border/50">
                        <TableCell className="sticky left-0 z-10 border-r border-border/60 bg-background/95 py-2 text-center text-xs text-muted-foreground backdrop-blur-sm">
                          {ri + 1}
                        </TableCell>
                        {s.headers.map((_, ci) => (
                          <TableCell key={`c-${ci}`} className="max-w-[14rem] truncate py-2 text-sm" title={row[ci]}>
                            {row[ci] ?? ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function ImportReviewStep(props: {
  businessUnit: string;
  locationId: string;
  locationName: string;
  fileUploadData: FileUploadApiResponse;
  excelSheetNames: string[];
}) {
  const { businessUnit, locationId, locationName, fileUploadData, excelSheetNames } = props;
  const [loading, setLoading] = useState(true);
  const [sheets, setSheets] = useState<ParsedImportSheet[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (excelSheetNames.length === 0) {
      setSheets([]);
      setError("No sheet names from the server. Go back to the upload step and try again.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const built: ParsedImportSheet[] = [];
      try {
        for (const sheetName of excelSheetNames) {
          try {
            const raw = await viewUploadedFileData({
              unique_id: fileUploadData.unique_id,
              file_name: fileUploadData.file_name,
              encrypted_file_key: fileUploadData.encrypted_file_key,
              sheet_name: sheetName,
            });
            if (cancelled) return;
            built.push(viewResponseToParsedSheet(sheetName, raw));
          } catch (e: unknown) {
            if (cancelled) return;
            const msg = isAxiosError(e)
              ? String(
                  e.response?.data && typeof e.response.data === "object" && "message" in e.response.data
                    ? (e.response.data as { message?: unknown }).message ?? e.message
                    : e.message,
                )
              : getDisplayErrorMessage(e, "Could not load this sheet.");
            built.push({
              name: sheetName,
              headers: [],
              previewRows: [],
              totalDataRows: 0,
              loadError: msg,
            });
          }
        }
        if (!cancelled) setSheets(built);
      } catch (e: unknown) {
        if (!cancelled) {
          setSheets([]);
          setError(getDisplayErrorMessage(e, "Could not load preview from the server."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUploadData, excelSheetNames]);


  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-4 py-5 shadow-sm sm:px-6 sm:py-6"
      aria-labelledby="import-review-heading"
    >
      <div className="mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id="import-review-heading" className="text-lg font-semibold tracking-tight">
            Review import
          </h2>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Loading preview from server…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <ImportReviewDataTables sheets={sheets} />
      )}
    </section>
  );
}

type CreateDevicesPreviewResult = {
  status: boolean;
  message: string;
  business_unit: string;
  location_id: string;
  location_name: string;
  total_devices_to_create: number;
  total_sensors_to_create: number;
};

function parseCreateDevicesPreviewResult(raw: unknown): CreateDevicesPreviewResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    status: o.status === true,
    message: String(o.message ?? "").trim(),
    business_unit: String(o.business_unit ?? "").trim(),
    location_id: String(o.location_id ?? "").trim(),
    location_name: String(o.location_name ?? "").trim(),
    total_devices_to_create: Number(o.total_devices_to_create) || 0,
    total_sensors_to_create: Number(o.total_sensors_to_create) || 0,
  };
}

function ImportCreateStep(props: {
  businessUnit: string;
  locationId: string;
  locationName: string;
  fileUploadData: FileUploadApiResponse;
  onCreated: () => void;
}) {
  const { businessUnit, locationId, locationName, fileUploadData, onCreated } = props;
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CreateDevicesPreviewResult | null>(null);
  const [submittingDevices, setSubmittingDevices] = useState(false);
  const createDevicesRequestInFlightRef = useRef(false);
  const previewSeqRef = useRef(0);

  const basePayload = useMemo(
    () => ({
      business_unit: businessUnit.trim(),
      location_id: locationId.trim(),
      location_name: locationName.trim(),
      file_name: fileUploadData.file_name,
      encrypted_file_key: fileUploadData.encrypted_file_key,
    }),
    [businessUnit, locationId, locationName, fileUploadData],
  );

  useEffect(() => {
    const seq = ++previewSeqRef.current;
    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);
    setPreview(null);

    void (async () => {
      try {
        const raw = await createDevicesFromTemplate({
          ...basePayload,
          preview: true,
        });
        if (cancelled || seq !== previewSeqRef.current) return;
        const parsed = parseCreateDevicesPreviewResult(raw);
        if (!parsed) {
          setPreviewError("Invalid preview response from the server.");
          return;
        }
        if (!parsed.status) {
          setPreviewError(parsed.message || "Template validation failed.");
          return;
        }
        setPreview(parsed);
      } catch (e) {
        if (cancelled || seq !== previewSeqRef.current) return;
        setPreviewError(getDisplayErrorMessage(e, "Could not load import preview."));
      } finally {
        if (!cancelled && seq === previewSeqRef.current) setLoadingPreview(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [basePayload]);

  const canCreate =
    !loadingPreview && !previewError && preview != null && preview.status;

  const handleCreateDevicesFromTemplate = useCallback(async () => {
    if (createDevicesRequestInFlightRef.current) return;
    createDevicesRequestInFlightRef.current = true;
    setSubmittingDevices(true);
    try {
      const data = await createDevicesFromTemplate({
        ...basePayload,
        unique_id: fileUploadData.unique_id,
        preview: false,
      });
      const msg =
        data && typeof data === "object" && "message" in data
          ? String((data as { message?: unknown }).message ?? "").trim()
          : "";
      toast.success(msg || "Devices created from template.");
      onCreated();
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Create devices failed."));
    } finally {
      createDevicesRequestInFlightRef.current = false;
      setSubmittingDevices(false);
    }
  }, [basePayload, fileUploadData.unique_id, onCreated]);

  return (
    <section
      className="rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-4"
      aria-labelledby="wizard-step-title"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h2 id="wizard-step-title" className="text-lg font-semibold tracking-tight">
              {IMPORT_STEP_LABELS[3]}
            </h2>
          </div>
        </div>
      </div>

      {loadingPreview ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/70 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">Validating template…</p>
        </div>
      ) : previewError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {previewError}
        </div>
      ) : preview ? (
        <div className="space-y-5">
          <div
            className="flex gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3.5 sm:items-start"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                {preview.message || "Template workbook parsed successfully."}
              </p>
              <p className="text-xs text-muted-foreground">
                Your file is ready to import. Review the counts and location details before continuing.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Cpu className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {preview.total_devices_to_create}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Devices to create</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Radio className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums text-foreground">
                  {preview.total_sensors_to_create}
                </p>
                <p className="text-xs font-medium text-muted-foreground">Sensors to create</p>
              </div>
            </div>
          </div>

          <Card className="gap-0 border-border/70 py-0 shadow-sm">
            <CardHeader className="border-b border-border/60 px-4 py-3 sm:px-5">
              <CardTitle className="text-sm font-semibold">Import details</CardTitle>
              <CardDescription className="text-xs">Values returned from template validation</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border/60 px-4 py-0 sm:px-5">
              <dl className="grid gap-0">
                {[
                  { label: "Business unit", value: preview.business_unit || businessUnit, icon: Briefcase },
                  { label: "Location ID", value: preview.location_id || locationId, icon: MapPin },
                  { label: "Location name", value: preview.location_name || locationName, icon: Building2 },
                  { label: "Template file", value: fileUploadData.file_name, icon: FileSpreadsheet },
                ].map(({ label, value, icon: DetailIcon }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-3 text-sm first:pt-3 last:pb-3"
                  >
                    <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      {DetailIcon ? (
                        <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                          <DetailIcon className="h-3.5 w-3.5 stroke-[1.75] text-muted-foreground" />
                        </span>
                      ) : null}
                      {label}
                    </dt>
                    <dd className="min-w-0 truncate text-right font-medium text-foreground" title={value}>
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              This will create {preview.total_devices_to_create} device
              {preview.total_devices_to_create === 1 ? "" : "s"} and {preview.total_sensors_to_create} sensor
              {preview.total_sensors_to_create === 1 ? "" : "s"} in your gateway.
            </p>
            <Button
              type="button"
              disabled={submittingDevices || !canCreate}
              className="shrink-0 gap-2 sm:min-w-[10rem]"
              onClick={() => void handleCreateDevicesFromTemplate()}
            >
              {submittingDevices ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Create devices
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function UploadFileStep(props: {
  downloading: boolean;
  onDownloadTemplate: () => void | Promise<void>;
  file: File | null;
  onFileChange: (f: File | null) => void;
  businessUnit: string;
  onBusinessUnitChange: (v: string) => void;
  locationId: string;
  onLocationIdChange: (v: string) => void;
  locationName: string;
  onLocationNameChange: (v: string) => void;
  fileUploadData: FileUploadApiResponse | null;
  onUploadSuccess: (data: FileUploadApiResponse) => void;
  excelSheetNames: string[];
  onExcelSheetsLoaded: (sheetNames: string[]) => void;
}) {
  const {
    downloading,
    onDownloadTemplate,
    file,
    onFileChange,
    businessUnit,
    onBusinessUnitChange,
    locationId,
    onLocationIdChange,
    locationName,
    onLocationNameChange,
    fileUploadData,
    onUploadSuccess,
    excelSheetNames,
    onExcelSheetsLoaded,
  } = props;
  const [dragOver, setDragOver] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadSeqRef = useRef(0);
  /** File identity we already finished one upload attempt for (success or failure). Cleared when `file` is removed. */
  const attemptedFileKeyRef = useRef<string | null>(null);

  const fileIdentityKey =
    file != null ? `${file.name}\0${file.size}\0${file.lastModified}` : "";

  const pickFile = useCallback(
    (f: File | null) => {
      if (!f) return;
      const lower = f.name.toLowerCase();
      const isExcel =
        lower.endsWith(".xlsx") ||
        lower.endsWith(".xls") ||
        f.type.includes("spreadsheet") ||
        f.type.includes("excel");
      if (!isExcel) {
        toast.error("Please choose an Excel file (.xlsx or .xls).");
        return;
      }
      onFileChange(f);
    },
    [onFileChange],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) pickFile(f);
    },
    [pickFile],
  );

  useEffect(() => {
    if (!file) {
      attemptedFileKeyRef.current = null;
      return;
    }
    if (fileUploadData) return;

    if (attemptedFileKeyRef.current === fileIdentityKey) return;

    const seq = ++uploadSeqRef.current;
    let cancelled = false;

    const run = async () => {
      setValidating(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append("upload_file", file);
      try {
        const response = await api.post<FileUploadApiResponse>("/files/upload-file", formData, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            }
          },
        });
        if (cancelled || seq !== uploadSeqRef.current) return;
        if (response.data?.unique_id) {
          setUploadProgress(100);
          const uploaded = response.data;
          toast.success(uploaded.message || "File uploaded successfully.");

          try {
            const sheets = await getExcelSheetNamesForUploadedFile({
              file_name: uploaded.file_name,
              unique_id: uploaded.unique_id,
              encrypted_file_key: uploaded.encrypted_file_key,
              file_category: DEVICE_IMPORT_FILE_CATEGORY,
            });
            if (cancelled || seq !== uploadSeqRef.current) return;
            onExcelSheetsLoaded(sheets);
            if (sheets.length > 0) {
              const preview = sheets.join(", ");
              toast.info(
                preview.length > 120 ? `Sheets (${sheets.length}): ${preview.slice(0, 117)}…` : `Sheets: ${preview}`,
              );
              const primarySheet = sheets[0];
              const { succeeded, failed } = await createUploadedFileRecordsForSheets({
                upload: uploaded,
                sheetNames: [primarySheet],
                file_category: DEVICE_IMPORT_FILE_CATEGORY,
              });
              if (cancelled || seq !== uploadSeqRef.current) return;
              if (failed.length === 0) {
                toast.success(`File record created for sheet "${primarySheet}".`);
              } else {
                toast.error(
                  failed.map((f) => `${f.sheet}: ${f.error}`).join(" | ") || "Could not create file record.",
                );
              }
            }
          } catch (sheetErr: unknown) {
            if (cancelled || seq !== uploadSeqRef.current) return;
            onExcelSheetsLoaded([]);
            let sheetMessage = "Could not load sheet names from the server.";
            if (isAxiosError(sheetErr)) {
              const d = sheetErr.response?.data;
              const fromBody =
                d && typeof d === "object" && "message" in d
                  ? String((d as { message?: unknown }).message ?? "")
                  : "";
              sheetMessage = fromBody || sheetErr.message || sheetMessage;
            } else if (sheetErr instanceof Error) {
              sheetMessage = sheetErr.message;
            }
            toast.error(sheetMessage);
          } finally {
            if (!cancelled && seq === uploadSeqRef.current) {
              attemptedFileKeyRef.current = fileIdentityKey;
              onUploadSuccess(uploaded);
            }
          }
        } else {
          throw new Error(response.data?.message || "Upload failed: invalid server response.");
        }
      } catch (error: unknown) {
        if (cancelled || seq !== uploadSeqRef.current) return;
        attemptedFileKeyRef.current = fileIdentityKey;
        setUploadProgress(0);
        toast.error(getDisplayErrorMessage(error, "Upload failed. Please try again."));
      } finally {
        if (seq === uploadSeqRef.current) setValidating(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [file, fileIdentityKey, fileUploadData, onUploadSuccess, onExcelSheetsLoaded]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card className="gap-0 border-border/70 py-0 shadow-sm">
          <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
            <CardTitle className="text-base">Upload template file</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 pt-4 sm:px-6">
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 bg-muted/20 hover:border-primary/40 hover:bg-muted/30",
              )}
            >
              <CloudUpload className="h-10 w-10 text-primary" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Drag and drop your .xlsx file here</p>
                <p className="text-xs text-muted-foreground">or click to browse</p>
              </div>
            </button>

            {file ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5">
                  <FileSpreadsheet className="h-9 w-9 shrink-0 text-emerald-600" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <span className="sr-only">File attached</span>
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    onClick={() => inputRef.current?.click()}
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Replace file
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium text-destructive hover:underline"
                    onClick={() => onFileChange(null)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Remove
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={downloading}
              className="inline-flex items-center gap-1.5 text-left text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              onClick={() => void onDownloadTemplate()}
            >
              {downloading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : <Download className="h-4 w-4 shrink-0" aria-hidden />}
              Need a template? Download the latest template
            </button>
          </CardContent>
        </Card>

        <Card className="gap-0 border-border/70 py-0 shadow-sm">
          <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
            <CardTitle className="text-base">File details</CardTitle>
            <CardDescription>
              The workbook uploads to the server as soon as you attach it (one request per file). Fill in the details below before
              continuing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 pt-4 sm:px-6">
            <div className="grid gap-2">
              <Label htmlFor="import-bu">
                Business unit <span className="text-destructive">*</span>
              </Label>
              <Input
                id="import-bu"
                placeholder="Enter business unit"
                value={businessUnit}
                onChange={(e) => onBusinessUnitChange(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-loc-id">
                Location ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="import-loc-id"
                placeholder="Enter Location ID"
                value={locationId}
                onChange={(e) => onLocationIdChange(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-loc-name">
                Location name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="import-loc-name"
                placeholder="Enter Location Name"
                value={locationName}
                onChange={(e) => onLocationNameChange(e.target.value)}
                className="h-10"
              />
            </div>
            {file && !fileUploadData && (validating || uploadProgress > 0) ? (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {validating ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
                  <span>{validating ? "Uploading…" : "Upload complete"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-[width] duration-150 ease-out"
                    style={{ width: `${validating ? Math.max(uploadProgress, 8) : uploadProgress}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">{uploadProgress}%</p>
              </div>
            ) : null}

            {file && !fileUploadData && !validating && uploadProgress === 0 && attemptedFileKeyRef.current === fileIdentityKey ? (
              <p className="text-xs text-muted-foreground">
                Upload did not complete. Remove the file and attach it again to retry.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DeviceImportPage() {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileUploadData, setFileUploadData] = useState<FileUploadApiResponse | null>(null);
  const [excelSheetNames, setExcelSheetNames] = useState<string[]>([]);
  const [businessUnit, setBusinessUnit] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationName, setLocationName] = useState("");

  const handleUploadFileChange = useCallback((f: File | null) => {
    setUploadFile(f);
    setFileUploadData(null);
    setExcelSheetNames([]);
  }, []);

  const canProceedFromUploadStep = useMemo(
    () =>
      uploadFile != null &&
      fileUploadData != null &&
      businessUnit.trim() !== "" &&
      locationId.trim() !== "" &&
      locationName.trim() !== "",
    [uploadFile, fileUploadData, businessUnit, locationId, locationName],
  );

  const downloadTemplate = useCallback(async () => {
    setDownloading(true);
    try {
      await downloadCreateDevicesTemplate();
      toast.success("Template downloaded.");
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to download template."));
    } finally {
      setDownloading(false);
    }
  }, []);

  const goNext = useCallback(() => {
    setImportStep((s) => (s < 4 ? ((s + 1) as ImportStep) : s));
  }, []);

  const goPrev = useCallback(() => {
    setImportStep((s) => (s > 1 ? ((s - 1) as ImportStep) : s));
  }, []);

  const handleStepperNext = useCallback(() => {
    if (importStep === 2 && !canProceedFromUploadStep) return;
    goNext();
  }, [importStep, canProceedFromUploadStep, goNext]);

  const stepperNextDisabled =
    importStep >= 4 || (importStep === 2 && !canProceedFromUploadStep);

  return (
    <div className="mx-auto flex w-full max-w-8xl flex-col gap-3 px-1 pb-1 pt-1 sm:px-0">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full !border-none !shadow-none"
            onClick={() => navigate("/iot-gateway/devices")}
            title="Back to devices"
          >
            <ArrowLeft className="h-6 w-6 !m-0" aria-hidden />
          </Button>
          <div className="mt-1 min-w-0 space-y-1">
            <h1 className="text-lg font-semibold sm:text-xl">Import devices</h1>
            
          </div>
        </div>
      </header>

      <ImportStepper step={importStep} />

      {importStep === 1 ? (
        <>
      <section
        className="overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm"
        aria-labelledby="template-schema-heading"
      >
        <div className="flex flex-col gap-2 border-b border-border/60 bg-gradient-to-br from-muted/50 via-muted/25 to-transparent px-5 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 space-y-1">
            <h2 id="template-schema-heading" className="text-lg font-semibold tracking-tight">
              Template schema
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your Excel workbook must include these two sheets and use the exact column headers shown.
            </p>
          </div>
          <div
            className="flex shrink-0 items-center gap-2.5 self-start rounded-lg border border-border/70 bg-background/90 px-3.5 py-2 text-sm shadow-sm backdrop-blur-sm sm:self-auto"
            role="note"
          >
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <span className="font-medium text-foreground">Excel workbook</span>
            <Separator orientation="vertical" className="h-4 bg-border/80" />
            <span className="text-muted-foreground">.xlsx</span>
          </div>
        </div>

        <div className="px-4 pb-6 pt-2 sm:px-6">
          <Tabs defaultValue="devices" className="w-full gap-0">
            <div className="w-full border-b border-border/80">
              <TabsList
                className={cn(
                  "mb-0 inline-flex h-auto w-fit max-w-full flex-none flex-wrap items-end justify-start gap-x-4 rounded-none border-0 bg-transparent p-0 sm:gap-x-6",
                )}
              >
                <TabsTrigger
                  value="devices"
                  className={cn(
                    "relative -mb-px inline-flex !flex-none shrink-0 justify-start gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-2 py-2.5 text-sm font-medium shadow-none ring-0 transition-colors whitespace-nowrap",
                    "text-muted-foreground hover:text-foreground/90",
                    "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                  )}
                >
                  <span>Devices</span>
                  <span className="hidden font-normal opacity-80 sm:inline">(Sheet 1)</span>
                </TabsTrigger>
                <TabsTrigger
                  value="sensors"
                  className={cn(
                    "relative -mb-px inline-flex !flex-none shrink-0 justify-start gap-1.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-2 py-2.5 text-sm font-medium shadow-none ring-0 transition-colors whitespace-nowrap",
                    "text-muted-foreground hover:text-foreground/90",
                    "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none",
                  )}
                >
                  <span>Sensors</span>
                  <span className="hidden font-normal opacity-80 sm:inline">(Sheet 2)</span>
                </TabsTrigger>
              </TabsList>
            </div>
            <div className="pt-6">
              <TabsContent value="devices" className="mt-0 outline-none focus-visible:outline-none">
                <TemplateColumnTable rows={DEVICES_SHEET_ROWS} />
              </TabsContent>
              <TabsContent value="sensors" className="mt-0 outline-none focus-visible:outline-none">
                <TemplateColumnTable rows={SENSORS_SHEET_ROWS} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </section>

      <section
        className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-background to-background px-5 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-6"
        aria-label="Download template"
      >
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-foreground">Download blank template</h3>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            Generates an empty file with the correct structure. Fill it in offline, then use your gateway import when it is
            available.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="!h-9 shrink-0 gap-2 px-6 shadow-sm sm:min-w-[11rem]"
          onClick={() => void downloadTemplate()}
          disabled={downloading}
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          Download template
        </Button>
      </section>
        </>
      ) : importStep === 2 ? (
        <UploadFileStep
          downloading={downloading}
          onDownloadTemplate={() => void downloadTemplate()}
          file={uploadFile}
          onFileChange={handleUploadFileChange}
          businessUnit={businessUnit}
          onBusinessUnitChange={setBusinessUnit}
          locationId={locationId}
          onLocationIdChange={setLocationId}
          locationName={locationName}
          onLocationNameChange={setLocationName}
          fileUploadData={fileUploadData}
          onUploadSuccess={setFileUploadData}
          excelSheetNames={excelSheetNames}
          onExcelSheetsLoaded={setExcelSheetNames}
        />
      ) : importStep === 3 && uploadFile && fileUploadData ? (
        <ImportReviewStep
          businessUnit={businessUnit}
          locationId={locationId}
          locationName={locationName}
          fileUploadData={fileUploadData}
          excelSheetNames={excelSheetNames}
        />
      ) : importStep === 3 ? (
        <section
          className="rounded-xl border border-border/70 bg-card px-5 py-8 text-center shadow-sm sm:px-8"
          aria-labelledby="import-review-missing-file"
        >
          <h2 id="import-review-missing-file" className="text-base font-semibold">
            No file to review
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Go back and upload an Excel file to continue.</p>
        </section>
      ) : importStep === 4 && fileUploadData ? (
        <ImportCreateStep
          businessUnit={businessUnit}
          locationId={locationId}
          locationName={locationName}
          fileUploadData={fileUploadData}
          onCreated={() => navigate("/iot-gateway/devices")}
        />
      ) : (
        <section
          className="rounded-xl border border-border/70 bg-card px-5 py-8 text-center shadow-sm sm:px-8"
          aria-labelledby="import-create-missing-file"
        >
          <h2 id="import-create-missing-file" className="text-base font-semibold">
            Cannot create devices
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Go back and upload an Excel file to continue.</p>
        </section>
      )}
      <div
        className="mt-0 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-1"
        role="navigation"
        aria-label="Import steps"
      >
        <div className="min-w-0">
          {importStep > 1 ? (
            <Button type="button" variant="outline" className="gap-1.5 !h-8" onClick={goPrev}>
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {importStep < 4 ? (
            <Button
              type="button"
              className="gap-1.5 !h-8"
              disabled={stepperNextDisabled}
              title={
                importStep === 2 && !canProceedFromUploadStep
                  ? "Attach a workbook (it uploads once right away), then fill business unit and location fields"
                  : undefined
              }
              onClick={handleStepperNext}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
