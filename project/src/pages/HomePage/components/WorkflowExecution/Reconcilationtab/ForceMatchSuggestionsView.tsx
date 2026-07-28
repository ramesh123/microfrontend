"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, Eye, Lightbulb, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ShadTooltip from "@/components/ui/shadTooltipComponent";
import { toast } from "sonner";
import {
  downloadForceMatchSuggestionFile,
  performReconciliationAction,
  getForceMatchSuggestions,
  viewForceMatchSuggestionData,
  type ForceMatchSuggestionItem,
  type ForceMatchSuggestionsResponse,
} from "@/controllers/API/ReconcilationAPI";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import { TbGitMerge } from "react-icons/tb";
import { AgGridReact } from "ag-grid-react";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

ModuleRegistry.registerModules([AllCommunityModule]);


type ForceMatchSuggestionsViewProps = {
  flowId: string;
  stmtDate?: string;
  cycleNumber?: string;
  flowRunId?: string;
  executionNumber?: string;
  onBack: () => void;
};

function countPerfectSuggestions(items: ForceMatchSuggestionItem[]): number {
  return items.filter((item) => item.can_force_match !== false).length;
}

function countSuggestionsWithAmountDifferences(items: ForceMatchSuggestionItem[]): number {
  return items.filter((item) => /amount difference/i.test(item.not_matched_reason || "")).length;
}

function countSuggestionsWithFormattingOnly(items: ForceMatchSuggestionItem[]): number {
  return items.filter((item) => !/amount difference/i.test(item.not_matched_reason || "")).length;
}

function buildRecordsFromSystemRefIds(systemRefIds?: Record<string, string[]>): Array<Record<string, string[]>> {
  if (!systemRefIds) return [];

  return Object.entries(systemRefIds)
    .map(([source, ids]) => ({
      [source]: Array.from(new Set((ids || []).filter(Boolean))),
    }))
    .filter((record) => Object.values(record)[0].length > 0);
}

function formatSystemRefIdLabel(source: string, ids: string[]): string {
  const count = ids.length;
  return `${source} (${count} record${count === 1 ? "" : "s"})`;
}

function SuggestionCard({
  suggestion,
  index,
  onForceMatchClick,
  onDownloadClick,
  downloading,
  onViewClick,
}: {
  suggestion: ForceMatchSuggestionItem;
  index: number;
  onForceMatchClick: (suggestion: ForceMatchSuggestionItem) => void;
  onDownloadClick: (suggestion: ForceMatchSuggestionItem) => void;
  downloading: boolean;
  onViewClick: (suggestion: ForceMatchSuggestionItem) => void;
}) {
  return (
    <Card className="border-border/70 shadow-sm py-3 px-2">
      <CardHeader className="space-y-1 pb-0 px-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">
              Suggestion {index + 1}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={suggestion.can_force_match ? "default" : "secondary"}>
                {suggestion.download?.record_count ?? 0} records
              </Badge>
              {suggestion.suggestion_status ? (
                <Badge variant="outline">{suggestion.suggestion_status}</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hover:text-primary"
              onClick={() => {
                onViewClick(suggestion);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>

            <ShadTooltip content="Download suggestion file">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 hover:text-primary"
                disabled={downloading}
                onClick={() => {
                  onDownloadClick(suggestion);
                }}
              >
                <Download className="h-4 w-4" />
                {/* {downloading ? "Downloading..." : "Download"} */}
              </Button>
            </ShadTooltip>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {suggestion.not_matched_reason}
        </p>
      </CardHeader>

      <CardContent className="space-y-2 pt-0 px-2">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(suggestion.download?.source_sheets ?? []).map((sheet) => (
            <div key={`${suggestion.suggestion_id}-${sheet.sheet_name}`} className="rounded-lg border bg-muted/30 p-3">
              <div className="text-sm font-medium">{sheet.source}</div>
              {/* <div className="text-xs text-muted-foreground">{sheet.sheet_name}</div> */}
              <div className="mt-0 text-sm">
                <span className="">RecordsCount:{sheet.record_count}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0 px-2 justify-end">
        <Button
          type="button"
          className="!h-7 !px-3"
          disabled={suggestion.can_force_match === false || buildRecordsFromSystemRefIds(suggestion.system_ref_ids).length === 0}
          onClick={() => onForceMatchClick(suggestion)}
        >
          Forcematch
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ForceMatchSuggestionsView({
  flowId,
  stmtDate,
  cycleNumber,
  flowRunId,
  executionNumber,
  onBack,
}: ForceMatchSuggestionsViewProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ForceMatchSuggestionsResponse | null>(null);
  const [suggestions, setSuggestions] = useState<ForceMatchSuggestionItem[]>([]);
  const [forceMatchDialogOpen, setForceMatchDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<ForceMatchSuggestionItem | null>(null);
  const [forceMatchComment, setForceMatchComment] = useState("");
  const [forceMatchSubmitting, setForceMatchSubmitting] = useState(false);
  const [downloadingSuggestionId, setDownloadingSuggestionId] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewDialogLoading, setViewDialogLoading] = useState(false);
  const [viewDialogData, setViewDialogData] = useState<
    Array<{
      sheetName: string;
      source: string;
      columns: string[];
      data: any[];
    }>
  >([]);
  const [selectedViewSuggestion, setSelectedViewSuggestion] = useState<ForceMatchSuggestionItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("");

  const handleViewSuggestion = useCallback(async (suggestion: ForceMatchSuggestionItem) => {
    if (!suggestion.download) {
      toast.error("No download information was returned for this suggestion.");
      return;
    }
    const { encrypted_file_key, source_sheets } = suggestion.download;
    if (!encrypted_file_key) {
      toast.error("Encrypted file key is missing for this suggestion.");
      return;
    }
    if (!source_sheets || source_sheets.length === 0) {
      toast.error("No source sheets found for this suggestion.");
      return;
    }

    setSelectedViewSuggestion(suggestion);
    setViewDialogOpen(true);
    setViewDialogLoading(true);
    setViewDialogData([]);

    try {
      const promises = source_sheets.map(async (sheet) => {
        const res = await viewForceMatchSuggestionData({
          encrypted_file_key,
          sheet_name: sheet.sheet_name,
          type: "local",
          file_type: "excel",
        });
        return {
          sheetName: sheet.sheet_name,
          source: sheet.source,
          columns: res.columns || [],
          data: res.data || [],
        };
      });

      const results = await Promise.all(promises);
      setViewDialogData(results);
      if (results.length > 0) {
        setActiveTab(results[0].sheetName);
      }
    } catch (error) {
      console.error("Failed to load sheet data:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load sheet data"));
      setViewDialogOpen(false);
    } finally {
      setViewDialogLoading(false);
    }
  }, []);

  const payload = useMemo(
    () => ({
      flow_id: flowId,
      stmt_date: stmtDate || "",
      flow_run_id: flowRunId || "",
      execution_number: executionNumber || "",
      cycle_number: cycleNumber || "",
    }),
    [flowId, stmtDate, cycleNumber, flowRunId, executionNumber],
  );

  const selectedSuggestionRecords = useMemo(
    () => buildRecordsFromSystemRefIds(selectedSuggestion?.system_ref_ids),
    [selectedSuggestion],
  );

  const selectedSuggestionRecordCount = useMemo(
    () => selectedSuggestionRecords.reduce(
      (count, record) => count + Object.values(record)[0].length,
      0,
    ),
    [selectedSuggestionRecords],
  );

  const loadSuggestions = useCallback(async () => {
    if (!flowId) {
      toast.error("Flow ID is missing. Please select a workflow first.");
      return;
    }

    setLoading(true);
    try {
      const raw = await getForceMatchSuggestions(payload);
      const body = raw && typeof raw === "object" ? raw : null;
      const data = Array.isArray(body?.data) ? body.data : [];
      setResponse(body);
      setSuggestions(data);
    } catch (error) {
      console.error("Failed to load force match suggestions:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to load force match suggestions"));
      setResponse(null);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [flowId, payload]);

  const openForceMatchDialog = useCallback((suggestion: ForceMatchSuggestionItem) => {
    const records = buildRecordsFromSystemRefIds(suggestion.system_ref_ids);
    if (records.length === 0) {
      toast.error("No system reference IDs were returned for this suggestion.");
      return;
    }

    setSelectedSuggestion(suggestion);
    setForceMatchComment("");
    setForceMatchDialogOpen(true);
  }, []);

  const handleDownloadSuggestion = useCallback(async (suggestion: ForceMatchSuggestionItem) => {
    if (!suggestion.download) {
      toast.error("No download information was returned for this suggestion.");
      return;
    }

    setDownloadingSuggestionId(suggestion.suggestion_id);
    try {
      await downloadForceMatchSuggestionFile(suggestion.download);
    } catch (error) {
      console.error("Failed to download suggestion file:", error);
    } finally {
      setDownloadingSuggestionId(null);
    }
  }, []);

  const confirmForceMatch = useCallback(async () => {
    if (!selectedSuggestion) return;

    const records = buildRecordsFromSystemRefIds(selectedSuggestion.system_ref_ids);
    if (records.length === 0) {
      toast.error("No system reference IDs were returned for this suggestion.");
      return;
    }

    setForceMatchSubmitting(true);
    try {
      const result = await performReconciliationAction("force_match", {
        flow_id: flowId,
        operation: "unmatched",
        comments: forceMatchComment.trim(),
        stmt_date: stmtDate || "",
        cycle_number: cycleNumber || undefined,
        records,
      });

      const succeeded = result?.status !== false;
      const message =
        (typeof result?.message === "string" && result.message.trim()) ||
        (succeeded ? "Force match completed successfully" : "Force match failed");

      if (succeeded) {
        toast.success(message);
        setForceMatchDialogOpen(false);
        setSelectedSuggestion(null);
        setForceMatchComment("");
        await loadSuggestions();
      } else {
        toast.info(message);
      }
    } catch (error) {
      console.error("Failed to force match records:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to force match records"));
    } finally {
      setForceMatchSubmitting(false);
    }
  }, [cycleNumber, flowId, forceMatchComment, loadSuggestions, selectedSuggestion, stmtDate]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  const totalMatches = suggestions.length;
  const perfectMatches = countPerfectSuggestions(suggestions);
  const amountDifferences = countSuggestionsWithAmountDifferences(suggestions);
  const formattingOnly = countSuggestionsWithFormattingOnly(suggestions);

  return (
    <div className="min-h-full w-full bg-background p-2">
      <div className="mx-auto flex w-full max-w-9xl flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" className="text-sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <TbGitMerge className="h-6 w-6 text-primary" />
              <h1 className="text-[16px] font-semibold text-foreground">Force Match Results</h1>
            </div>
            <p className="text-sm text-muted-foreground pl-5">
              {response?.ui_message || response?.message || "Review the suggested matches below. You can download the details for each suggestion and apply filters to narrow down the list."}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="!py-1 overflow-hidden border-border/70 bg-gradient-to-br from-primary/5 to-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Lightbulb className="h-4 w-4 text-primary" />
                <span>Total Suggestions</span>
              </div>

              <div className="mt-1 text-2xl font-semibold tabular-nums pl-5">
                {totalMatches}
              </div>
            </CardContent>
          </Card>

          <Card className="!py-1 overflow-hidden border-border/70 bg-gradient-to-br from-emerald-500/10 to-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Close Matches</span>
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums pl-5">{perfectMatches}</div>
            </CardContent>
          </Card>

          <Card className="!py-1 overflow-hidden border-border/70 bg-gradient-to-br from-amber-500/10 to-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TriangleAlert className="h-4 w-4 text-amber-600" />
                <span>Amount Differences</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums pl-5">{amountDifferences}</div>

            </CardContent>
          </Card>

          <Card className="!py-1 overflow-hidden border-border/70 bg-gradient-to-br from-violet-500/10 to-background shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span>Formatting Only</span>
              </div>
              <div className="text-2xl font-semibold tabular-nums pl-5">{formattingOnly}</div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border bg-card py-16">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Loading possible matches...
            </div>
          </div>
        ) : suggestions.length > 0 ? (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={suggestion.suggestion_id}
                suggestion={suggestion}
                index={index}
                onForceMatchClick={openForceMatchDialog}
                onDownloadClick={handleDownloadSuggestion}
                downloading={downloadingSuggestionId === suggestion.suggestion_id}
                onViewClick={handleViewSuggestion}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No force match suggestions were returned for the selected context.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={forceMatchDialogOpen}
        onOpenChange={(open) => {
          setForceMatchDialogOpen(open);
          if (!open) {
            setSelectedSuggestion(null);
            setForceMatchComment("");
          }
        }}
      >
        <DialogContent className="max-w-2xl gap-1 ">
          <DialogHeader>
            <DialogTitle>Confirm force match</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <label htmlFor="force-match-comment" className="text-sm font-medium">
              Comment
            </label>
            <Textarea
              id="force-match-comment"
              value={forceMatchComment}
              onChange={(event) => setForceMatchComment(event.target.value)}
              placeholder="Add a note for this force match request"
              className="min-h-28 mt-1"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setForceMatchDialogOpen(false)}
              disabled={forceMatchSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmForceMatch()}
              disabled={forceMatchSubmitting || selectedSuggestionRecordCount === 0}
            >
              {forceMatchSubmitting ? "Submitting..." : "Force Match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet
        open={viewDialogOpen}
        onOpenChange={(open) => {
          setViewDialogOpen(open);
          if (!open) {
            setViewDialogLoading(false);
            setViewDialogData([]);
            setSelectedViewSuggestion(null);
            setActiveTab("");
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[90vw] sm:max-w-[90vw] h-full flex flex-col gap-4 px-4 pt-0 pb-4"
        >
          <SheetHeader className="pb-0 border-b !py-2 !px-2">
            <SheetTitle className="text-lg font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Force Match Suggestion Data Preview
            </SheetTitle>
          </SheetHeader>

          {viewDialogLoading ? (
            <div className="flex-grow flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-medium">Fetching sheet data...</p>
            </div>
          ) : viewDialogData.length > 0 ? (
            <div className="flex-grow overflow-y-auto space-y-8 pr-2">
              {viewDialogData.map((sheet, idx) => {
                const rowCount = sheet.data.length;
                const gridHeight = 35 + 32 * Math.min(rowCount, 10) + 55;
                return (
                  <div key={sheet.sheetName || idx} className="space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        {sheet.source}
                      </h3>
                      <span className="text-xs text-muted-foreground font-medium">
                        {rowCount} record{rowCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div
                      style={{ height: `${gridHeight}px` }}
                      className={`w-full text-foreground ${document.documentElement.classList.contains("dark")
                        ? "ag-theme-quartz-dark"
                        : "ag-theme-quartz"
                        }`}
                    >
                      <AgGridReact
                        rowData={sheet.data}
                        rowHeight={32}
                        headerHeight={35}
                        columnDefs={sheet.columns.map((col) => ({
                          field: col,
                          headerName: col.replace(/_/g, " ").toUpperCase(),
                          sortable: true,
                          filter: true,
                          resizable: true,
                          flex: 1,
                        }))}
                        defaultColDef={{
                          resizable: true,
                          sortable: true,
                          filter: true,
                          minWidth: 200,
                        }}
                        pagination={true}
                        paginationPageSize={10}
                        paginationPageSizeSelector={[10, 20, 50]}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-sm text-muted-foreground">
              No data preview available.
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
