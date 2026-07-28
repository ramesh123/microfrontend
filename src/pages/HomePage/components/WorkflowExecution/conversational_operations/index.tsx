import { useCallback, useEffect, useMemo, useRef, useState, type ElementType } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, History, Loader2, Plus, RefreshCcw, SendHorizonal, Sparkles, Download, BarChart2, Table2, Maximize2, Info, Lightbulb, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth/authContext';
import { useTheme } from '@/context/theme';
import { getStatementDates, downloadForceMatchSuggestionFile, viewForceMatchSuggestionData } from '@/controllers/API/ReconcilationAPI';
import { downloadRunAssistantBundle, type RunAssistantPayload, type MatchSuggestions, type MatchSuggestionGroup, type MatchSuggestionDownloadOption } from '@/controllers/API/runAssistantApi';
import { AmChart } from '@/pages/charts/components/AmChart';
import { useRunAssistant } from './useRunAssistant';
import type { ChatMessage, RunExplainerStatus } from './types';
import { AnswerInsightsPanel } from './AnswerInsightsPanel';
import { AnswerEvidenceTables } from './EvidenceSourceTable';
import { ChatHistoryPanel } from './ChatHistoryPanel';
import AIimage from '@/assets/images/ai.png';
import UserIcon from '@/assets/SVG/man-svgrepo-com.svg';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getAllConversationsApi, deleteChatHistoryApi, renameChatHistoryApi } from '@/controllers/API/orchestrationApi';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

ModuleRegistry.registerModules([AllCommunityModule]);

type ConversationalOperationsProps = {
    flowId?: string;
    workflowId?: string;
    workflow?: Record<string, unknown> | null;
};

const SUGGESTIONS = [
    'How many records are matched source wise?',
    'Which records are unmatched?',
    'Summarize this run',
];

function statusLabel(status: RunExplainerStatus) {
    switch (status) {
        case 'connecting':
            return 'Analyzing…';
        case 'completed':
            return 'Ready';
        case 'failed':
            return 'Failed';
        default:
            return 'Ready';
    }
}

function confidenceVariant(confidence?: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const v = (confidence || '').toLowerCase();
    if (v === 'high') return 'default';
    if (v === 'medium') return 'secondary';
    if (v === 'low') return 'destructive';
    return 'outline';
}

function MessageDownloadButton({ bundleId, fileCount, statusType, bundleType }: { bundleId?: string; fileCount?: number; statusType?: string; bundleType?: string }) {
    const [downloading, setDownloading] = useState(false);

    const handleDownload = async () => {
        if (!bundleId) return;
        setDownloading(true);
        try {
            await downloadRunAssistantBundle(bundleId);
            toast.success('Download started');
        } catch {
            /* toast handled in API */
        } finally {
            setDownloading(false);
        }
    };

    if (!bundleId) return null;

    const displayFileCount = fileCount ?? 0;
    const displayStatusType = statusType || '';
    const displayBundleType = bundleType || '';

    return (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 mt-3 w-full">
            <div className="min-w-0 font-sans">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Evidence bundle</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    {displayFileCount} file{displayFileCount === 1 ? '' : 's'} ·{' '}
                    <span className="capitalize">{displayStatusType}</span> · {displayBundleType.toUpperCase()}
                </p>
            </div>
            <Button
                size="icon"
                className="shrink-0 h-8 gap-1.5 px-2 !border-none "
                disabled={downloading}
                onClick={() => void handleDownload()}
            >
                {downloading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                ) : (
                    <Download className="size-3.5" />
                )}
            </Button>
        </div>
    );
}

function SuggestionGroupCard({ group, index, downloadOption }: { group: MatchSuggestionGroup; index: number; downloadOption?: MatchSuggestionDownloadOption }) {
    const [downloading, setDownloading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [viewDialogLoading, setViewDialogLoading] = useState(false);
    const [viewDialogData, setViewDialogData] = useState<
        Array<{
            sheetName: string;
            source: string;
            columns: string[];
            data: Record<string, unknown>[];
        }>
    >([]);

    const option = downloadOption;
    const sourceSheets = option?.source_sheets || group.source_sheets || group.download?.source_sheets || [];
    const recordCount = option?.record_count ?? group.record_count ?? group.suggested_record_count ?? group.download?.record_count ?? 0;
    const confidence = group.confidence || '';
    const notMatchedReason = option?.not_matched_reason || group.not_matched_reason;
    const suggestionStatus = option?.suggestion_status || group.suggestion_status;

    const handleDownload = async () => {
        const downloadId = option?.download_payload?.download_id || option?.download_id || group.download_payload?.download_id || group.download_id || group.download?.download_id;
        if (!downloadId) return;
        setDownloading(true);
        try {
            await downloadForceMatchSuggestionFile({
                download_id: downloadId,
                file_name: option?.file_name || group.file_name || `${group.group_label || 'suggestion'}.xlsx`,
                record_count: recordCount,
                source_sheets: [],
            });
            toast.success('Download started');
        } catch {
            /* Error toast handled in API */
        } finally {
            setDownloading(false);
        }
    };

    const handleView = async () => {
        const encryptedFileKey = option?.encrypted_file_key || option?.view_data_payload?.payload?.encrypted_file_key || group.encrypted_file_key || group.view_data_payload?.payload?.encrypted_file_key;
        if (!encryptedFileKey) {
            toast.error("No data preview available for this suggestion.");
            return;
        }
        if (sourceSheets.length === 0) {
            toast.error("No source sheets found for this suggestion.");
            return;
        }

        setViewDialogOpen(true);
        setViewDialogLoading(true);
        setViewDialogData([]);

        try {
            const promises = sourceSheets.map(async (sheet) => {
                const basePayload = option?.view_data_payload?.payload || group.view_data_payload?.payload;
                const finalPayload = {
                    encrypted_file_key: encryptedFileKey,
                    sheet_name: sheet.sheet_name,
                    type: basePayload?.type || "local",
                    file_type: basePayload?.file_type || "excel",
                    file_name: basePayload?.file_name || option?.file_name || group.file_name || undefined,
                };

                const res = await viewForceMatchSuggestionData(finalPayload);
                return {
                    sheetName: sheet.sheet_name,
                    source: sheet.source,
                    columns: res.columns || [],
                    data: res.data || [],
                };
            });

            const results = await Promise.all(promises);
            setViewDialogData(results);
        } catch (error) {
            console.error("Failed to load sheet data:", error);
            toast.error("Failed to load suggestion sheet data");
            setViewDialogOpen(false);
        } finally {
            setViewDialogLoading(false);
        }
    };

    const getConfidenceBadge = (conf: string) => {
        const c = conf.toLowerCase();
        if (c === 'high') {
            return (
                <Badge className="bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] h-4.5 py-0 px-1.5 capitalize rounded">
                    High Confidence
                </Badge>
            );
        }
        if (c === 'medium') {
            return (
                <Badge className="bg-amber-500/10 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] h-4.5 py-0 px-1.5 capitalize rounded">
                    Medium Confidence
                </Badge>
            );
        }
        if (c === 'low') {
            return (
                <Badge className="bg-rose-500/10 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] h-4.5 py-0 px-1.5 capitalize rounded">
                    Low Confidence
                </Badge>
            );
        }
        return conf ? (
            <Badge variant="outline" className="text-[10px] h-4.5 py-0 px-1.5 capitalize border-border/40 rounded">
                {conf}
            </Badge>
        ) : null;
    };

    const isGenericLabel = !group.group_label ||
        group.group_label.toLowerCase() === 'near-match group' ||
        group.group_label.toLowerCase() === 'near match group';

    const displayLabel = !isGenericLabel ? group.group_label : undefined;

    const getConfidenceColors = (conf: string) => {
        const c = conf.toLowerCase();
        if (c === 'high') {
            return {
                border: 'border-l-emerald-500 dark:border-l-emerald-400',
                badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            };
        }
        if (c === 'medium') {
            return {
                border: 'border-l-amber-500 dark:border-l-amber-400',
                badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
            };
        }
        if (c === 'low') {
            return {
                border: 'border-l-rose-500 dark:border-l-rose-400',
                badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            };
        }
        return {
            border: 'border-l-border',
            badge: 'bg-muted text-muted-foreground border-border/40'
        };
    };

    const confColors = getConfidenceColors(confidence);

    return (
        <div className={cn(
            "group/card relative rounded-xl border border-l-2 border-border/50 bg-gradient-to-br from-card to-muted/5 hover:border-primary/30 transition-all duration-300 overflow-hidden flex flex-col",
            confColors.border
        )}>
            <div className="px-3 pb-1 pt-1.5 flex flex-col gap-0">
                {/* Main Content Area */}
                <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                                Suggestion {index + 1}
                            </span>
                            {suggestionStatus && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button type="button" className="text-muted-foreground hover:text-foreground inline-flex items-center shrink-0 cursor-pointer focus:outline-none">
                                            <Info className="size-3" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-[10px] capitalize font-medium">{suggestionStatus.toLowerCase().replace(/_/g, ' ')}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {getConfidenceBadge(confidence)}
                        </div>

                        <div className="flex items-center gap-1">
                            <Badge className="bg-primary/5 hover:bg-primary/5 text-primary border border-primary/20 text-[11px] h-5 px-1.5 py-0 font-medium rounded-md">
                                {recordCount} records
                            </Badge>
                            {sourceSheets.length > 0 && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-5.5 w-5.5 text-muted-foreground hover:text-primary bg-transparent border-border/50 hover:bg-muted shrink-0 rounded"
                                            onClick={() => void handleView()}
                                        >
                                            <Eye className="h-3 w-3" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-[10px]">Preview records</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                            {(group.download_payload?.download_id || group.download_id || group.download?.download_id) && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-5.5 w-5.5 text-muted-foreground hover:text-primary bg-transparent border-border/50 hover:bg-muted shrink-0 rounded"
                                            disabled={downloading}
                                            onClick={() => void handleDownload()}
                                        >
                                            {downloading ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <Download className="h-3 w-3" />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-[10px]">Download group records</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {displayLabel && (
                        <div className="text-[11px] font-semibold text-foreground leading-snug">
                            {displayLabel}
                        </div>
                    )}

                    {group.explanation && (
                        <p className="text-[10.5px] leading-relaxed text-muted-foreground font-medium whitespace-pre-wrap break-words">
                            {group.explanation}
                        </p>
                    )}

                    {notMatchedReason && (
                        <div className="mt-1.5 bg-amber-500/[0.04] dark:bg-amber-500/[0.02] border border-amber-500/15 rounded-lg p-2 flex items-start gap-2 shadow-sm shadow-amber-500/[0.02] animate-in fade-in duration-200">
                            <Info className="size-3.5 shrink-0 text-amber-500/80 mt-0.5" />
                            <div className="space-y-0.5 flex-1 min-w-0">
                                <p className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Unmatched Reason</p>
                                <p className="text-[10.5px] leading-relaxed text-foreground/90 font-medium whitespace-pre-wrap break-words">
                                    {notMatchedReason}
                                </p>
                            </div>
                        </div>
                    )}



                    {sourceSheets.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            className="w-fit flex items-center gap-1 text-[10px] font-semibold text-primary hover:opacity-85 hover:underline transition-all mt-1 pl-0"
                        >
                            <span>{expanded ? 'Hide source details' : 'Show source details'}</span>
                            <ChevronDown className={cn("size-3 transition-transform duration-300", expanded && "rotate-180")} />
                        </button>
                    )}
                </div>
            </div>

            {sourceSheets.length > 0 && expanded && (
                <div className="border-t border-border/40 bg-muted/20 px-3.5 py-2 space-y-1 animate-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source Breakdown</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {sourceSheets.map((sheet, sIdx) => (
                            <div
                                key={`${group.group_id || index}-sheet-${sIdx}`}
                                className="flex items-center gap-1.5 bg-background border border-border/40 rounded-md px-2 py-0.5 text-[10px]"
                            >
                                <span className="text-muted-foreground truncate font-medium">{sheet.source}</span>
                                <span className="font-mono text-foreground font-semibold shrink-0 bg-muted/50 px-1 py-0.2 rounded text-[10px]">
                                    {sheet.record_count} records
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Sheet
                open={viewDialogOpen}
                onOpenChange={(open) => {
                    setViewDialogOpen(open);
                    if (!open) {
                        setViewDialogLoading(false);
                        setViewDialogData([]);
                    }
                }}
            >
                <SheetContent
                    side="right"
                    className="w-[90vw] sm:max-w-[90vw] h-full flex flex-col gap-4 px-4 !pt-0 !pb-0 !gap-1"
                >
                    <SheetHeader className="pb-0 border-b !py-2 !px-2 shrink-0">
                        <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                            <Eye className="h-4 w-4 text-primary" />
                            <span>Suggestion {index + 1} Data Preview</span>
                        </SheetTitle>
                    </SheetHeader>

                    {viewDialogLoading ? (
                        <div className="flex-grow flex flex-col items-center justify-center gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground font-medium">Fetching sheet data...</p>
                        </div>
                    ) : viewDialogData.length > 0 ? (
                        <div className="flex-grow overflow-y-auto space-y-6 pr-1 mt-2">
                            {viewDialogData.map((sheet, idx) => {
                                const rowCount = sheet.data.length;
                                const gridHeight = 35 + 32 * Math.min(rowCount, 10) + 55;
                                return (
                                    <div key={sheet.sheetName || idx} className="space-y-2 bg-muted/10 px-2 py-0">
                                        <div className="flex items-center justify-between border-b pb-1.5">
                                            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-primary" />
                                                {sheet.source}
                                            </h3>
                                            <span className="text-[11px] text-muted-foreground font-medium">
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
                                                    minWidth: 150,
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
                        <div className="flex-grow flex items-center justify-center text-xs text-muted-foreground">
                            No data preview available.
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

function MatchSuggestionsBlock({ suggestions }: { suggestions?: MatchSuggestions }) {
    if (!suggestions) return null;
    if (suggestions.requested === false) return null;

    const { status, retrieval_status, message, groups, summary } = suggestions;

    if (status === false || retrieval_status === 'failed') {
        if (!message) return null;
        return (
            <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-2.5 w-full text-[11px] text-destructive-foreground animate-in fade-in duration-200">
                <Info className="size-4 shrink-0 text-destructive mt-0.5" />
                <div className="space-y-0.5">
                    <p className="opacity-90">{message}</p>
                </div>
            </div>
        );
    }

    const hasGroups = Array.isArray(groups) && groups.length > 0;
    if (!hasGroups) {
        if (!message) return null;
        return (
            <div className="mt-2 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 w-full text-[11px] text-foreground animate-in fade-in duration-200">
                <Info className="size-4 shrink-0 text-primary mt-0.5" />
                <div className="space-y-0.5">
                    <p className="text-muted-foreground">{message}</p>
                </div>
            </div>
        );
    }

    const groupCount = summary?.group_count ?? groups.length;

    return (
        <div className="mt-2 w-full border border-border/50 rounded-xl overflow-hidden bg-gradient-to-b from-primary/[0.01] to-card/20 flex flex-col animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
            <div className="w-full flex items-center justify-between px-3 py-2 bg-muted/10 border-b border-border/40 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5 font-bold text-primary">
                    <Lightbulb className="size-3.5 text-amber-500 fill-amber-500/10 animate-pulse" />
                    Force-Match Suggestions
                </span>
                <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold rounded-full text-[10px] h-4.5 px-2">
                    {groupCount} Group{groupCount === 1 ? '' : 's'}
                </Badge>
            </div>
            <div className="p-2.5 bg-card/10 space-y-2.5">
                <div className="grid grid-cols-1 gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                    {groups.map((group, idx) => {
                        const matchingOption = suggestions.download_options?.find(
                            (opt) =>
                                opt.suggestion_id === group.group_id ||
                                opt.download_id === group.group_id ||
                                opt.suggestion_id === group.suggestion_id ||
                                opt.download_id === group.suggestion_id
                        );
                        return (
                            <SuggestionGroupCard
                                key={group.group_id || group.suggestion_id || idx}
                                group={group}
                                index={idx}
                                downloadOption={matchingOption}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function MessageBubble({ message }: { message: ChatMessage }) {
    const auth = useAuth();
    const isUser = message.kind === 'user';
    const isLoading = message.isStreaming;
    const hasEvidence = (message.answer?.evidence_by_source?.length ?? 0) > 0;
    const chart = message.answer?.chart || message.answer?.charts;
    const [activeTab, setActiveTab] = useState<'chart' | 'table'>('chart');
    const [tablesExpanded, setTablesExpanded] = useState(false);
    const [chartExpanded, setChartExpanded] = useState(false);
    const [isChartDialogOpen, setIsChartDialogOpen] = useState(false);
    const [dialogActiveTab, setDialogActiveTab] = useState<'chart' | 'table'>('chart');

    const tableColumns = useMemo(() => {
        if (chart?.columns && Array.isArray(chart.columns) && chart.columns.length > 0) {
            return chart.columns;
        }
        if (chart?.data && Array.isArray(chart.data) && chart.data.length > 0) {
            return Object.keys(chart.data[0]);
        }
        return [];
    }, [chart]);

    return (
        <div className="flex gap-2.5 w-full max-w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div
                className={cn(
                    'w-full rounded-2xl px-4 py-3 min-w-0 border flex flex-col text-foreground transition-all',
                    isUser
                        ? 'bg-background border-border/40 shadow-sm'
                        : 'bg-card border-primary/20 shadow-md shadow-primary/5 ring-1 ring-primary/5',
                    isLoading && 'border-dashed border-primary/30 bg-primary/5',
                )}
            >
                <div className="flex items-center gap-3 mb-0 w-full">
                    {isUser ? (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity focus:outline-none cursor-pointer">
                                    <div className="flex-shrink-0 size-6 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-background shadow-sm bg-muted text-muted-foreground">
                                        <img src={UserIcon} alt="User" className="h-8 w-8 object-contain" aria-hidden />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1">
                                            {auth.state.authInfo?.user?.name || auth.state.authInfo?.user?.first_name || 'Anonymous User'}
                                        </span>
                                        <span className="text-[10px] opacity-60 tabular-nums">{message.timestamp}</span>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent align="start" className="p-2 w-60 bg-popover text-popover-foreground border shadow-lg rounded-xl z-50">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 pb-0">
                                        <div className="size-8 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground text-[0.72rem] font-semibold leading-none tracking-tight flex items-center justify-center">
                                            {(auth.state.authInfo?.user?.name || auth.state.authInfo?.user?.username || 'U')
                                                .split(' ')
                                                .map((word) => word[0])
                                                .slice(0, 2)
                                                .join('')
                                                .toUpperCase()}                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground truncate">
                                                {auth.state.authInfo?.user?.name || auth.state.authInfo?.user?.first_name || 'Anonymous User'}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground truncate">
                                                {auth.state.authInfo?.user?.email || 'No email'}
                                            </p>
                                        </div>
                                    </div>
                                    {/* <div className="space-y-1.5 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">User ID:</span>
                                            <span className="font-mono text-[11px] text-foreground font-semibold bg-muted/50 px-1.5 py-0.5 rounded">
                                                {auth.state.authInfo?.user?.id || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground">Username:</span>
                                            <span className="text-foreground">
                                                {auth.state.authInfo?.user?.username || 'N/A'}
                                            </span>
                                        </div>
                                        {auth.state.authInfo?.user?.role && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-muted-foreground">Role:</span>
                                                <span className="text-foreground capitalize font-medium">
                                                    {auth.state.authInfo?.user?.role}
                                                </span>
                                            </div>
                                        )}
                                    </div> */}
                                </div>
                            </PopoverContent>
                        </Popover>
                    ) : (
                        <>
                            <div className="flex-shrink-0 size-6 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-background shadow-sm bg-muted">
                                <img src={AIimage} alt="AI" className="h-8 w-8 object-contain" aria-hidden />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate">{message.title}</span>
                                <span className="text-[10px] opacity-60 tabular-nums">{message.timestamp}</span>
                            </div>
                        </>
                    )}
                    {!isUser && (
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] h-5 rounded-full px-2.5 py-0 font-medium ml-auto flex items-center gap-1 shrink-0 border-none">
                            <Sparkles className="size-2.5 fill-current" />
                            AI Insights
                        </Badge>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-2 py-1">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">{message.body}</span>
                    </div>
                ) : (
                    <>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.body}</div>
                        {message.answer?.confidence ? (
                            <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap gap-1.5 w-full">
                                <Badge variant={confidenceVariant(message.answer.confidence)} className="text-[10px] h-5 capitalize">
                                    {message.answer.confidence} confidence
                                </Badge>
                                {hasEvidence ? (
                                    <Badge variant="outline" className="text-[10px] h-5">
                                        {message.answer!.evidence_by_source!.length} source
                                        {message.answer!.evidence_by_source!.length === 1 ? '' : 's'}
                                    </Badge>
                                ) : null}
                            </div>
                        ) : null}
                        {message.answer?.download_bundle ? (
                            <MessageDownloadButton
                                bundleId={message.answer.download_bundle.bundle_id}
                                fileCount={message.answer.download_bundle.file_count}
                                statusType={message.answer.download_bundle.status_type}
                                bundleType={message.answer.download_bundle.bundle_type}
                            />
                        ) : null}
                        {hasEvidence ? (
                            <div className="mt-3 w-full border rounded-lg overflow-hidden bg-muted/5">
                                <button
                                    type="button"
                                    onClick={() => setTablesExpanded(!tablesExpanded)}
                                    className="w-full flex items-center justify-between px-4 py-2 bg-muted/20 hover:bg-muted/40 transition-colors text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                    <span className="flex items-center gap-1.5 font-bold">
                                        <Table2 className="size-3.5 text-primary" />
                                        Evidence Tables ({message.answer!.evidence_by_source!.length})
                                    </span>
                                    <div className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground normal-case bg-muted/40 px-2 py-0.5 rounded-md hover:text-foreground">
                                        {/* <span>{tablesExpanded ? 'Collapse' : 'Expand'}</span> */}
                                        {tablesExpanded ? (
                                            <ChevronUp className="h-4 w-4" />
                                        ) : (
                                            <ChevronDown className="h-4 w-4" />
                                        )}
                                    </div>
                                </button>
                                {tablesExpanded && (
                                    <div className="p-3 border-t bg-card animate-in fade-in duration-200">
                                        <AnswerEvidenceTables sources={message.answer!.evidence_by_source!} />
                                        <div className="mt-2.5 flex justify-end">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                                onClick={() => setTablesExpanded(false)}
                                            >
                                                <ChevronUp className="size-3.5" />
                                                {/* Collapse tables */}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                        {chart && chart.status ? (
                            <div className="mt-3 border rounded-lg overflow-hidden bg-muted/5 w-full">
                                <button
                                    type="button"
                                    onClick={() => setChartExpanded(!chartExpanded)}
                                    className="w-full flex items-center justify-between px-4 py-2 bg-muted/20 hover:bg-muted/40 transition-colors text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                                >
                                    <span className="flex items-center gap-1.5 font-bold">
                                        <BarChart2 className="size-3.5 text-primary" />
                                        {chart.chart_name || 'Chart Insights'}
                                    </span>
                                    <div className="flex items-center gap-0">

                                        <div className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground normal-case bg-muted/40 px-2 py-0.5 rounded-md hover:text-foreground">
                                            {/* <span>{chartExpanded ? 'Collapse' : 'Expand'}</span> */}
                                            {chartExpanded ? (
                                                <ChevronUp className="h-4.5 w-4.5" />
                                            ) : (
                                                <ChevronDown className="h-4.5 w-4.5" />
                                            )}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted/60 shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsChartDialogOpen(true);
                                            }}
                                            title="View in Sheet"
                                        >
                                            <Maximize2 className="!h-3.5 !w-3.5" />
                                        </Button>
                                    </div>
                                </button>
                                {chartExpanded && (
                                    <div className="p-4 bg-card border-t space-y-3 animate-in fade-in duration-200 flex flex-col overflow-hidden">
                                        <div className="flex items-center justify-end w-full">
                                            <div className="flex items-center border rounded-md p-0.5 bg-muted/40 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('chart')}
                                                    className={cn(
                                                        "p-1 rounded-sm transition-colors",
                                                        activeTab === 'chart'
                                                            ? "bg-background shadow-sm text-foreground"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                    title="Chart View"
                                                >
                                                    <BarChart2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('table')}
                                                    className={cn(
                                                        "p-1 rounded-sm transition-colors",
                                                        activeTab === 'table'
                                                            ? "bg-background shadow-sm text-foreground"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                    title="Table View"
                                                >
                                                    <Table2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {activeTab === 'chart' ? (
                                            <div className="h-[260px] w-full min-h-[260px] overflow-hidden mt-2">
                                                <AmChart
                                                    chart={{
                                                        name: chart.chart_name || 'Chart',
                                                        uniqueId: chart.visualization_name || 'bar',
                                                        icon: null as unknown as ElementType,
                                                    }}
                                                    data={chart.data || []}
                                                    config={{
                                                        x: chart.params?.dimensions?.[0]
                                                            ? {
                                                                name: typeof chart.params.dimensions[0] === 'string'
                                                                    ? chart.params.dimensions[0]
                                                                    : (chart.params.dimensions[0].columns || chart.params.dimensions[0].name || ''),
                                                                type: 'string',
                                                            }
                                                            : null,
                                                        y: chart.params?.metrics?.[0]
                                                            ? {
                                                                name: typeof chart.params.metrics[0] === 'string'
                                                                    ? chart.params.metrics[0]
                                                                    : (chart.params.metrics[0].columns || chart.params.metrics[0].name || ''),
                                                                type: 'number',
                                                            }
                                                            : null,
                                                        operator: chart.params?.metrics?.[0]?.operation || chart.params?.operator || null,
                                                        color: chart.params?.color
                                                            ? {
                                                                name: typeof chart.params.color === 'string'
                                                                    ? chart.params.color
                                                                    : (chart.params.color.name || chart.params.color.columns || ''),
                                                                type: 'string',
                                                            }
                                                            : null,
                                                        column: chart.params?.column
                                                            ? {
                                                                name: typeof chart.params.column === 'string'
                                                                    ? chart.params.column
                                                                    : (chart.params.column.name || chart.params.column.columns || ''),
                                                                type: 'string',
                                                            }
                                                            : null,
                                                        row: chart.params?.row
                                                            ? {
                                                                name: typeof chart.params.row === 'string'
                                                                    ? chart.params.row
                                                                    : (chart.params.row.name || chart.params.row.columns || ''),
                                                                type: 'string',
                                                            }
                                                            : null,
                                                    }}
                                                    showLegend={chart.ui_hints?.show_legend ?? true}
                                                    rawResponse={chart}
                                                    chartParams={chart.params}
                                                />
                                            </div>
                                        ) : (
                                            chart.data && chart.data.length > 0 ? (
                                                <div className="mt-2 border rounded-lg overflow-hidden bg-muted/10 w-full overflow-x-auto">
                                                    <table className="w-full text-left border-collapse min-w-[300px]">
                                                        <thead>
                                                            <tr className="border-b bg-muted/50">
                                                                {tableColumns.length > 0 ? (
                                                                    tableColumns.map((col: string) => (
                                                                        <th key={col} className="p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                            {col.replace(/_/g, ' ')}
                                                                        </th>
                                                                    ))
                                                                ) : (
                                                                    <>
                                                                        <th className="p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dimension</th>
                                                                        <th className="p-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Value</th>
                                                                    </>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y text-xs">
                                                            {chart.data.map((row: Record<string, unknown>, idx: number) => (
                                                                <tr key={idx} className="hover:bg-muted/30">
                                                                    {tableColumns.length > 0 ? (
                                                                        tableColumns.map((col: string) => (
                                                                            <td key={col} className="p-2 text-foreground font-mono">
                                                                                {typeof row[col] === 'number' ? (row[col] as number).toLocaleString() : String(row[col] ?? '—')}
                                                                            </td>
                                                                        ))
                                                                    ) : (
                                                                        <>
                                                                            <td className="p-2 text-foreground font-mono">{String(Object.values(row)[0] ?? '—')}</td>
                                                                            <td className="p-2 text-foreground font-mono">{String(Object.values(row)[1] ?? '—')}</td>
                                                                        </>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-xs text-muted-foreground text-center py-4">No data available</div>
                                            )
                                        )}
                                        <div className="mt-2.5 flex justify-end shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                                onClick={() => setChartExpanded(false)}
                                            >
                                                <ChevronUp className="size-3.5" />
                                                {/* Collapse chart */}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Sheet open={isChartDialogOpen} onOpenChange={setIsChartDialogOpen}>
                                    <SheetContent className="w-[95vw] max-w-[95vw] md:w-[90vw] md:max-w-[90vw] flex flex-col px-2 py-0 bg-background border" side="right">
                                        <SheetHeader className="pb-2 border-b shrink-0">
                                            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
                                                <BarChart2 className="size-4 text-primary shrink-0" />
                                                <span>{chart.chart_name || 'Chart Insights'}</span>
                                            </SheetTitle>
                                        </SheetHeader>

                                        <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-4">
                                            <div className="flex items-center justify-end w-full">
                                                <div className="flex items-center border rounded-md p-0.5 bg-muted/40 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDialogActiveTab('chart')}
                                                        className={cn(
                                                            "p-1 rounded-sm transition-colors",
                                                            dialogActiveTab === 'chart'
                                                                ? "bg-background shadow-sm text-foreground"
                                                                : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                        title="Chart View"
                                                    >
                                                        <BarChart2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDialogActiveTab('table')}
                                                        className={cn(
                                                            "p-1 rounded-sm transition-colors",
                                                            dialogActiveTab === 'table'
                                                                ? "bg-background shadow-sm text-foreground"
                                                                : "text-muted-foreground hover:text-foreground"
                                                        )}
                                                        title="Table View"
                                                    >
                                                        <Table2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            {dialogActiveTab === 'chart' ? (
                                                <div className="h-[450px] w-full min-h-[400px] overflow-hidden mt-2">
                                                    <AmChart
                                                        chart={{
                                                            name: chart.chart_name || 'Chart',
                                                            uniqueId: chart.visualization_name || 'bar',
                                                            icon: null as unknown as ElementType,
                                                        }}
                                                        data={chart.data || []}
                                                        config={{
                                                            x: chart.params?.dimensions?.[0]
                                                                ? {
                                                                    name: typeof chart.params.dimensions[0] === 'string'
                                                                        ? chart.params.dimensions[0]
                                                                        : (chart.params.dimensions[0].columns || chart.params.dimensions[0].name || ''),
                                                                    type: 'string',
                                                                }
                                                                : null,
                                                            y: chart.params?.metrics?.[0]
                                                                ? {
                                                                    name: typeof chart.params.metrics[0] === 'string'
                                                                        ? chart.params.metrics[0]
                                                                        : (chart.params.metrics[0].columns || chart.params.metrics[0].name || ''),
                                                                    type: 'number',
                                                                }
                                                                : null,
                                                            operator: chart.params?.metrics?.[0]?.operation || chart.params?.operator || null,
                                                            color: chart.params?.color
                                                                ? {
                                                                    name: typeof chart.params.color === 'string'
                                                                        ? chart.params.color
                                                                        : (chart.params.color.name || chart.params.color.columns || ''),
                                                                    type: 'string',
                                                                }
                                                                : null,
                                                            column: chart.params?.column
                                                                ? {
                                                                    name: typeof chart.params.column === 'string'
                                                                        ? chart.params.column
                                                                        : (chart.params.column.name || chart.params.column.columns || ''),
                                                                    type: 'string',
                                                                }
                                                                : null,
                                                            row: chart.params?.row
                                                                ? {
                                                                    name: typeof chart.params.row === 'string'
                                                                        ? chart.params.row
                                                                        : (chart.params.row.name || chart.params.row.columns || ''),
                                                                    type: 'string',
                                                                }
                                                                : null,
                                                        }}
                                                        showLegend={chart.ui_hints?.show_legend ?? true}
                                                        rawResponse={chart}
                                                        chartParams={chart.params}
                                                    />
                                                </div>
                                            ) : (
                                                chart.data && chart.data.length > 0 ? (
                                                    <div className="mt-2 border rounded-lg overflow-hidden bg-muted/10 w-full overflow-x-auto">
                                                        <table className="w-full text-left border-collapse min-w-[500px]">
                                                            <thead>
                                                                <tr className="border-b bg-muted/50">
                                                                    {tableColumns.length > 0 ? (
                                                                        tableColumns.map((col: string) => (
                                                                            <th key={col} className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                                                                {col.replace(/_/g, ' ')}
                                                                            </th>
                                                                        ))
                                                                    ) : (
                                                                        <>
                                                                            <th className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Dimension</th>
                                                                            <th className="p-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Value</th>
                                                                        </>
                                                                    )}
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y text-sm">
                                                                {chart.data.map((row: Record<string, unknown>, idx: number) => (
                                                                    <tr key={idx} className="hover:bg-muted/30">
                                                                        {tableColumns.length > 0 ? (
                                                                            tableColumns.map((col: string) => (
                                                                                <td key={col} className="p-3 text-foreground font-mono">
                                                                                    {typeof row[col] === 'number' ? (row[col] as number).toLocaleString() : String(row[col] ?? '—')}
                                                                                </td>
                                                                            ))
                                                                        ) : (
                                                                            <>
                                                                                <td className="p-3 text-foreground font-mono">{String(Object.values(row)[0] ?? '—')}</td>
                                                                                <td className="p-3 text-foreground font-mono">{String(Object.values(row)[1] ?? '—')}</td>
                                                                            </>
                                                                        )}
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-muted-foreground text-center py-4">No data available</div>
                                                )
                                            )}
                                        </div>
                                    </SheetContent>
                                </Sheet>
                            </div>
                        ) : null}
                        {message.answer?.['match-suggestions'] || message.answer?.match_suggestions ? (
                            <MatchSuggestionsBlock suggestions={message.answer?.['match-suggestions'] || message.answer?.match_suggestions} />
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
}


export default function ConversationalOperations({
    flowId,
    workflowId,
    workflow,
}: ConversationalOperationsProps) {
    const auth = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark' || theme === 'blue-dark' || theme === 'blue-dark-g' || theme === 'purple-dark' || theme === 'orange-dark';
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sessionIdRef = useRef(
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `session-${Date.now()}`,
    );

    const [question, setQuestion] = useState('');
    const [selectedRunId, setSelectedRunId] = useState('');
    const [selectedRunName, setSelectedRunName] = useState('');
    const [stmtDate, setStmtDate] = useState('');
    const [loadingDates, setLoadingDates] = useState(false);
    const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);

    const { messages, status, drawer, sending, conversationId, ask, resetConversation, loadConversation } = useRunAssistant();

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [conversations, setConversations] = useState<Array<{ conversation_id: string; conversation_name?: string }>>([]);
    const [loadingConversations, setLoadingConversations] = useState(false);
    const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
    const [hasAttemptedAutoLoad, setHasAttemptedAutoLoad] = useState(false);
    const [hasLoadedConversations, setHasLoadedConversations] = useState(false);

    const userEmail = auth.state.authInfo?.user?.email || auth.state.authInfo?.user?.username || '';

    const loadAllConversations = useCallback(async () => {
        if (!flowId) return;
        setLoadingConversations(true);
        try {
            const response = await getAllConversationsApi({
                flow_id: flowId,
                mode: 'RUN_ASSISTANT',
                user_name: userEmail
            });
            setConversations(response?.conversation_map || []);
            setHasLoadedConversations(true);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoadingConversations(false);
        }
    }, [flowId, userEmail]);

    useEffect(() => {
        void loadAllConversations();
    }, [loadAllConversations, conversationId]);

    const handleConversationSelect = useCallback(async (id: string) => {
        if (!flowId) return;
        await loadConversation(id, flowId, userEmail);
    }, [flowId, loadConversation, userEmail]);

    useEffect(() => {
        setHasAttemptedAutoLoad(false);
        setHasLoadedConversations(false);
    }, [flowId]);

    useEffect(() => {
        if (!hasLoadedConversations || loadingConversations || hasAttemptedAutoLoad || !flowId) return;

        if (conversations.length > 0) {
            const latest = conversations[0];
            if (latest?.conversation_id && !conversationId) {
                setHasAttemptedAutoLoad(true);
                void handleConversationSelect(latest.conversation_id);
            }
        } else {
            setHasAttemptedAutoLoad(true);
            resetConversation();
        }
    }, [conversations, loadingConversations, hasLoadedConversations, conversationId, flowId, handleConversationSelect, resetConversation, hasAttemptedAutoLoad]);



    const handleStartEdit = useCallback((id: string, currentName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingConversationId(id);
        setEditingName(currentName);
    }, []);

    const handleSaveRename = useCallback(async (id: string) => {
        if (!editingName.trim()) return;
        try {
            await renameChatHistoryApi({
                conversation_id: id,
                new_chat_name: editingName.trim()
            });
            toast.success('Chat renamed successfully');
            setConversations(prev =>
                prev.map(c => c.conversation_id === id ? { ...c, conversation_name: editingName.trim() } : c)
            );
        } catch (error) {
            console.error('Failed to rename chat:', error);
            toast.error('Failed to rename chat');
        } finally {
            setEditingConversationId(null);
            setEditingName('');
        }
    }, [editingName]);

    const handleDeleteClick = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingConversationId(id);
    }, []);

    const confirmDeleteChat = useCallback(async () => {
        if (!deletingConversationId) return;
        try {
            await deleteChatHistoryApi({
                conversation_id: deletingConversationId
            });
            toast.success('Chat deleted successfully');
            setConversations(prev => prev.filter(c => c.conversation_id !== deletingConversationId));
            if (conversationId === deletingConversationId) {
                resetConversation();
            }
        } catch (error) {
            console.error('Failed to delete chat:', error);
            toast.error('Failed to delete chat');
        } finally {
            setDeletingConversationId(null);
        }
    }, [deletingConversationId, conversationId, resetConversation]);

    const resolvedWorkflowId = String(
        workflow?.workflow_id ?? workflow?.id ?? workflowId ?? '',
    );

    useEffect(() => {
        if (!flowId) return;
        let cancelled = false;

        const loadDates = async () => {
            setLoadingDates(true);
            try {
                const response = await getStatementDates({ flow_id: flowId });
                if (cancelled) return;
                const datesArray = Array.isArray(response) ? response : (response?.data ?? []);
                const sorted = [...datesArray]
                    .map((item) => typeof item === 'string' ? { stmt_date: item } : item)
                    .filter((item): item is { stmt_date: string; flow_run_id?: string; execution_number?: string | number } => Boolean(item && typeof item === 'object' && item.stmt_date))
                    .sort((a, b) => a.stmt_date.localeCompare(b.stmt_date));

                if (sorted.length > 0) {
                    const latestObj = sorted[sorted.length - 1];
                    setStmtDate(latestObj.stmt_date);
                    setSelectedRunId(latestObj.flow_run_id || '');
                    setSelectedRunName(latestObj.execution_number ? String(latestObj.execution_number) : '');
                } else {
                    setStmtDate('');
                    setSelectedRunId('');
                    setSelectedRunName('');
                }
            } catch {
                if (!cancelled) {
                    setStmtDate('');
                    setSelectedRunId('');
                    setSelectedRunName('');
                }
            } finally {
                if (!cancelled) setLoadingDates(false);
            }
        };

        void loadDates();
        return () => {
            cancelled = true;
        };
    }, [flowId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
        });
    }, [messages]);

    const buildPayload = useCallback(
        (q: string, overrideRunId?: string, overrideRunName?: string, overrideStmtDate?: string): RunAssistantPayload => ({
            question: q,
            conversation_id: conversationId || '',
            run_context: {
                workflow_id: resolvedWorkflowId,
                flow_id: flowId ?? '',
                flow_run_id: overrideRunId ?? selectedRunId,
                process_cycle: '',
                execution_number: overrideRunName ?? selectedRunName,
                stmt_date: overrideStmtDate ?? stmtDate,
            },
            user_context: {
                user_id:
                    auth.state.authInfo?.user?.email ??
                    auth.state.authInfo?.user?.username ??
                    'anonymous',
                session_id: sessionIdRef.current,
                channel: 'reconciliation-ui',
                locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
            },
            answer_options: {
                stream: false,
                include_trace: false,
                include_evidence_rows: true,
                include_technical_detail: false,
                max_evidence_rows: 10,
                evidence_page: 1,
            },
        }),
        [
            auth.state.authInfo?.user?.email,
            auth.state.authInfo?.user?.username,
            flowId,
            resolvedWorkflowId,
            selectedRunName,
            selectedRunId,
            stmtDate,
            conversationId,
        ],
    );

    const handleSend = useCallback(
        async (text?: string) => {
            const q = (text ?? question).trim();
            if (!q || sending) return;
            if (!flowId) return;

            setQuestion('');

            let latestRunId = selectedRunId;
            let latestRunName = selectedRunName;
            let latestStmtDate = stmtDate;

            try {
                const datesResponse = await getStatementDates({ flow_id: flowId });
                const datesArray = Array.isArray(datesResponse) ? datesResponse : (datesResponse?.data ?? []);
                const sorted = [...datesArray]
                    .map((item) => typeof item === 'string' ? { stmt_date: item } : item)
                    .filter((item): item is { stmt_date: string; flow_run_id?: string; execution_number?: string | number } => Boolean(item && typeof item === 'object' && item.stmt_date))
                    .sort((a, b) => a.stmt_date.localeCompare(b.stmt_date));

                if (sorted.length > 0) {
                    const latestObj = sorted[sorted.length - 1];
                    latestStmtDate = latestObj.stmt_date;
                    latestRunId = latestObj.flow_run_id || '';
                    latestRunName = latestObj.execution_number ? String(latestObj.execution_number) : '';

                    // Update state to keep UI in sync
                    setStmtDate(latestStmtDate);
                    setSelectedRunId(latestRunId);
                    setSelectedRunName(latestRunName);
                }
            } catch (err) {
                console.error('Failed to fetch latest statement date/run for answer:', err);
            }

            await ask(buildPayload(q, latestRunId, latestRunName, latestStmtDate));
        },
        [ask, buildPayload, flowId, question, selectedRunId, selectedRunName, stmtDate, sending],
    );

    return (
        <div className="flex flex-col gap-3 h-[calc(100vh-8rem)] min-h-[520px] p-1">
            <div className={cn(
                "grid grid-cols-1 min-h-0 flex-1 transition-all duration-300 ease-in-out gap-3",
                isEvidenceOpen && isHistoryOpen
                    ? "xl:grid-cols-[minmax(0,1fr)_360px_280px]"
                    : isEvidenceOpen
                        ? "xl:grid-cols-[minmax(0,1fr)_360px_48px]"
                        : isHistoryOpen
                            ? "xl:grid-cols-[minmax(0,1fr)_48px_280px]"
                            : "xl:grid-cols-[minmax(0,1fr)_48px_48px]",
            )}>
                {/* Main Conversation Panel */}
                <Card
                    className={cn(
                        "flex flex-col min-h-0 overflow-hidden !py-0 order-1 xl:order-none transition-all duration-300",
                        isDark
                            ? "bg-gradient-to-br from-[#05070c] via-[#0b1a33] to-black text-white"
                            : "bg-gradient-to-br from-blue-50 via-white to-purple-50 text-foreground"
                    )}
                >
                    <CardHeader className="border-b py-2.5 px-4">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Sparkles className="size-4 text-primary animate-pulse" />
                                    Run Assistant
                                </CardTitle>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center p-0.5 rounded-full hover:bg-muted"
                                        >
                                            <Info className="size-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent align="start" className="max-w-xs">
                                        <p className="text-xs leading-normal">
                                            Ask about matched records, exceptions, and reconciliation outcomes
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            <div className="flex items-center gap-2">
                                {loadingDates && (
                                    <span className="text-[10px] text-muted-foreground animate-pulse mr-1">
                                        Loading run context…
                                    </span>
                                )}
                                <Badge
                                    variant={status === 'failed' ? 'destructive' : status === 'connecting' ? 'secondary' : 'outline'}
                                    className="text-[10px] h-5 capitalize"
                                >
                                    {status === 'connecting' && <Loader2 className="size-3 animate-spin mr-1" />}
                                    {statusLabel(status)}
                                </Badge>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={isHistoryOpen ? 'secondary' : 'outline'}
                                            size="icon"
                                            className="!h-7 xl:hidden"
                                            onClick={() => setIsHistoryOpen((v) => !v)}
                                        >
                                            <History className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Chat history</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="!h-7"
                                            onClick={resetConversation}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>New chat</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="!h-7"
                                            onClick={resetConversation}
                                        >
                                            <RefreshCcw className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Reset conversation</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </CardHeader>

                    <ScrollArea className="flex-1 min-h-0">
                        <div className="py-2 px-4 space-y-3">
                            {messages.map((msg) => (
                                <MessageBubble key={msg.id} message={msg} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    </ScrollArea>

                    <div className="border-t p-3 space-y-2 bg-muted/20">
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTIONS.map((s) => (
                                <Button
                                    key={s}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs rounded-full"
                                    disabled={sending || !selectedRunId}
                                    onClick={() => void handleSend(s)}
                                >
                                    {s}
                                </Button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            <div className="relative">
                                <Textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            void handleSend();
                                        }
                                    }}
                                    placeholder="Ask anything about this reconciliation run..."
                                    rows={1}
                                    disabled={sending || !selectedRunId}
                                    className="min-h-[56px] resize-none rounded-3xl border-2 border-primary/40 bg-background px-5 py-3 pr-14 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                                />

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        'absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-primary/10 transition-opacity',
                                        question.trim() ? 'opacity-100 text-primary' : 'opacity-40 text-primary/50',
                                    )}
                                    disabled={sending || !selectedRunId || !flowId || !question.trim()}
                                    onClick={() => void handleSend()}                                >
                                    {sending ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <SendHorizonal className="!h-5 !w-5" />
                                    )}
                                </Button>
                            </div>

                            <p className="text-center text-[10px] text-muted-foreground">
                                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                                    Enter
                                </kbd>{' '}
                                to send ·{' '}
                                <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
                                    Shift+Enter
                                </kbd>{' '}
                                new line
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Evidence & Insights Panel */}
                <Card
                    className={cn(
                        "relative flex flex-col min-h-0 overflow-hidden !py-2 transition-all duration-300 ease-in-out order-2 xl:order-none",
                        isEvidenceOpen ? "border" : "border-0"
                    )}>
                    {!isEvidenceOpen ? (
                        <div
                            className="hidden xl:flex absolute inset-0 flex flex-col items-center justify-start pt-2 transition-opacity duration-300 pointer-events-auto opacity-100 select-none cursor-pointer space-y-6"
                            onClick={() => setIsEvidenceOpen(true)}
                            title="Expand Evidence & Insights"
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-muted"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEvidenceOpen(true);
                                }}
                            >
                                <ChevronLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/75 [writing-mode:vertical-lr] rotate-180">
                                Insights
                            </span>
                        </div>
                    ) : null}

                    <div className={cn("flex flex-col h-full min-h-0", !isEvidenceOpen && "xl:hidden")}>
                        <CardHeader
                            className="py-0 px-4 border-b flex flex-row items-center justify-between cursor-pointer select-none shrink-0"
                            onClick={() => setIsEvidenceOpen(!isEvidenceOpen)}
                        >
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Sparkles className="size-4 text-primary" />
                                Evidence &amp; Insights
                            </CardTitle>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full hover:bg-muted"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEvidenceOpen(!isEvidenceOpen);
                                }}
                            >
                                {isEvidenceOpen ? (
                                    <>
                                        <ChevronRight className="h-5 w-5 hidden xl:block text-muted-foreground" />
                                        <ChevronUp className="h-5 w-5 xl:hidden text-muted-foreground" />
                                    </>
                                ) : (
                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                )}
                            </Button>
                        </CardHeader>

                        {isEvidenceOpen && (
                            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                                <AnswerInsightsPanel
                                    answer={drawer.answer}
                                    confidence={drawer.confidence}
                                    recordStatus={drawer.recordStatus}
                                />
                            </div>
                        )}
                    </div>
                </Card>

                {/* Chat History — right side */}
                <div className={cn('min-h-0 h-full flex flex-col order-3 xl:order-none', !isHistoryOpen && 'hidden xl:block')}>
                    <ChatHistoryPanel
                        open={isHistoryOpen}
                        onOpenChange={setIsHistoryOpen}
                        conversations={conversations}
                        loading={loadingConversations}
                        activeConversationId={conversationId}
                        editingConversationId={editingConversationId}
                        editingName={editingName}
                        deletingConversationId={deletingConversationId}
                        onSelect={(id) => void handleConversationSelect(id)}
                        onNewChat={resetConversation}
                        onStartEdit={handleStartEdit}
                        onEditingNameChange={setEditingName}
                        onSaveRename={handleSaveRename}
                        onCancelEdit={() => {
                            setEditingConversationId(null);
                            setEditingName('');
                        }}
                        onDeleteClick={handleDeleteClick}
                        onConfirmDelete={() => void confirmDeleteChat()}
                        onCancelDelete={() => setDeletingConversationId(null)}
                    />
                </div>
            </div>
        </div>
    );
}
