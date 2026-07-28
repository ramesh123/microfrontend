import { useState, useEffect, useCallback, useRef } from "react";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Database,
  Boxes,
  GitBranch,
  BarChart3,
  Grid3X3,
  Sparkles,
  Check,
  AlertCircle,
  Clock,
  Table2,
  Layers,
  ArrowRight,
  MessageCircleMore,
  FileCode2,
  Columns3,
  BookOpen,
  Award,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSemanticsStore,
  type ReadinessReviewSummaryData,
} from "@/stores/semanticsStore";
import {
  fetchReviewSummary,
  certifyMetric,
  certifyFact,
  certifyDimension,
  certifyHierarchy,
  certifyEntity,
  certifyGlossaryTerm,
  certifyAllMetrics,
  certifyAllFacts,
  certifyAllDimensions,
  certifyAllHierarchies,
  certifyAllEntities,
  certifyAllGlossary,
} from "@/controllers/API/semanticsApi";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- Status helpers ---

const statusConfig: Record<
  string,
  { bg: string; text: string; icon?: React.ReactNode }
> = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-600",
    icon: <Clock className="size-3" />,
  },
  reviewed: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    icon: <Check className="size-3" />,
  },
  applied: {
    bg: "bg-green-50",
    text: "text-green-600",
    icon: <Check className="size-3" />,
  },
  certified: {
    bg: "bg-green-50",
    text: "text-green-600"
    },
  suggested: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    icon: <Sparkles className="size-3" />,
  },
  seeded: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    icon: <Layers className="size-3" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig.draft;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[11px] font-medium leading-none",
        config.bg,
        config.text,
      )}
    >
      {config.icon}
      {status}
    </span>
  );
}

function CertifyButton({
  status,
  onClick,
}: {
  status?: string;
  onClick: () => void;
}) {
  if (status === "certified") {
    return <Award className="size-4 text-green-600 fill-green-600/20" />;
  }

  return (
    <button
      className="size-4 text-slate-400 hover:text-primary transition-all opacity-0 group-hover:opacity-100"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="Certify"
    >
      <Award className="size-4" />
    </button>
  );
}

// --- Stat Pill (inline in header bar) ---

function StatPill({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border bg-card">
      <div
        className={cn(
          "size-6 rounded-sm flex items-center justify-center shrink-0",
          color,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold font-mono tabular-nums leading-none">
          {value}
        </div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          {label}
        </div>
      </div>
    </div>
  );
}

// --- Section Card ---

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  statuses: Record<string, number>;
  children: React.ReactNode;
  onCertifyAll?: () => void;
  isCertifyingAll?: boolean;
  allCertified?: boolean;
}

function SectionCard({
  title,
  icon,
  count,
  statuses,
  children,
  onCertifyAll,
  isCertifyingAll,
  allCertified,
}: SectionCardProps) {
  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-1.5">
          <div className="size-6 rounded-sm flex items-center justify-center bg-primary/10">
            {icon}
          </div>
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            ({count})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {Object.entries(statuses).map(([status, num]) => (
            <span
              key={status}
              className={cn(
                "px-1.5 py-0.5 rounded-sm text-[11px] font-medium",
                statusConfig[status]?.bg ?? "bg-slate-100",
                statusConfig[status]?.text ?? "text-slate-600",
              )}
            >
              {num} {status}
            </span>
          ))}
          {onCertifyAll && count > 0 && (
            allCertified ? (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-green-50 text-green-600">
                <Award className="size-3" /> All certified
              </span>
            ) : (
              <button
                onClick={onCertifyAll}
                disabled={isCertifyingAll}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                {isCertifyingAll ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Award className="size-3" />
                )}
                Certify All
              </button>
            )
          )}
        </div>
      </div>
      <div className="p-2 max-h-48 overflow-y-auto">{children}</div>
    </div>
  );
}

// --- Dummy data for fallback ---

const DUMMY_SUMMARY: ReadinessReviewSummaryData = {
  scan: {
    tables: 2,
    schema_payload: {
      name: "public",
      limit: 20,
      cursor: null,
      tables: [
        {
          table: "host_local_loaded_tts",
          columns: [
            {
              name: "bay_number",
              profile: { sample_values: ["03", "14", "11", "05", "01"] },
              distinct: 25.0,
              data_type: "character varying",
              null_frac: 0.0,
            },
          ],
        },
        {
          table: "host_over_loaded_tts",
          columns: [
            {
              name: "load_number",
              profile: { max: 855415.0, min: 86514.0, mean: 768289.31 },
              distinct: -0.9064103,
              data_type: "integer",
              null_frac: 0.0,
            },
            {
              name: "truck_number",
              profile: { sample_values: ["HR63C5840"] },
              distinct: -0.33846155,
              data_type: "character varying",
              null_frac: 0.0,
            },
          ],
        },
      ],
      next_cursor: null,
    },
  },
  glossary: [
    {
      term_id: "term_001",
      term: "Revenue",
      normalized_term: "revenue",
      definition: "Total income generated from business operations",
      synonyms: ["Income", "Sales"],
      abbreviations: ["REV"],
      lifecycle_status: "suggested",
    },
  ],
  entities: [
    {
      entity_id: "asset",
      description: "Auto-mapped from host_local_loaded_tts.truck_number",
      join_key: "truck_number",
      examples: ["truck_number"],
      lifecycle_status: "draft",
      source_type: "user",
    },
  ],
  hierarchies: [
    {
      name: "zone",
      levels: [
        "sap_id",
        "bay",
        "bcu",
        "meter_number",
        "mfm_number",
        "stock_code/product_name",
      ],
      description: null,
    },
  ],
  facts: [
    {
      fact_id: "fact_2973b02945",
      table_name: "fact_host_over_loaded_tts",
      grain: "transaction",
      time_column: "created_date",
      measures: ["required_qty", "loaded_qty"],
      dimensions: [
        "bcu_number",
        "bay_number",
        "product_name",
        "truck_number",
        "compartment_number",
        "location_name",
        "zone",
        "date",
      ],
      description: "Fact table for over loaded transactions",
      lifecycle_status: "draft",
      source_type: "llm",
    },
  ],
  dimensions: [
    {
      dimension_id: "dim_317ef14fcc",
      name: "dim_date",
      keys: ["date"],
      attributes: ["year", "month", "day", "quarter"],
      description: "Date dimension",
      lifecycle_status: "draft",
      source_type: "llm",
    },
  ],
  metrics: [
    {
      metric_id: "energy_distribution__total_local_loading_quantity",
      metric_name: "total_local_loading_quantity",
      display_name: "total_local_loading_quantity",
      description: null,
      type: null,
      sql: null,
      grain: null,
      dimensions: null,
      lifecycle_status: "suggested",
      source_type: "llm",
      dataset_id: "host_local_loaded_tts",
      source_model: "host_local_loaded_tts",
    },
  ],
  ontology: {
    entities: [
      {
        entity_id: "asset",
        description: "Auto-mapped from host_local_loaded_tts.truck_number",
        lifecycle_status: "draft",
      },
    ],
    hierarchies: [
      {
        name: "zone",
        levels: [
          "sap_id",
          "bay",
          "bcu",
          "meter_number",
          "mfm_number",
          "stock_code/product_name",
        ],
        description: null,
      },
    ],
  },
};

// --- Normalization helper ---

function normalizeReviewSummary(data: unknown): ReadinessReviewSummaryData {
  const raw = (data ?? {}) as Record<string, unknown>;

  const scan = raw.scan as ReadinessReviewSummaryData["scan"] | undefined;
  const glossary = (Array.isArray(raw.glossary) ? raw.glossary : []) as any[];
  const entities = (
    Array.isArray(raw.entities) ? raw.entities : []
  ) as ReadinessReviewSummaryData["entities"];
  const hierarchies = (
    Array.isArray(raw.hierarchies) ? raw.hierarchies : []
  ) as any[];
  const facts = (
    Array.isArray(raw.facts) ? raw.facts : []
  ) as ReadinessReviewSummaryData["facts"];
  const dimensions = (
    Array.isArray(raw.dimensions) ? raw.dimensions : []
  ) as ReadinessReviewSummaryData["dimensions"];
  const metrics = (
    Array.isArray(raw.metrics) ? raw.metrics : []
  ) as ReadinessReviewSummaryData["metrics"];

  const rawOntology = raw.ontology as
    | Record<string, unknown>
    | null
    | undefined;
  const ontology: ReadinessReviewSummaryData["ontology"] = rawOntology
    ? {
        entities: Array.isArray(rawOntology.entities)
          ? rawOntology.entities
          : [],
        hierarchies: Array.isArray(rawOntology.hierarchies)
          ? rawOntology.hierarchies
          : [],
      }
    : null;

  return {
    scan: scan ?? null,
    glossary,
    entities,
    hierarchies,
    facts,
    dimensions,
    metrics,
    ontology,
  };
}

// --- Main Component ---

export default function Readiness() {
  const navigate = useNavigate();
  const {
    sourceRows,
    tenantId,
    readinessSummary,
    readinessSummaryLoaded,
    setReadinessSummary,
    isConfigView,
  } = useSemanticsStore();

  const [isLoading, setIsLoading] = useState(!readinessSummaryLoaded);
  const [summary, setSummary] = useState<ReadinessReviewSummaryData | null>(
    readinessSummary,
  );
  const isFetchingRef = useRef(false);

  // Certification dialog state
  const [certifyDialog, setCertifyDialog] = useState<{
    open: boolean;
    type: "metric" | "fact" | "dimension" | "hierarchy" | "entity" | "glossary";
    id: string;
    name: string;
  } | null>(null);
  const [isCertifying, setIsCertifying] = useState(false);

  // Certify-all dialog state
  const [certifyAllDialog, setCertifyAllDialog] = useState<{
    type: "metric" | "fact" | "dimension" | "hierarchy" | "entity" | "glossary";
    label: string;
  } | null>(null);
  const [isCertifyingAll, setIsCertifyingAll] = useState(false);

  // --- Fetch review summary ---

  const fetchSummary = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    setIsLoading(true);
    try {
      // In config view, skip sourceRows check and directly fetch with tenant_id
      if (!isConfigView) {
        const primaryRow = sourceRows[0];
        if (
          !primaryRow?.connectionId ||
          !primaryRow.database ||
          !primaryRow.schema
        ) {
          setSummary(DUMMY_SUMMARY);
          setReadinessSummary(DUMMY_SUMMARY);
          toast.info("No connection scope. Showing sample data.");
          return;
        }
      }

      const rawData = await fetchReviewSummary(tenantId);
      const data = normalizeReviewSummary(rawData);

      setSummary(data);
      setReadinessSummary(data);
    } catch (err) {
      console.error("Failed to fetch review summary:", err);
      setSummary(DUMMY_SUMMARY);
      setReadinessSummary(DUMMY_SUMMARY);
      toast.error(getDisplayErrorMessage(err, "Failed to fetch summary. Showing sample data."));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [sourceRows, tenantId, setReadinessSummary, isConfigView]);

  useEffect(() => {
    if (readinessSummaryLoaded && readinessSummary) {
      setSummary(readinessSummary);
      setIsLoading(false);
      return;
    }
    fetchSummary();
  }, [fetchSummary, readinessSummaryLoaded, readinessSummary]);

  // --- Certification handler ---

  const handleCertify = async () => {
    if (!certifyDialog) return;

    setIsCertifying(true);
    try {
      const { type, id } = certifyDialog;

      switch (type) {
        case "metric":
          await certifyMetric(tenantId, id);
          break;
        case "fact":
          await certifyFact(tenantId, id);
          break;
        case "dimension":
          await certifyDimension(tenantId, id);
          break;
        case "hierarchy":
          await certifyHierarchy(tenantId, id);
          break;
        case "entity":
          await certifyEntity(tenantId, id);
          break;
        case "glossary":
          await certifyGlossaryTerm(tenantId, id);
          break;
      }

      toast.success(
        `${type.charAt(0).toUpperCase() + type.slice(1)} certified successfully`,
      );

      // Update local state
      if (summary) {
        const updatedSummary = { ...summary };

        if (type === "metric") {
          updatedSummary.metrics = updatedSummary.metrics.map((m: any) =>
            m.metric_id === id ? { ...m, lifecycle_status: "certified" } : m,
          );
        } else if (type === "fact") {
          updatedSummary.facts = updatedSummary.facts.map((f: any) =>
            f.fact_id === id ? { ...f, lifecycle_status: "certified" } : f,
          );
        } else if (type === "dimension") {
          updatedSummary.dimensions = updatedSummary.dimensions.map((d: any) =>
            d.dimension_id === id ? { ...d, lifecycle_status: "certified" } : d,
          );
        } else if (type === "hierarchy") {
          updatedSummary.hierarchies = updatedSummary.hierarchies.map(
            (h: any) =>
              h.name === id ? { ...h, lifecycle_status: "certified" } : h,
          );
        } else if (type === "entity") {
          updatedSummary.entities = updatedSummary.entities.map((e: any) =>
            e.entity_id === id ? { ...e, lifecycle_status: "certified" } : e,
          );
        } else if (type === "glossary") {
          updatedSummary.glossary = (updatedSummary.glossary ?? []).map(
            (g: any) =>
              g.term_id === id ? { ...g, lifecycle_status: "certified" } : g,
          );
        }

        setSummary(updatedSummary);
        setReadinessSummary(updatedSummary);
      }

      setCertifyDialog(null);
    } catch (err) {
      console.error("Failed to certify:", err);
      toast.error(`Failed to certify ${certifyDialog.type}`);
    } finally {
      setIsCertifying(false);
    }
  };

  // --- Certify All handler ---

  const handleCertifyAll = async () => {
    if (!certifyAllDialog) return;

    setIsCertifyingAll(true);
    try {
      const { type } = certifyAllDialog;

      switch (type) {
        case "metric":
          await certifyAllMetrics(tenantId);
          break;
        case "fact":
          await certifyAllFacts(tenantId);
          break;
        case "dimension":
          await certifyAllDimensions(tenantId);
          break;
        case "hierarchy":
          await certifyAllHierarchies(tenantId);
          break;
        case "entity":
          await certifyAllEntities(tenantId);
          break;
        case "glossary":
          await certifyAllGlossary(tenantId);
          break;
      }

      toast.success(`All ${certifyAllDialog.label} certified successfully`);

      // Optimistic update — mark all items of this type as certified
      if (summary) {
        const updatedSummary = { ...summary };

        if (type === "metric") {
          updatedSummary.metrics = updatedSummary.metrics.map((m: any) => ({ ...m, lifecycle_status: "certified" }));
        } else if (type === "fact") {
          updatedSummary.facts = updatedSummary.facts.map((f: any) => ({ ...f, lifecycle_status: "certified" }));
        } else if (type === "dimension") {
          updatedSummary.dimensions = updatedSummary.dimensions.map((d: any) => ({ ...d, lifecycle_status: "certified" }));
        } else if (type === "hierarchy") {
          updatedSummary.hierarchies = updatedSummary.hierarchies.map((h: any) => ({ ...h, lifecycle_status: "certified" }));
        } else if (type === "entity") {
          updatedSummary.entities = updatedSummary.entities.map((e: any) => ({ ...e, lifecycle_status: "certified" }));
        } else if (type === "glossary") {
          updatedSummary.glossary = (updatedSummary.glossary ?? []).map((g: any) => ({ ...g, lifecycle_status: "certified" }));
        }

        setSummary(updatedSummary);
        setReadinessSummary(updatedSummary);
      }

      setCertifyAllDialog(null);
    } catch (err) {
      console.error("Failed to certify all:", err);
      toast.error(`Failed to certify all ${certifyAllDialog.label}`);
    } finally {
      setIsCertifyingAll(false);
    }
  };

  // --- Helpers ---

  const allCertified = (items: any[]) =>
    items.length > 0 && items.every((i) => i.lifecycle_status === "certified");

  // --- Calculate stats ---

  const getStatusCounts = <T extends { lifecycle_status?: string | null }>(
    items: T[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const s = item.lifecycle_status ?? "draft";
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  };

  const totalReadiness = summary
    ? (() => {
        const all: { lifecycle_status?: string | null }[] = [
          ...(summary.entities ?? []),
          ...(summary.facts ?? []),
          ...(summary.dimensions ?? []),
          ...(summary.metrics ?? []),
        ];
        const reviewed = all.filter((i) =>
          ["reviewed", "certified", "applied"].includes(
            i.lifecycle_status ?? "",
          ),
        ).length;
        return all.length > 0 ? Math.round((reviewed / all.length) * 100) : 0;
      })()
    : 0;

  // --- Navigate to Ask ---

  const handleProceed = () => {
    navigate("/exploratory-analysis/ask");
  };

  // --- Loading state ---

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 gap-2">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading review summary…</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle className="size-5 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load summary</p>
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-3 text-sm"
          onClick={fetchSummary}
        >
          Retry
        </Button>
      </div>
    );
  }

  // Safe accessors
  const safeGlossary = summary.glossary ?? [];
  const safeEntities = summary.entities ?? [];
  const safeHierarchies = summary.hierarchies ?? [];
  const safeFacts = summary.facts ?? [];
  const safeDimensions = summary.dimensions ?? [];
  const safeMetrics = summary.metrics ?? [];
  const scanTables = summary.scan?.tables ?? 0;
  const scanSchemaPayload = summary.scan?.schema_payload ?? null;
  const ontologyEntities = summary.ontology?.entities ?? [];
  const ontologyHierarchies = summary.ontology?.hierarchies ?? [];

  // --- Render ---

  return (
    <div className="w-full px-3 pb-3">
      {/* ── Header bar: title + stat pills on same line ── */}
      <div className="flex items-center justify-between py-3 border-b mb-3">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md flex items-center justify-center bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">
              Semantic Layer Review
            </h1>
            <p className="text-xs text-muted-foreground">
              Review onboarding artifacts before analytics
              {scanSchemaPayload?.name && (
                <span className="ml-2 inline-flex items-center gap-0.5">
                  <Database className="size-3 inline" />
                  {scanSchemaPayload.name}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Stat pills — right side of header */}
        <div className="flex items-center gap-2">
          <StatPill
            label="Tables"
            value={scanTables}
            icon={<Table2 className="size-3.5 text-slate-600" />}
            color="bg-slate-100"
          />
          <StatPill
            label="Glossary"
            value={safeGlossary.length}
            icon={<BookOpen className="size-3.5 text-indigo-600" />}
            color="bg-indigo-50"
          />
          <StatPill
            label="Entities"
            value={safeEntities.length}
            icon={<Boxes className="size-3.5 text-blue-600" />}
            color="bg-blue-50"
          />
          <StatPill
            label="Hierarchies"
            value={safeHierarchies.length}
            icon={<GitBranch className="size-3.5 text-purple-600" />}
            color="bg-purple-50"
          />
          <StatPill
            label="Facts"
            value={safeFacts.length}
            icon={<Database className="size-3.5 text-emerald-600" />}
            color="bg-emerald-50"
          />
          <StatPill
            label="Dims"
            value={safeDimensions.length}
            icon={<Grid3X3 className="size-3.5 text-orange-600" />}
            color="bg-orange-50"
          />
          <StatPill
            label="Metrics"
            value={safeMetrics.length}
            icon={<BarChart3 className="size-3.5 text-cyan-600" />}
            color="bg-cyan-50"
          />
        </div>
      </div>

      {/* ── Readiness Progress ── */}
      <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-md bg-gradient-to-r from-primary/5 to-green-500/5 border">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Overall Readiness</span>
            <span className="text-sm font-bold text-primary font-mono tabular-nums">
              {totalReadiness}%
            </span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                totalReadiness >= 80
                  ? "bg-green-500"
                  : totalReadiness >= 50
                    ? "bg-amber-500"
                    : "bg-red-400",
              )}
              style={{ width: `${totalReadiness}%` }}
            />
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {totalReadiness >= 80 ? (
            <span className="text-green-600 flex items-center gap-1 font-medium">
              <Check className="size-3.5" /> Ready
            </span>
          ) : (
            <span className="text-amber-600 flex items-center gap-1 font-medium">
              <AlertCircle className="size-3.5" /> Review needed
            </span>
          )}
        </div>
      </div>

      {/* ── Scan Schema — scanned tables ── */}
      {scanSchemaPayload && scanSchemaPayload.tables.length > 0 && (
        <div className="mb-3">
          <SectionCard
            title="Scanned Tables"
            icon={<Table2 className="size-3.5 text-primary" />}
            count={scanSchemaPayload.tables.length}
            statuses={{}}
          >
            <div className="grid grid-cols-2 gap-1">
              {scanSchemaPayload.tables.map((t) => (
                <div
                  key={t.table}
                  className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Table2 className="size-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium font-mono truncate">
                      {t.table}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-2 shrink-0">
                    <Columns3 className="size-3" />
                    {t.columns.length} cols
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Glossary — Full width ── */}
      {safeGlossary.length > 0 && (
        <div className="mb-3">
          <SectionCard
            title="Business Glossary"
            icon={<BookOpen className="size-3.5 text-primary" />}
            count={safeGlossary.length}
            statuses={getStatusCounts(safeGlossary)}
            onCertifyAll={() => setCertifyAllDialog({ type: "glossary", label: "glossary terms" })}
            isCertifyingAll={isCertifyingAll && certifyAllDialog?.type === "glossary"}
            allCertified={allCertified(safeGlossary)}
          >
            <div className="grid grid-cols-2 gap-1">
              {safeGlossary.map((g: any) => (
                <div
                  key={g.term_id}
                  className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">
                        {g.term}
                      </span>
                      {g.lifecycle_status && (
                        <StatusBadge status={g.lifecycle_status} />
                      )}
                    </div>
                    {g.definition && (
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {g.definition}
                      </div>
                    )}
                    {(g.synonyms?.length > 0 ||
                      g.abbreviations?.length > 0) && (
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        {g.synonyms?.length > 0 && (
                          <span className="truncate">
                            Synonyms: {g.synonyms.slice(0, 2).join(", ")}
                            {g.synonyms.length > 2 &&
                              ` +${g.synonyms.length - 2}`}
                          </span>
                        )}
                        {g.abbreviations?.length > 0 && (
                          <span className="font-mono">
                            {g.abbreviations.join(", ")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-2 shrink-0">
                    <CertifyButton
                      status={g.lifecycle_status}
                      onClick={() =>
                        setCertifyDialog({
                          open: true,
                          type: "glossary",
                          id: g.term_id,
                          name: g.term,
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Sections Grid — 2 columns ── */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Entities */}
        <SectionCard
          title="Entities"
          icon={<Boxes className="size-3.5 text-primary" />}
          count={safeEntities.length}
          statuses={getStatusCounts(safeEntities)}
          onCertifyAll={() => setCertifyAllDialog({ type: "entity", label: "entities" })}
          isCertifyingAll={isCertifyingAll && certifyAllDialog?.type === "entity"}
          allCertified={allCertified(safeEntities)}
        >
          <div className="space-y-1">
            {safeEntities.map((e: any) => (
              <div
                key={e.entity_id}
                className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">
                      {e.entity_id}
                    </span>
                    <StatusBadge status={e.lifecycle_status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {e.description ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {e.join_key ?? "—"}
                  </div>
                  <CertifyButton
                    status={e.lifecycle_status}
                    onClick={() =>
                      setCertifyDialog({
                        open: true,
                        type: "entity",
                        id: e.entity_id,
                        name: e.entity_id,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            {safeEntities.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3">
                No entities mapped
              </div>
            )}
          </div>
        </SectionCard>

        {/* Hierarchies */}
        <SectionCard
          title="Hierarchies"
          icon={<GitBranch className="size-3.5 text-primary" />}
          count={safeHierarchies.length}
          statuses={getStatusCounts(safeHierarchies)}
          onCertifyAll={() => setCertifyAllDialog({ type: "hierarchy", label: "hierarchies" })}
          isCertifyingAll={isCertifyingAll && certifyAllDialog?.type === "hierarchy"}
          allCertified={allCertified(safeHierarchies)}
        >
          <div className="space-y-1">
            {safeHierarchies.map((h: any) => (
              <div
                key={h.artifact_key || h.name}
                className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{h.name}</span>
                    {h.lifecycle_status && (
                      <StatusBadge status={h.lifecycle_status} />
                    )}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {(h.levels ?? []).length} levels
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {(h.levels ?? [])
                      .slice(0, 4)
                      .map((level: string, i: number) => (
                        <span
                          key={level}
                          className="text-[11px] text-muted-foreground"
                        >
                          {level}
                          {i < Math.min((h.levels ?? []).length - 1, 3) && " →"}
                        </span>
                      ))}
                    {(h.levels ?? []).length > 4 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{(h.levels ?? []).length - 4}
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  <CertifyButton
                    status={h.lifecycle_status}
                    onClick={() =>
                      setCertifyDialog({
                        open: true,
                        type: "hierarchy",
                        id: h.name,
                        name: h.name,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            {safeHierarchies.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3">
                No hierarchies defined
              </div>
            )}
          </div>
        </SectionCard>

        {/* Facts */}
        <SectionCard
          title="Facts"
          icon={<Database className="size-3.5 text-primary" />}
          count={safeFacts.length}
          statuses={getStatusCounts(safeFacts)}
          onCertifyAll={() => setCertifyAllDialog({ type: "fact", label: "facts" })}
          isCertifyingAll={isCertifyingAll && certifyAllDialog?.type === "fact"}
          allCertified={allCertified(safeFacts)}
        >
          <div className="space-y-1">
            {safeFacts.map((f: any) => (
              <div
                key={f.fact_id}
                className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium font-mono">
                      {f.table_name}
                    </span>
                    <StatusBadge status={f.lifecycle_status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    <span>Grain: {f.grain ?? "—"}</span>
                    <span>Time: {f.time_column ?? "—"}</span>
                    {f.measures?.length > 0 && (
                      <span>{f.measures.length} measures</span>
                    )}
                    {f.dimensions?.length > 0 && (
                      <span>{f.dimensions.length} dims</span>
                    )}
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  <CertifyButton
                    status={f.lifecycle_status}
                    onClick={() =>
                      setCertifyDialog({
                        open: true,
                        type: "fact",
                        id: f.fact_id,
                        name: f.table_name,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            {safeFacts.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3">
                No facts defined
              </div>
            )}
          </div>
        </SectionCard>

        {/* Dimensions */}
        <SectionCard
          title="Dimensions"
          icon={<Grid3X3 className="size-3.5 text-primary" />}
          count={safeDimensions.length}
          statuses={getStatusCounts(safeDimensions)}
          onCertifyAll={() => setCertifyAllDialog({ type: "dimension", label: "dimensions" })}
          isCertifyingAll={isCertifyingAll && certifyAllDialog?.type === "dimension"}
          allCertified={allCertified(safeDimensions)}
        >
          <div className="space-y-1">
            {safeDimensions.map((d: any) => (
              <div
                key={d.dimension_id}
                className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium font-mono">
                      {d.name}
                    </span>
                    <StatusBadge status={d.lifecycle_status} />
                  </div>
                  {d.keys?.length > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Keys: {d.keys.join(", ")}
                    </div>
                  )}
                  {d.attributes?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {d.attributes.slice(0, 3).map((attr: string) => (
                        <span
                          key={attr}
                          className="text-[11px] px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600"
                        >
                          {attr}
                        </span>
                      ))}
                      {d.attributes.length > 3 && (
                        <span className="text-[11px] text-muted-foreground">
                          +{d.attributes.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="ml-2 shrink-0 self-start mt-0.5">
                  <CertifyButton
                    status={d.lifecycle_status}
                    onClick={() =>
                      setCertifyDialog({
                        open: true,
                        type: "dimension",
                        id: d.dimension_id,
                        name: d.name,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            {safeDimensions.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-3">
                No dimensions defined
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Metrics — Full width ── */}
      <div className="mb-3">
        <SectionCard
          title="Metrics"
          icon={<BarChart3 className="size-3.5 text-primary" />}
          count={safeMetrics.length}
          statuses={getStatusCounts(safeMetrics)}
          onCertifyAll={() => setCertifyAllDialog({ type: "metric", label: "metrics" })}
          isCertifyingAll={isCertifyingAll && certifyAllDialog?.type === "metric"}
          allCertified={allCertified(safeMetrics)}
        >
          <div className="grid grid-cols-2 gap-1">
            {safeMetrics.map((m: any) => (
              <div
                key={m.metric_id}
                className="group flex items-center justify-between px-2 py-1.5 rounded-sm bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">
                      {m.display_name ?? m.metric_name}
                    </span>
                    <StatusBadge status={m.lifecycle_status} />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                    {m.type && (
                      <span className="flex items-center gap-0.5">
                        <FileCode2 className="size-3" />
                        {m.type}
                      </span>
                    )}
                    {m.sql && (
                      <span className="font-mono truncate max-w-[140px]">
                        {m.sql}
                      </span>
                    )}
                    {m.source_model && (
                      <span className="truncate">src: {m.source_model}</span>
                    )}
                  </div>
                </div>
                <div className="ml-2 shrink-0">
                  <CertifyButton
                    status={m.lifecycle_status}
                    onClick={() =>
                      setCertifyDialog({
                        open: true,
                        type: "metric",
                        id: m.metric_id,
                        name: m.display_name ?? m.metric_name,
                      })
                    }
                  />
                </div>
              </div>
            ))}
            {safeMetrics.length === 0 && (
              <div className="col-span-2 text-xs text-muted-foreground text-center py-3">
                No metrics defined
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Ontology Status ── */}
      <div className="px-3 py-2 rounded-md border bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-sm flex items-center justify-center bg-purple-100 dark:bg-purple-900/50">
              <Layers className="size-3.5 text-purple-600" />
            </div>
            <span className="text-sm font-semibold">Domain Ontology</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">
              {ontologyEntities.length} entities
            </span>
            <span className="font-mono tabular-nums">
              {ontologyHierarchies.length} hierarchies
            </span>
          </div>
        </div>
      </div>

      {/* ── Proceed Button ── */}
      <div className="flex justify-center">
        <Button
          onClick={handleProceed}
          className="h-8 px-5 gap-2 text-sm bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90"
        >
          <MessageCircleMore className="size-4" />
          Proceed to Analytics
          <ArrowRight className="size-3.5" />
        </Button>
      </div>

      {/* ── Certification Confirmation Dialog (single) ── */}
      <AlertDialog
        open={!!certifyDialog}
        onOpenChange={(open) => !open && setCertifyDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-primary" />
              Certify {certifyDialog?.type}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to certify{" "}
              <span className="font-semibold text-foreground">
                {certifyDialog?.name}
              </span>
              ?
              <br />
              <br />
              This will mark it as approved and ready for use in analytics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCertifying}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCertify}
              disabled={isCertifying}
              className="bg-primary hover:bg-primary/90"
            >
              {isCertifying ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Certifying...
                </>
              ) : (
                <>
                  <Award className="size-4 mr-2" />
                  Certify
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Certify All Confirmation Dialog ── */}
      <AlertDialog
        open={!!certifyAllDialog}
        onOpenChange={(open) => !open && setCertifyAllDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-primary" />
              Certify all {certifyAllDialog?.label}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to certify{" "}
              <span className="font-semibold text-foreground">
                all {certifyAllDialog?.label}
              </span>
              ?
              <br />
              <br />
              This will mark every item as approved and ready for use in analytics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCertifyingAll}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCertifyAll}
              disabled={isCertifyingAll}
              className="bg-primary hover:bg-primary/90"
            >
              {isCertifyingAll ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Certifying...
                </>
              ) : (
                <>
                  <Award className="size-4 mr-2" />
                  Certify All
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
