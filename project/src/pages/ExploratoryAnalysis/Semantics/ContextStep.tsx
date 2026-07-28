import { useState, useRef, useEffect, useCallback } from "react";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlternativeSelect } from "@/components/ui/alternative-select";
import { MultiSelectCombobox } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import {
  Paperclip,
  X,
  FileText,
  Loader2,
  Check,
  Plus,
  Sparkles,
  Bold,
  Italic,
  List,
  Link,
  GitBranch,
  BarChart3,
  HelpCircle,
  Lightbulb,
  ChevronRight,
  ChevronDown,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { apiV2 } from "@/controllers/API/api";
import { fetchContextExtractions } from "@/controllers/API/semanticsApi";
import { useSemanticsStore, ContextSourceState } from "@/stores/semanticsStore";
import { cn } from "@/lib/utils";

const SOURCE_TYPES = [
  { value: "business_context", label: "Business Context" },
  { value: "data_dictionary", label: "Data Dictionary" },
  { value: "glossary", label: "Glossary" },
  { value: "business_rules", label: "Business Rules" },
  { value: "documentation", label: "Documentation" },
];

// --- Collapsible AI Insight Card ---

function InsightCard({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-border/60 bg-background overflow-hidden hover:shadow-sm transition-shadow">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className={cn(
            "size-7 rounded-md flex items-center justify-center shrink-0",
            iconBg,
          )}
        >
          <span className={iconColor}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-foreground">{title}</div>
          <div className="text-[10px] text-muted-foreground">{subtitle}</div>
        </div>
        <ChevronDown
          className={cn(
            "size-3.5 text-muted-foreground shrink-0 transition-transform",
            !expanded && "-rotate-90",
          )}
        />
      </button>
      {expanded && <div className="px-2.5 pb-2.5">{children}</div>}
    </div>
  );
}

// --- AI Insights Sidebar Panel ---

function AIInsightsPanel({
  extractions,
  applied,
  isExtracted,
  isApplying,
  onApply,
}: {
  extractions: any;
  applied: boolean;
  isExtracted: boolean;
  isApplying: boolean;
  onApply: () => void;
}) {
  const hierarchies = extractions?.hierarchies ?? [];
  const metrics = extractions?.metric_candidates ?? [];
  const questions = extractions?.question_intents ?? [];
  const abbreviations = extractions?.abbreviations ?? [];
  const synonyms = extractions?.synonyms ?? [];

  const hasAny =
    hierarchies.length > 0 ||
    metrics.length > 0 ||
    questions.length > 0 ||
    abbreviations.length > 0 ||
    synonyms.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-foreground">AI Insights</h2>
        </div>
        {applied && (
          <Badge className="px-2 py-0.5 text-[11px] font-medium rounded-sm bg-blue-50 text-blue-700 border-blue-200">
            REFINED
          </Badge>
        )}
      </div>

      {/* Scrollable insights area */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
        {!hasAny ? (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/30 px-4 py-6 text-center">
            <Sparkles className="size-4 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              AI insights will appear here after you submit and extract context.
            </p>
          </div>
        ) : (
          <>
            {/* Hierarchies Card */}
            {hierarchies.length > 0 && (
              <InsightCard
                icon={<GitBranch className="size-3.5" />}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
                title="Hierarchies"
                subtitle={`${hierarchies.length} items detected`}
              >
                <div className="space-y-2">
                  {hierarchies.map((h: any, i: number) => (
                    <div key={i}>
                      <div className="text-[11px] font-medium uppercase tracking-wide text-blue-600 mb-1">
                        {h.name || `Hierarchy ${i + 1}`}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {h.levels?.map((level: string, j: number) => (
                          <div key={j} className="flex items-center gap-1">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted/60 text-foreground font-medium">
                              {level}
                            </span>
                            {j < h.levels.length - 1 && (
                              <ChevronRight className="size-3 text-muted-foreground/50" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </InsightCard>
            )}

            {/* Metrics Card */}
            {metrics.length > 0 && (
              <InsightCard
                icon={<BarChart3 className="size-3.5" />}
                iconBg="bg-orange-50"
                iconColor="text-orange-600"
                title="Metrics"
                subtitle={`${metrics.length} metrics found`}
              >
                <div className="space-y-1">
                  {metrics.map((m: any, i: number) => (
                    <div key={i} className="text-xs text-foreground/80 py-0.5">
                      {m.metric_name}
                    </div>
                  ))}
                </div>
              </InsightCard>
            )}

            {/* Key Questions Card */}
            {questions.length > 0 && (
              <InsightCard
                icon={<HelpCircle className="size-3.5" />}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
                title="Key Questions"
                subtitle="AI Suggested"
              >
                <div className="space-y-1.5">
                  {questions.map((q: any, i: number) => (
                    <div
                      key={i}
                      className="text-xs italic text-foreground/70 border-l-2 border-blue-300 pl-2 py-0.5"
                    >
                      "{q.question}"
                    </div>
                  ))}
                </div>
              </InsightCard>
            )}

            {/* Abbreviations */}
            {abbreviations.length > 0 && (
              <InsightCard
                icon={<span className="text-[11px] font-semibold">Ab</span>}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
                title="Abbreviations"
                subtitle={`${abbreviations.length} found`}
                defaultOpen={false}
              >
                <div className="space-y-1">
                  {abbreviations.map((a: any, i: number) => (
                    <div key={i} className="text-xs text-foreground/80">
                      <span className="font-semibold">{a.abbr}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {a.definition}
                      </span>
                    </div>
                  ))}
                </div>
              </InsightCard>
            )}

            {/* Synonyms */}
            {synonyms.length > 0 && (
              <InsightCard
                icon={<span className="text-[11px] font-semibold">Sy</span>}
                iconBg="bg-green-50"
                iconColor="text-green-600"
                title="Synonyms"
                subtitle={`${synonyms.length} found`}
                defaultOpen={false}
              >
                <div className="space-y-1">
                  {synonyms.map((s: any, i: number) => (
                    <div key={i} className="text-xs text-foreground/80">
                      <span className="font-semibold">{s.term}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        → {s.synonyms?.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              </InsightCard>
            )}
          </>
        )}
      </div>

      {/* Bottom info note */}
      <div className="flex items-start gap-2 rounded-md bg-blue-50/60 border border-blue-100 px-3 py-2 mt-2 shrink-0">
        <Lightbulb className="size-3.5 text-blue-500 mt-0.5 shrink-0" />
        <p className="text-[11px] text-blue-700 leading-relaxed">
          AI insights update automatically as you refine the business context
          description.
        </p>
      </div>

      {/* Apply button - separated below insights */}
      {isExtracted && (
        <div className="mt-2 shrink-0">
          <Button
            size="sm"
            onClick={onApply}
            disabled={isApplying || applied}
            className={cn(
              "w-full h-8 text-xs gap-1.5",
              applied
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white",
            )}
          >
            {isApplying ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Applying...
              </>
            ) : applied ? (
              <>
                <Check className="size-3.5" />
                Applied
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Apply Insights
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- Context Source Form (per tab) ---

interface ContextSourceFormProps {
  source: ContextSourceState;
  tenantId: string;
  onUpdate: (updates: Partial<ContextSourceState>) => void;
  isConfigView?: boolean;
}

function ContextSourceForm({
  source,
  tenantId,
  onUpdate,
  isConfigView = false,
}: ContextSourceFormProps) {
  // API action states
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSubmitted = !!source.contextId;
  const isExtracted = !!source.extractions;

  // Build options from the schema step data already in the source
  const connectionOptions = source.connectionId
    ? [
        {
          label: source.connectionName || source.connectionId,
          value: source.connectionId,
        },
      ]
    : [];
  const databaseOptions = source.database
    ? [{ label: source.database, value: source.database }]
    : [];
  const schemaOptions = source.schema
    ? [{ label: source.schema, value: source.schema }]
    : [];
  const tableOptions = source.selectedTables.map((t) => ({
    label: String(t),
    value: String(t),
  }));

  // --- File upload (ingest-file) ---

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("tenant_id", tenantId);
      formData.append("source_type", source.sourceType || "business_context");
      if (source.sourceTitle)
        formData.append("source_title", source.sourceTitle);
      formData.append("metadata", JSON.stringify({}));
      formData.append("file", file);

      const res = await apiV2.post("/context/ingest-file", formData, {
        headers: { "Content-Type": undefined as unknown as string },
      });

      onUpdate({
        files: [
          ...source.files,
          { file_id: res.data.file_id, file_name: file.name },
        ],
      });
      toast.success(`File "${file.name}" uploaded`);
    } catch (err) {
      console.error("File upload failed:", err);
      toast.error(getDisplayErrorMessage(err, "File upload failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (fileId: string) => {
    onUpdate({ files: source.files.filter((f) => f.file_id !== fileId) });
  };

  // --- Submit (ingest) ---

  const handleSubmit = async () => {
    if (!source.sourceTitle.trim()) {
      toast.error("Please enter a source title");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        tenant_id: tenantId,
        source_type: source.sourceType || "business_context",
        source_title: source.sourceTitle,
        raw_text: source.rawText,
        file_ids: source.files.map((f) => f.file_id),
      };
      const res = await apiV2.post("/context/ingest", payload);
      onUpdate({
        contextId: res.data.context_id,
        extractionId: null,
        extractions: null,
        applied: false,
      });
      toast.success("Context submitted");
    } catch (err) {
      console.error("Submit failed:", err);
      toast.error(getDisplayErrorMessage(err, "Context submission failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Extract ---

  const handleExtract = async () => {
    if (!source.contextId) return;
    setIsExtracting(true);
    try {
      const res = await apiV2.post("/context/extract", {
        tenant_id: tenantId,
        context_id: source.contextId,
        extraction_types: [
          "abbreviations",
          "synonyms",
          "hierarchies",
          "metric_candidates",
          "question_intents",
        ],
      });
      onUpdate({
        extractionId: res.data.extraction_id,
        extractions: res.data.extractions,
      });
      toast.success("Extraction completed");
    } catch (err) {
      console.error("Extract failed:", err);
      toast.error(getDisplayErrorMessage(err, "Extraction failed"));
    } finally {
      setIsExtracting(false);
    }
  };

  // --- Apply ---

  const handleApply = async () => {
    if (!source.extractionId) return;
    setIsApplying(true);
    try {
      const res = await apiV2.post("/context/apply", {
        tenant_id: tenantId,
        extraction_id: source.extractionId,
        apply: {
          entities: true,
          hierarchies: true,
          glossary: true,
          metrics: true,
        },
      });
      onUpdate({ applied: true });
      setApplyResult(res.data.updated);
      toast.success("Context applied");
    } catch (err) {
      console.error("Apply failed:", err);
      toast.error(getDisplayErrorMessage(err, "Failed to apply context"));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="grid grid-cols-[1fr_280px] gap-3 h-full min-h-0">
      {/* ===== LEFT COLUMN: Form ===== */}
      <div className="rounded-lg border border-border/60 bg-background flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
          {/* Row 1: Connection + Source Title + Source Type */}
          <div className="grid grid-cols-[450px_1fr_325px] gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Source Title
              </label>
              <Input
                value={source.sourceTitle}
                onChange={(e) => onUpdate({ sourceTitle: e.target.value })}
                placeholder="e.g. Local & OverLoaded"
                className="h-10 text-sm border-slate-200 bg-slate-50/80"
                disabled={isConfigView}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Source Type
              </label>
              <Select
                value={source.sourceType}
                onValueChange={(val) => onUpdate({ sourceType: val })}
              >
                <SelectTrigger className="h-10! w-full text-sm border-slate-200 bg-slate-50/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem
                      key={t.value}
                      value={t.value}
                      className="text-sm"
                    >
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Connection
              </label>
              <AlternativeSelect
                options={connectionOptions}
                value={source.connectionId || undefined}
                onChange={() => {}}
                placeholder="No connection"
                disabled
                className="h-9 bg-slate-50/80 border-slate-200"
              />
            </div>
          </div>

          {/* Row 2: Database + Schema + Tables (from schema step, disabled) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Database
              </label>
              <AlternativeSelect
                options={databaseOptions}
                value={source.database || undefined}
                onChange={() => {}}
                placeholder="No database"
                disabled
                className="h-9 bg-slate-50/80 border-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Schema
              </label>
              <AlternativeSelect
                options={schemaOptions}
                value={source.schema || undefined}
                onChange={() => {}}
                placeholder="No schema"
                disabled
                className="h-9 bg-slate-50/80 border-slate-200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tables
              </label>
              <MultiSelectCombobox
                options={tableOptions}
                value={source.selectedTables.map(String)}
                onChange={(_v) => {}}
                placeholder="No tables"
                disabled
                className="h-9 bg-slate-50/80 border-slate-200"
              />
            </div>
          </div>

          {/* Context Description with toolbar */}
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Context Description
            </label>
            <div className="rounded-md border border-slate-200 bg-slate-50/80 overflow-hidden">
              {/* Mini toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-200/60 bg-slate-100/50">
                <button
                  type="button"
                  className="size-7 flex items-center justify-center rounded hover:bg-slate-200/60 transition-colors text-muted-foreground hover:text-foreground"
                  title="Bold"
                >
                  <Bold className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="size-7 flex items-center justify-center rounded hover:bg-slate-200/60 transition-colors text-muted-foreground hover:text-foreground"
                  title="Italic"
                >
                  <Italic className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="size-7 flex items-center justify-center rounded hover:bg-slate-200/60 transition-colors text-muted-foreground hover:text-foreground"
                  title="List"
                >
                  <List className="size-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 mx-1" />
                <button
                  type="button"
                  className="size-7 flex items-center justify-center rounded hover:bg-slate-200/60 transition-colors text-muted-foreground hover:text-foreground"
                  title="Link"
                >
                  <Link className="size-3.5" />
                </button>
              </div>
              <textarea
                value={source.rawText}
                onChange={(e) => onUpdate({ rawText: e.target.value })}
                placeholder="Describe the business domain, terminology, and specific rules for this data source..."
                rows={5}
                className="w-full px-3 py-2 text-sm bg-transparent focus:outline-none resize-y overflow-y-auto placeholder:text-muted-foreground/60"
                style={{ minHeight: "100px", maxHeight: "200px" }}
                disabled={isConfigView}
              />
            </div>
          </div>

          {/* Reference Documents */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reference Documents
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {!isConfigView && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.docx,.xlsx,.xls,.doc"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        Array.from(files).forEach((file) =>
                          handleFileUpload(file),
                        );
                        e.target.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="h-7 px-3 text-xs border-dashed border-border gap-1.5 hover:bg-muted/40"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Paperclip className="size-3.5" />
                        Upload More (Max 10MB)
                      </>
                    )}
                  </Button>
                </>
              )}
              {source.files.map((f) => (
                <div
                  key={f.file_id}
                  className="flex items-center gap-1.5 pl-2 pr-1 py-1 bg-blue-50 border border-blue-200 rounded-md group hover:bg-blue-100/80 transition-colors"
                >
                  <FileText className="size-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs text-blue-800 truncate max-w-[160px]">
                    {f.file_name}
                  </span>
                  {!isConfigView && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(f.file_id)}
                      className="hover:bg-blue-200 rounded p-0.5 transition-colors"
                      title="Remove file"
                    >
                      <X className="size-3 text-blue-500 hover:text-red-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Applied result banner */}
          {source.applied && applyResult && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-md border border-emerald-200">
              <Check className="size-3.5 shrink-0" />
              Updated: {applyResult.entities ?? 0} entities,{" "}
              {applyResult.hierarchies ?? 0} hierarchies,{" "}
              {applyResult.metrics ?? 0} metrics
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        {!isConfigView && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/10">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Save className="size-3 text-amber-500" />
              Auto-saving changes...
            </div>
            <div className="flex items-center gap-2">
              {/* Extract / Preview AI Analysis */}
              {isSubmitted && !isExtracted && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5" />
                      Preview AI Analysis
                    </>
                  )}
                </Button>
              )}

              {/* Submit Context */}
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !source.sourceTitle.trim()}
                className="h-7 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : isSubmitted ? (
                  <>
                    <Check className="size-3.5" />
                    Submitted
                  </>
                ) : (
                  "Submit Context"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===== RIGHT COLUMN: AI Insights (scrollable, contained) ===== */}
      <div className="min-h-0 overflow-hidden flex flex-col">
        <AIInsightsPanel
          extractions={source.extractions}
          applied={source.applied}
          isExtracted={isExtracted}
          isApplying={isApplying}
          onApply={handleApply}
        />
      </div>
    </div>
  );
}

// --- Main Component ---

export default function ContextStep({ onNext }: { onNext: () => void }) {
  const {
    contextSources,
    initContextSources,
    addContextSource,
    removeContextSource,
    updateContextSource,
    tenantId,
    isConfigView,
  } = useSemanticsStore();

  const [activeTab, setActiveTab] = useState(0);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  // In config view, fetch existing extractions and populate context sources
  const loadConfigData = useCallback(async () => {
    if (!isConfigView || !tenantId) return;
    setIsLoadingConfig(true);
    try {
      const data = await fetchContextExtractions(tenantId);
      if (
        data?.extractions &&
        Array.isArray(data.extractions) &&
        data.extractions.length > 0
      ) {
        // Build context sources from each extraction
        const sources: ContextSourceState[] = data.extractions.map(
          (ext, idx) => ({
            id: `cfg-ctx-${idx}`,
            connectionId: "",
            connectionName: "",
            database: "",
            schema: "",
            selectedTables: [],
            sourceTitle:
              ext.files?.[0]?.metadata?.source_title || `Source ${idx + 1}`,
            sourceType:
              ext.files?.[0]?.metadata?.source_type || "business_context",
            rawText: ext.raw_text || "",
            files: (ext.files || []).map((f) => ({
              file_id: f.file_id,
              file_name: f.filename,
            })),
            contextId: ext.context_id || null,
            extractionId: ext.extraction_id || null,
            extractions: ext.payload || null,
            applied: true,
          }),
        );
        // Replace contextSources in the store — we set them directly
        useSemanticsStore.setState({ contextSources: sources });
      }
    } catch (err) {
      console.error("Failed to load context extractions:", err);
    } finally {
      setIsLoadingConfig(false);
    }
  }, [isConfigView, tenantId]);

  useEffect(() => {
    if (isConfigView) {
      loadConfigData();
    } else {
      initContextSources();
    }
  }, [isConfigView, loadConfigData, initContextSources]);

  const handleAddSource = () => {
    addContextSource();
    setActiveTab(contextSources.length);
  };

  const handleRemoveSource = (id: string, idx: number) => {
    removeContextSource(id);
    if (activeTab >= idx && activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  };

  const activeSource = contextSources[activeTab];

  return (
    <div className="w-full h-full flex flex-col px-4 py-3 min-h-0 overflow-hidden">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3 shrink-0">
        <div>
          <h1 className="text-[16px] font-semibold text-foreground tracking-tight">
            Business Context
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Provide domain-specific details to enhance AI interpretation.
          </p>
        </div>
        {/* <Button
          variant="outline"
          size="sm"
          onClick={handleAddSource}
          className="h-7 px-3 text-xs gap-1.5 shrink-0"
        >
          <Plus className="size-3.5" />
          New Source
        </Button> */}
      </div>

      {/* Source Tabs */}
      {contextSources.length > 1 && (
        <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-0.5 shrink-0">
          {contextSources.map((source, idx) => (
            <button
              key={source.id}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all shrink-0 border",
                activeTab === idx
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-background text-foreground/70 border-border/60 hover:bg-muted/50",
              )}
            >
              <span className="truncate max-w-[140px]">
                {source.sourceTitle || `Source ${idx + 1}`}
              </span>
              {source.applied && <Check className="size-3 shrink-0" />}
              {contextSources.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveSource(source.id, idx);
                  }}
                  className={cn(
                    "ml-0.5 rounded p-0.5 transition-colors",
                    activeTab === idx ? "hover:bg-blue-700" : "hover:bg-muted",
                  )}
                >
                  <X className="size-3" />
                </button>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Active Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoadingConfig ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-blue-600 mr-2" />
            <span className="text-sm text-muted-foreground">
              Loading context configuration...
            </span>
          </div>
        ) : activeSource ? (
          <ContextSourceForm
            key={activeSource.id}
            source={activeSource}
            tenantId={tenantId}
            onUpdate={(updates) =>
              updateContextSource(activeSource.id, updates)
            }
            isConfigView={isConfigView}
          />
        ) : (
          <div className="text-center py-10 text-xs text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/50">
            No sources configured. Click "+ New Source" to get started.
          </div>
        )}
      </div>

      {/* Next Step */}
      <div className="mt-3 flex justify-end shrink-0">
        <Button
          onClick={onNext}
          className="!h-8 px-5 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
        >
          Next Step
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
