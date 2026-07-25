"use client";
import "ag-grid-enterprise";
import {
  type ApiErrorResponse,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from '@/utils/exceptionHelper';
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
  type ChangeEvent,
} from "react";
import { AgGridReact } from "ag-grid-react";
import { Button } from "@/components/ui/button";
import {
  CalendarIcon,
  Cloud,
  CloudUpload,
  Columns,
  Download,
  LayoutGrid,
  Loader2,
  RefreshCcw,
  RotateCw,
  Save,
  SaveAll,
  Search,
  Upload,
  ChevronDown,
  Sparkles,
  X,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ColDef, themeQuartz } from "ag-grid-community";
import { ModuleRegistry } from "ag-grid-community";
import {
  ClientSideRowModelModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  MenuModule,
  RowGroupingModule,
  PivotModule,
  SetFilterModule,
  ExcelExportModule,
  RowGroupingPanelModule,
} from "ag-grid-enterprise";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import ShadTooltip from "@/components/ui/shadTooltipComponent";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import "./Summary.css";
import CustomTableData from "@/components/ui/CustomTableData";
import ForceMatchSuggestionsView from "./ForceMatchSuggestionsView";
import { AnalyticsAgingView } from "../action-center/analytics/AnalyticsAgingView";
import {
  getDashboardDataStreaming,
  getReconSourceColumns,
  getSummaryTable,
  saveChartTable,
  performReconciliationAction,
  downloadBulkForceMatchRecords,
  getStatementDates,
  getcycleWiseData
  , uploadBulkForceMatchRecords
} from "@/controllers/API/ReconcilationAPI";

type SummaryColumn = {
  key: string;
  header: string;
  visible: boolean;
  align?: 'left' | 'right' | 'center';
};

// Debounced, memoized comment box to isolate typing from parent re-renders
const CommentBox = memo(function CommentBox({
  initialValue,
  onCommit,
  placeholder,
  className,
  disabled,
}: {
  initialValue?: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState<string>(initialValue ?? '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(initialValue ?? '');
  }, [initialValue]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onCommit(local);
      timerRef.current = null;
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [local, onCommit]);

  return (
    <Textarea
      placeholder={placeholder}
      value={local}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      className={className}
      disabled={disabled}
    />
  );
});

// Fallback defaults if no data has been loaded yet. Actual columns come from API keys.
const DEFAULT_SUMMARY_COLUMNS: SummaryColumn[] = [];

/** flow_id is hidden by default in the summary table. */
const isFlowIdColumnKey = (key: string): boolean => {
  const n = key.toLowerCase().replace(/\s+/g, '_');
  return n === 'flow_id' || n === 'flowid';
};

const myCustomTheme = themeQuartz.withParams({
  backgroundColor: "#f8fafc",
  accentColor: "#2563eb",
  headerBackgroundColor: "#e0e7ff",
  panelBackgroundColor: "#e6f0ff",
});

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ColumnsToolPanelModule,
  FiltersToolPanelModule,
  RowGroupingPanelModule,
  MenuModule,
  RowGroupingModule,
  PivotModule,
  SetFilterModule,
  ExcelExportModule,
]);

const CountCell = ({ count, onClick, align }: { count: number; onClick?: () => void; align?: 'left' | 'right' | 'center' }) => (
  <TableCell
    className={`${align === 'center' ? 'text-center' : align === 'left' ? 'text-left' : 'text-right'} ${count > 0 ? "cursor-pointer hover:underline text-blue-600" : ""
      }`}
    onClick={count > 0 ? onClick : undefined}
  >
    {count}
  </TableCell>
);

let globalDashboardCache: {
  flowId: string;
  dashboardData: any[];
  dashboardSearchQuery: string;
  dashboardFilteredRowCount: number | null;
  dashboardDataClicked: boolean;
  lastDashboardParams: any;
  availableSources: string[];
  selectedSource: string | null;
  allRecords: boolean;
  showInsights: boolean;
  selectedRowsCount: number;
  selectedPreview: any[];
  selectedSummary: any[];
  selectedTotals: any;
  columnState: any;
  isBulkUploadShowing?: boolean;
} | null = null;

export function clearReconSummaryCache() {
  globalDashboardCache = null;
}

export function ReconSummary({ flowId }: { flowId: string }) {
  const gridApi = useRef<any>(null);
  const gridColumnApi = useRef<any>(null);
  const [showCards, setShowCards] = useState(false);
  const [summaryCards, setSummaryCards] = useState<any>(null);
  const [summaryTable, setSummaryTable] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any[]>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.dashboardData : []
  );
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.dashboardSearchQuery : ""
  );
  const [dashboardFilteredRowCount, setDashboardFilteredRowCount] = useState<number | null>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.dashboardFilteredRowCount : null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);
  const [dashboardDataClicked, setDashboardDataClicked] = useState(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.dashboardDataClicked : false
  );
  const [showPossibleMatches, setShowPossibleMatches] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [isBulkUploadShowing, setIsBulkUploadShowing] = useState<boolean>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? !!globalDashboardCache.isBulkUploadShowing : false
  );
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [groupedColumns, setGroupedColumns] = useState<string[]>([]);
  const [selectedRowsCount, setSelectedRowsCount] = useState<number>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.selectedRowsCount : 0
  );
  const [selectedPreview, setSelectedPreview] = useState<Array<{ source: string; ids: string[] }>>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.selectedPreview : []
  );
  const [selectedSummary, setSelectedSummary] = useState<Array<{ source: string; count: number; amount: number; dr: number; cr: number }>>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.selectedSummary : []
  );
  const [selectedTotals, setSelectedTotals] = useState<{ count: number; amount: number; dr: number; cr: number }>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.selectedTotals : { count: 0, amount: 0, dr: 0, cr: 0 }
  );
  // Controls for All Records / Choose Source
  const [allRecords, setAllRecords] = useState<boolean>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.allRecords : true
  );
  const [showInsights, setShowInsights] = useState<boolean>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? !!globalDashboardCache.showInsights : false
  );
  const [availableSources, setAvailableSources] = useState<string[]>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.availableSources : []
  );
  const [selectedSource, setSelectedSource] = useState<string | null>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.selectedSource : null
  );
  // Comments entered by user for actions
  const [commentsText, setCommentsText] = useState<string>("");
  // Summary table sort state (from CustomTableData)
  const [summarySort, setSummarySort] = useState<{ key: string | null; dir: 'asc' | 'desc' | null }>({ key: null, dir: null });

  // Download dialog state
  const [isDownloadDialogOpen, setIsDownloadDialogOpen] = useState(false);
  const [sourceColumns, setSourceColumns] = useState<Record<string, string[]>>({});
  const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({});
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<{
    unMatched: boolean;
    matched: boolean;
    twoWayMatch: boolean;
    forceMatchWithDrCr: boolean;
  }>({
    unMatched: false,
    matched: false,
    twoWayMatch: false,
    forceMatchWithDrCr: false,
  });

  // Statement date state - starts as undefined so stmt_date is empty string initially
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [rawStatementDates, setRawStatementDates] = useState<any[]>([]);
  const [loadingDates, setLoadingDates] = useState<boolean>(false);

  // Cycle wise state
  const [cycleWiseOptions, setCycleWiseOptions] = useState<string[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [loadingCycleWise, setLoadingCycleWise] = useState<boolean>(false);

  const formatDate = (d?: Date) => {
    if (!d) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const isLatestDateSelected = useCallback(() => {
    if (!date || availableDates.length === 0) return true;
    const formattedAvailable = availableDates.map(d => formatDate(d)).filter(Boolean);
    if (formattedAvailable.length === 0) return true;
    const latestFormattedDate = formattedAvailable.reduce((max, current) => current > max ? current : max, "");
    return formatDate(date) === latestFormattedDate;
  }, [date, availableDates]);

  // Summary table column state (for reorder + hide/show)
  const [summaryColumns, setSummaryColumns] = useState<SummaryColumn[]>(
    DEFAULT_SUMMARY_COLUMNS
  );

  // Column manager modal UI state (works on a temp copy)
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [tempColumns, setTempColumns] = useState<SummaryColumn[]>(DEFAULT_SUMMARY_COLUMNS);

  // Store last dashboard params for refresh
  const [lastDashboardParams, setLastDashboardParams] = useState<{
    source: string;
    operation: string;
    stmt_date: string;
  } | null>(() =>
    globalDashboardCache && globalDashboardCache.flowId === flowId ? globalDashboardCache.lastDashboardParams : null
  );

  // Payload with dynamic stmt_date and cycle_number
  const payload = useMemo(() => ({
    flow_id: flowId || '',
    stmt_date: formatDate(date),
    cycle_number: selectedCycle || undefined,
    is_select: false
  }), [flowId, date, selectedCycle]);

  // Find matching date object from getStatementDates response
  const matchingDateObj = useMemo(() => {
    const formatted = formatDate(date);
    if (!formatted || rawStatementDates.length === 0) return null;
    return rawStatementDates.find((item: any) => item?.stmt_date === formatted) || null;
  }, [date, rawStatementDates]);

  // Fetch available statement dates
  const fetchStatementDates = async () => {
    if (!flowId) return;
    setLoadingDates(true);
    try {
      const response = await getStatementDates({ flow_id: flowId });
      // Handle response - could be array directly or wrapped in data property
      const datesArray = Array.isArray(response) ? response : (response?.data || []);
      setRawStatementDates(datesArray);

      // Convert stmt_date strings to Date objects (set to midnight UTC to avoid timezone issues)
      const dates = datesArray
        .map((item: any) => {
          const dateStr = item.stmt_date;
          if (dateStr) {
            // Parse date string (format: "2025-12-01") and create Date at midnight UTC
            const [year, month, day] = dateStr.split('-').map(Number);
            const dateObj = new Date(Date.UTC(year, month - 1, day));
            if (!isNaN(dateObj.getTime())) {
              return dateObj;
            }
          }
          return null;
        })
        .filter((d: Date | null) => d !== null) as Date[];

      setAvailableDates(dates);
    } catch (error) {
      console.error('Failed to fetch statement dates:', error);
      setAvailableDates([]);
      setRawStatementDates([]);
    } finally {
      setLoadingDates(false);
    }
  };

  // Helper function to format cycle name (e.g., "cycle_1_01122025" -> "Cycle 1")
  const formatCycleName = (cycleString: string): string => {
    // Extract cycle number from string like "cycle_1_01122025" or "cycle_2_01122025"
    const match = cycleString.match(/cycle[_\s]*(\d+)/i);
    if (match && match[1]) {
      return `Cycle ${match[1]}`;
    }
    // Fallback: return original string if pattern doesn't match
    return cycleString;
  };

  // Fetch cycle wise data when date is selected
  const fetchCycleWiseData = async () => {
    if (!flowId || !date) {
      setCycleWiseOptions([]);
      setSelectedCycle("");
      return;
    }

    setLoadingCycleWise(true);
    try {
      const response = await getcycleWiseData({
        flow_id: flowId,
        stmt_date: formatDate(date)
      });

      // Handle response - could be array directly or wrapped in data property
      const cyclesArray = Array.isArray(response) ? response : (response?.data || []);

      if (cyclesArray && cyclesArray.length > 0) {
        // Store as array of strings (the API returns string array)
        setCycleWiseOptions(cyclesArray);
        // Auto-select last cycle (latest one, e.g., cycle 4) if none selected
        if (!selectedCycle && cyclesArray.length > 0) {
          const lastCycle = cyclesArray[cyclesArray.length - 1];
          setSelectedCycle(lastCycle);
        }
      } else {
        setCycleWiseOptions([]);
        setSelectedCycle("");
      }
    } catch (error) {
      console.error('Failed to fetch cycle wise data:', error);
      setCycleWiseOptions([]);
      setSelectedCycle("");
    } finally {
      setLoadingCycleWise(false);
    }
  };

  // Fetch statement dates when flowId changes
  useEffect(() => {
    fetchStatementDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  // Fetch cycle wise data when date changes
  useEffect(() => {
    fetchCycleWiseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, flowId]);

  // Function to check if a date is disabled (not in available dates)
  // Compares dates by their date string (YYYY-MM-DD) to avoid timezone issues
  const isDateDisabled = (date: Date) => {
    if (availableDates.length === 0) return false; // If no dates loaded, don't disable
    const dateStr = formatDate(date);
    return !availableDates.some(availableDate => formatDate(availableDate) === dateStr);
  };

  // Persist and load column settings
  const STORAGE_KEY = `recon_summary_columns_${flowId}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SummaryColumn[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSummaryColumns(parsed);
        }
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]);

  // Sync state to global dashboard cache
  useEffect(() => {
    if (flowId) {
      if (dashboardDataClicked) {
        let colState = globalDashboardCache?.columnState || null;
        if (gridApi.current) {
          try {
            colState = gridApi.current.getColumnState();
          } catch (e) {
            console.error("Failed to read columnState inside sync effect:", e);
          }
        }
        globalDashboardCache = {
          flowId,
          dashboardData,
          dashboardSearchQuery,
          dashboardFilteredRowCount,
          dashboardDataClicked,
          lastDashboardParams,
          availableSources,
          selectedSource,
          allRecords,
          showInsights,
          selectedRowsCount,
          selectedPreview,
          selectedSummary,
          selectedTotals,
          columnState: colState,
          isBulkUploadShowing,
        };
      } else {
        globalDashboardCache = null;
      }
    }
  }, [
    flowId,
    dashboardData,
    dashboardSearchQuery,
    dashboardFilteredRowCount,
    dashboardDataClicked,
    lastDashboardParams,
    availableSources,
    selectedSource,
    allRecords,
    showInsights,
    selectedRowsCount,
    selectedPreview,
    selectedSummary,
    selectedTotals,
    isBulkUploadShowing,
  ]);

  const clearGrouping = useCallback(() => {
    if (gridApi.current) {
      try {
        // Clear row group columns directly using the modern AG Grid API
        if (typeof gridApi.current.setRowGroupColumns === "function") {
          gridApi.current.setRowGroupColumns([]);
        } else if (gridColumnApi.current && typeof gridColumnApi.current.setRowGroupColumns === "function") {
          gridColumnApi.current.setRowGroupColumns([]);
        }

        // Apply column state to clear grouping and reset rowGroupIndex
        const columnState = gridApi.current.getColumnState();
        const newColumnState = columnState.map((col: any) => ({
          ...col,
          rowGroup: false,
          rowGroupIndex: null
        }));
        gridApi.current.applyColumnState({ state: newColumnState });

        // Clear groupings in the cache as well
        if (globalDashboardCache && globalDashboardCache.flowId === flowId) {
          globalDashboardCache.columnState = newColumnState;
        }
      } catch (e) {
        console.error("Failed to clear grouping:", e);
      }
    }
    setGroupedColumns([]);
  }, [flowId]);

  // Helper function to get original/full name from key
  const getOriginalName = (key: string): string => {
    const shortcuts: { [key: string]: string } = {
      'source_name': 'Source Name',
      'total_records': 'Total Records',
      'matched': 'Matched',
      'unmatched': 'Unmatched',
      'match_rate': 'Match Rate',
      'execution_time': 'Execution Time',
      'updated_at': 'Updated At',
      'created_at': 'Created At',
    };

    const lowerKey = key.toLowerCase();
    if (shortcuts[lowerKey]) {
      return shortcuts[lowerKey];
    }

    // Convert key to sentence case (only first letter capitalized)
    const words = key.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').filter(w => w.length > 0);
    const sentenceCase = words.join(' ').toLowerCase();
    return sentenceCase.charAt(0).toUpperCase() + sentenceCase.slice(1);
  };

  // Helper function to create short header names with first letter capitalized only
  const getShortHeader = (key: string): string => {
    const shortcuts: { [key: string]: string } = {
      'source_name': 'Source',
      'total_records': 'Total Records',
      'matched': 'Matched',
      'unmatched': 'Unmatched',
      'match_rate': 'Match %',
      'execution_time': 'Time',
      'updated_at': 'Updated',
      'created_at': 'Created',
    };

    const lowerKey = key.toLowerCase();

    // Handle special cases first (before shortcuts check)
    // Handle "execution date time" or "execution datetime" -> "execution time"
    if (lowerKey.includes('execution') && (lowerKey.includes('date') || lowerKey.includes('datetime'))) {
      return 'Execution time';
    }
    // Handle "unmatched count" -> "UM count"
    // Carry-forward unmatched -> show concise carry-forward label
    if (
      lowerKey.includes('carry') &&
      lowerKey.includes('forward') &&
      lowerKey.includes('unmatched') &&
      lowerKey.includes('amount')
    ) {
      return 'C.UM.A';
    }
    if (
      lowerKey.includes('carry') &&
      lowerKey.includes('forward') &&
      lowerKey.includes('unmatched') &&
      lowerKey.includes('count')
    ) {
      return 'C.UM.C';
    }
    // Total unmatched -> Total UM count / Total UM amount
    if (lowerKey.includes('total') && lowerKey.includes('unmatched') && lowerKey.includes('amount')) {
      return 'Total UM amount';
    }
    if (lowerKey.includes('total') && lowerKey.includes('unmatched') && lowerKey.includes('count')) {
      return 'Total UM count';
    }
    if (lowerKey.includes('unmatched') && lowerKey.includes('amount')) {
      return 'UM amount';
    }
    // Handle "unmatched count" -> "UM count"
    if (lowerKey.includes('unmatched') && lowerKey.includes('count')) {
      return 'UM count';
    }
    if (lowerKey.includes('force') && (lowerKey.includes('match') || lowerKey.includes('matched')) && lowerKey.includes('amount')) {
      return 'FM amount';
    }
    // Handle "force match count" or "force matched count" -> "FM count"
    if (lowerKey.includes('force') && (lowerKey.includes('match') || lowerKey.includes('matched')) && lowerKey.includes('count')) {
      return 'FM count';
    }

    // Check shortcuts after special cases
    if (shortcuts[lowerKey]) {
      return shortcuts[lowerKey];
    }

    // Convert key to sentence case (only first letter capitalized)
    const words = key.replace(/_/g, ' ').replace(/-/g, ' ').split(' ').filter(w => w.length > 0);
    const sentenceCase = words.join(' ').toLowerCase();
    const result = sentenceCase.charAt(0).toUpperCase() + sentenceCase.slice(1);

    // If the result is too long (more than 20 chars), use abbreviation
    if (result.length > 20) {
      // Create abbreviation: smart abbreviation for each word
      const abbreviation = words.map((w) => {
        const lowerW = w.toLowerCase();
        // Special handling for common words
        if (lowerW === 'carry') {
          return 'C';
        } else if (lowerW === 'forward') {
          return 'F';
        } else if (lowerW === 'matched') {
          return 'M';
        } else if (lowerW === 'unmatched') {
          return 'UM';
        } else if (lowerW === 'count') {
          return 'C';
        } else if (lowerW === 'reversal') {
          return 'R';
        } else if (lowerW === 'force') {
          return 'F';
        } else if (w.length > 6) {
          // For longer words, take first 2-3 letters
          return w.substring(0, Math.min(3, w.length)).toUpperCase();
        }
        return w.charAt(0).toUpperCase();
      }).join('.');

      // Limit abbreviation length to 15 characters
      return abbreviation.length > 15 ? abbreviation.substring(0, 15) : abbreviation;
    }

    return result;
  };

  // Helper function to calculate column width based on header length
  const getColumnWidth = (header: string): number => {
    const minWidth = 100;
    const maxWidth = 250;
    const charWidth = 8; // Approximate width per character

    // Calculate width based on header length
    const calculatedWidth = Math.max(minWidth, Math.min(maxWidth, header.length * charWidth + 20));

    return calculatedWidth;
  };

  // Helper function to format time as "X days ago", "X hours ago", etc.
  // Takes a UTC timestamp (2025-12-23T12:41:47.476476), converts it to IST (UTC + 5:30),
  // and returns an accurate human-friendly time-ago string like '5m ago', '2h 11m ago', '3d 4h ago',
  // ensuring no double UTC offset is applied.
  const timeAgo = (dateString: string): string => {
    if (!dateString) return 'N/A';

    try {
      // Parse UTC timestamp explicitly (treat as UTC, not local time)
      // Handle format: "2025-12-23T12:41:47.476476" or "2025-12-23T12:41:47"
      let utcTimestamp: number;

      if (dateString.includes('T')) {
        // ISO format - parse as UTC explicitly
        // If it already has timezone info (Z, +, or -), use as is
        // Otherwise, append 'Z' to indicate UTC
        let isoString = dateString.trim();
        const hasTimezone = isoString.endsWith('Z') ||
          isoString.includes('+') ||
          isoString.match(/[+-]\d{2}:\d{2}$/);

        if (!hasTimezone) {
          // No timezone info - treat as UTC by appending 'Z'
          isoString = isoString + 'Z';
        }

        // Parse as UTC timestamp
        const utcDate = new Date(isoString);

        // Check if date is valid
        if (isNaN(utcDate.getTime())) {
          return 'N/A';
        }

        // Get UTC timestamp in milliseconds (Date.getTime() returns UTC milliseconds)
        // This is the UTC timestamp regardless of local timezone
        utcTimestamp = utcDate.getTime();
      } else {
        // Fallback for other formats - try parsing as UTC
        const utcDate = new Date(dateString + ' UTC');
        if (isNaN(utcDate.getTime())) {
          return 'N/A';
        }
        utcTimestamp = utcDate.getTime();
      }

      // Convert UTC to IST: UTC + 5 hours 30 minutes = 5.5 hours = 19800000 milliseconds
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5:30 in milliseconds
      const istTimestamp = utcTimestamp + IST_OFFSET_MS;

      // Get current UTC time and convert to IST
      const nowUTC = Date.now(); // Current UTC timestamp in milliseconds
      const nowIST = nowUTC + IST_OFFSET_MS;

      // Calculate difference in milliseconds (both in IST, so difference is correct)
      const diffMs = nowIST - istTimestamp;

      // Handle future dates
      if (diffMs < 0) {
        return 'Just now';
      }

      const minutes = Math.floor(diffMs / (1000 * 60));
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);

      if (years > 0) {
        const remMonths = months % 12;
        return remMonths > 0 ? `${years}y ${remMonths}mo ago` : `${years}y ago`;
      }

      if (months > 0) {
        const remDays = days % 30;
        return remDays > 0 ? `${months}mo ${remDays}d ago` : `${months}mo ago`;
      }

      if (days > 0) {
        const remHours = hours % 24;
        return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
      }

      if (hours > 0) {
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
      }

      if (minutes > 0) {
        return `${minutes}m ago`;
      }

      return 'Just now';
    } catch (error) {
      return 'N/A';
    }
  };

  // Reconcile current/saved columns with API keys
  const inferAlign = (key: string): 'left' | 'right' | 'center' => {
    const k = key.toLowerCase();
    // center for date/time headings
    if (k.includes('date') || k.includes('time')) return 'center';
    // right-align numeric-like columns
    const rightHints = ['count', 'amount', 'total', 'rate', 'percentage', 'percent', 'id', 'qty', 'quantity'];
    if (rightHints.some(h => k.includes(h))) return 'right';
    return 'left';
  };

  // Update grouped columns from columnApi
  const refreshGroupedColumns = () => {
    if (!gridColumnApi.current) return;
    const groups = gridColumnApi.current
      .getRowGroupColumns()
      .map((c: any) => c.getColDef().headerName || c.getColDef().field);
    setGroupedColumns(groups);
  };

  // Handle drag-reorder of group chips
  const handleGroupChipDrop = (fromIdx: number, toIdx: number) => {
    if (!gridColumnApi.current) return;
    try {
      gridColumnApi.current.moveRowGroupColumn(fromIdx, toIdx);
      refreshGroupedColumns();
    } catch { }
  };
  /** Summary table keys that represent a cycle number field (hide when empty). */
  const isCycleNumberColumnKey = (key: string): boolean => {
    const n = key.toLowerCase().replace(/\s+/g, '_');
    return (
      n === 'cycle_number' ||
      n === 'cyclenumber' ||
      (n.includes('cycle') && n.includes('number'))
    );
  };

  const columnHasNonEmptyData = (rows: any[], colKey: string): boolean => {
    return rows.some((r) => {
      const v = r?.[colKey];
      if (v == null) return false;
      const s = String(v).trim();
      return s !== '' && s !== '-';
    });
  };

  const reconcileColumns = (apiKeys: string[], current: SummaryColumn[], rows?: any[]): SummaryColumn[] => {
    const currentMap = new Map(current.map(c => [c.key, c] as const));
    const result: SummaryColumn[] = [];
    apiKeys.forEach((k) => {
      const existing = currentMap.get(k);
      const isCycle = isCycleNumberColumnKey(k);
      const hasData = rows && rows.length > 0 ? columnHasNonEmptyData(rows, k) : false;

      const isFlowId = isFlowIdColumnKey(k);

      if (existing) {
        let visible = existing.visible;
        if (isCycle) visible = hasData ? existing.visible : false;
        result.push({ ...existing, header: getShortHeader(k), align: 'left', visible });
      } else {
        // Cycle number starts unchecked unless the column actually has values
        // flow_id starts unchecked by default
        const visible = isCycle ? hasData : isFlowId ? false : true;
        result.push({ key: k, header: getShortHeader(k), visible, align: 'left' });
      }
    });
    return result;
  };

  /** Map summary column key (e.g. unmatched_count) to operation bucket for actions UI. */
  const normalizeOperationKey = (colOrOp: string): string => {
    const l = (colOrOp || '').toLowerCase();
    if (l.includes('rollback') && (l.includes('waiting') || l.includes('awaiting'))) return 'rollback_waiting';
    if (l.includes('auth') && (l.includes('waiting') || l.includes('awaiting'))) return 'auth_waiting';
    if (l.includes('force') && l.includes('matched')) return 'force_matched';
    if (l.includes('carry') && l.includes('forward') && l.includes('unmatched')) return 'unmatched';
    if (l.includes('carry') && l.includes('forward') && l.includes('matched')) return 'matched';
    if (l.includes('unmatched')) return 'unmatched';
    if (l.includes('matched')) return 'matched';
    return l.replace(/\s+/g, '_');
  };

  // Helper: get source value from a row with dynamic key names
  const getSourceValue = (row: any): string | undefined => {
    if (!row || typeof row !== 'object') return undefined;
    // Prefer exact known keys to avoid picking unrelated columns like "Source Count"
    const keys = Object.keys(row);
    const exactOrder = [
      'SOURCE_NAME', 'source_name', 'Source_Name',
      'SOURCE', 'source', 'Source',
      'SOURCE NAME', 'source name', 'Source Name',
    ];
    const key = exactOrder.find((cand) => keys.includes(cand))
      ?? keys.find((k) => k.toLowerCase() === 'source_name')
      ?? keys.find((k) => k.toLowerCase() === 'source');
    return key ? String(row[key]) : undefined;
  };

  const normalizeColumnKey = (key: string): string =>
    key.toLowerCase().replace(/[\s_-]+/g, '');

  const isTotalRecordsColumnKey = (key: string): boolean => {
    const n = normalizeColumnKey(key);
    return n === 'totalrecords' || n === 'totalrecord';
  };

  const getRowColumnValue = (row: any, colKey: string): unknown => {
    if (!row || typeof row !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(row, colKey)) return row[colKey];
    const normalized = normalizeColumnKey(colKey);
    const matchedKey = Object.keys(row).find(
      (k) => normalizeColumnKey(k) === normalized,
    );
    return matchedKey ? row[matchedKey] : undefined;
  };

  const parseNumericCellValue = (value: unknown): number | null => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
      const trimmed = value.replace(/,/g, '').trim();
      if (trimmed === '') return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  // Helper: get statement date value from a row with dynamic key names
  const getStmtDateValue = (row: any): string | undefined => {
    if (!row || typeof row !== 'object') return undefined;
    const key = Object.keys(row).find((k) => {
      const lower = k.toLowerCase();
      return lower === 'statement date' || lower === 'stmt_date' || (lower.includes('statement') && lower.includes('date'));
    });
    return key ? String(row[key]) : undefined;
  };

  // Fetch source columns for download dialog
  const fetchSourceColumns = async () => {
    if (!flowId) {
      toast.error('Flow ID is missing. Please select a workflow.');
      return;
    }

    setIsLoadingColumns(true);
    try {
      const payload = {
        flow_id: flowId,
        stmt_date: formatDate(date),
        cycle_number: selectedCycle || undefined,
      };

      const response = await getReconSourceColumns(payload);
      // Accept response shapes:
      // 1) [{ SOURCE_matched: [...], SOURCE_unmatched: [...], _conditions: [...] }]
      // 2) { SOURCE: [...], _conditions: [...] }
      // 3) { status, data: [...] | {...} }
      const raw = response && typeof response === 'object' && 'data' in (response as any)
        ? (response as any).data
        : response;

      const firstObject = Array.isArray(raw)
        ? (raw.find((item) => item && typeof item === 'object' && !Array.isArray(item)) ?? null)
        : (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null);

      if (firstObject && typeof firstObject === 'object') {
        const normalized: Record<string, string[]> = {};

        Object.entries(firstObject as Record<string, any>).forEach(([key, value]) => {
          if (!Array.isArray(value)) return;

          if (key === '_conditions') {
            normalized._conditions = value.map(String);
            return;
          }

          // Convert keys like ALP_FILTER_DATA_matched / ALP_FILTER_DATA_unmatched -> ALP_FILTER_DATA
          const baseSource = key.replace(/_(matched|unmatched)$/i, '');
          if (!normalized[baseSource]) normalized[baseSource] = [];

          const merged = new Set<string>([...normalized[baseSource], ...value.map(String)]);
          normalized[baseSource] = Array.from(merged);
        });

        setSourceColumns(normalized);

        // Initialize selected columns - all unchecked by default
        setSelectedColumns({});

        // Don't expand sources by default - keep collapsed
        setExpandedSources(new Set());
      } else {
        toast.error('Failed to load source columns');
      }
    } catch (error: any) {
      console.error('Failed to fetch source columns:', error);
      toast.error(getDisplayErrorMessage(error, 'Failed to load source columns'));
    } finally {
      setIsLoadingColumns(false);
    }
  };

  // Format date-time values to only Year-Month-Date (e.g., 2025-11-26)
  const formatExecDateTime = (value: any): string => {
    if (!value) return '';
    const str = String(value).replace('T', ' ').trim();
    // Some backends return fractional seconds; remove them for display
    const cleaned = str.replace(/\.(\d+)$|Z$/i, '');
    const d = new Date(cleaned);
    if (isNaN(d.getTime())) return str; // fallback if parsing fails
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    return `${yyyy}-${mm}-${dd}`;
  };

  const fetchSummaryData = async (useEmptyPayload = false) => {
    // Validate: If cycle wise data exists, cycle must be selected (unless using empty payload)
    if (!useEmptyPayload && date && cycleWiseOptions.length > 0 && !selectedCycle) {
      toast.error('Please select a cycle');
      return;
    }

    setLoading(true);
    try {
      // Use empty payload if requested (for initial page load)
      const apiPayload = useEmptyPayload
        ? { flow_id: flowId, stmt_date: "", cycle_number: undefined, is_select: false }
        : payload;

      const response = await getSummaryTable(apiPayload);
      // API returns { status, message, data: SummaryTableRow[] }; use .data for table rows
      const rows: any[] = response && typeof response === 'object' && 'data' in response
        ? (Array.isArray((response as { data?: any[] }).data) ? (response as { data: any[] }).data : [])
        : (Array.isArray(response) ? response : []);
      const isSuccess = response && ((response as { status?: boolean }).status === true || Array.isArray((response as { data?: any[] }).data));
      if (isSuccess) {
        setSummaryTable(rows);
        // Pre-populate available sources from summary table if possible
        if (Array.isArray(rows) && rows.length > 0) {
          const srcs = Array.from(
            new Set(
              rows
                .map((r: any) => getSourceValue(r))
                .filter((v: any) => v !== undefined && v !== null && String(v).trim() !== "")
                .map((v: any) => String(v))
            )
          ) as string[];
          if (srcs.length > 0) {
            setAvailableSources(srcs.sort());
          }
        }
        if (rows.length > 0) {
          const apiKeys = Object.keys(rows[0]);
          // Try to use saved columns, else current state, else build fresh from API keys
          let base = summaryColumns && summaryColumns.length > 0 ? summaryColumns : [];
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              const parsed: SummaryColumn[] = JSON.parse(saved);
              if (Array.isArray(parsed)) base = parsed;
            }
          } catch { }
          const reconciled = reconcileColumns(apiKeys, base, rows);
          setSummaryColumns(reconciled);
        }
      }
    } catch (error) {
      console.error("Error fetching summary table:", error);
      toast.error(getDisplayErrorMessage(error, "Failed to refresh summary table"));
    } finally {
      setLoading(false);
    }
  };



  // Initial page load: Call APIs with empty values
  useEffect(() => {
    if (flowId) {
      fetchSummaryData(true); // Pass true to use empty payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]); // Only run once when flowId is available

  // Refetch when date or cycle changes
  useEffect(() => {
    // Don't fetch while cycle data is loading
    if (loadingCycleWise) {
      return;
    }

    // Skip if no date selected (initial load is handled separately)
    if (!date) {
      return;
    }

    // Only fetch if date is selected and (no cycle data exists OR cycle is selected)
    const canFetch = cycleWiseOptions.length === 0 || selectedCycle;

    if (canFetch) {
      fetchSummaryData(false); // Use normal payload with date and cycle

      // If dashboard is active, refetch dashboard data with new date/cycle
      if (isBulkUploadShowing) {
        setIsBulkUploadShowing(false);
        setDashboardData([]);
        setDashboardDataClicked(false);
      } else if (dashboardDataClicked && lastDashboardParams) {
        fetchDashboardData(
          lastDashboardParams.source,
          lastDashboardParams.operation
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedCycle, cycleWiseOptions.length, loadingCycleWise]); // Refetch when date or cycle changes

  // Refresh summary table (first refresh button)
  const handleRefreshSummary = () => {
    fetchSummaryData(false); // Use normal payload
  };

  const fetchDashboardData = async (
    source: string,
    operation: string,
    opts?: { allRecordsOverride?: boolean; sourceOverride?: string | null }
  ) => {
    const effectiveAllRecords = opts?.allRecordsOverride ?? allRecords;
    const effectiveSource =
      opts && 'sourceOverride' in opts
        ? opts.sourceOverride
        : effectiveAllRecords
          ? ''
          : (selectedSource || source || '');

    const dashboardPayload = {
      flow_id: payload.flow_id,
      stmt_date: formatDate(date),
      cycle_number: payload.cycle_number,
      payload: {
        // Send operation EXACTLY as clicked (same behavior as `Summary.tsx`)
        operation,
        source_name: effectiveAllRecords ? '' : (effectiveSource || ''),
        all_records: effectiveAllRecords,
        // limit: 100000,
        // offset: 0,
      },
    };

    try {
      setLoadingDashboard(true);
      setDashboardDataClicked(true);
      setIsBulkUploadShowing(false);

      const response = await getDashboardDataStreaming(dashboardPayload);

      // Parse the Response object as JSON
      const raw = await response.json();
      let rows: any[] = [];

      // Backend returned {status:true, data:[...]}
      if (raw?.status === true) {
        rows = raw.data || [];
      }
      // Backend returned a plain array [...]
      else if (Array.isArray(raw)) {
        rows = raw;
      }
      // Invalid response
      else {
        console.error("Invalid dashboard response:", raw);
        setDashboardData([]);
        setDashboardSearchQuery("");
        setDashboardFilteredRowCount(null);
        return;
      }

      rows = rows.map((row: any) => ({ ...row, visible: true }));

      setDashboardData(rows);
      setDashboardSearchQuery("");
      setDashboardFilteredRowCount(rows.length);

      // Source list handling
      if (effectiveAllRecords) {
        let srcs = Array.from(new Set(rows.map((r) => getRowSource(r)).filter(Boolean)));

        if (srcs.length === 0 && summaryTable.length > 0) {
          srcs = Array.from(new Set(summaryTable.map((r) => getSourceValue(r)).filter(Boolean)));
        }

        if (srcs.length > 0) {
          setAvailableSources(srcs);
        }
      }

      setLastDashboardParams({ source, operation, stmt_date: formatDate(date) });
    } catch (err) {
      console.error("Dashboard Load Error:", err);
      toast.error(getDisplayErrorMessage(err, "Failed to load dashboard data"));
      setDashboardData([]);
      setDashboardSearchQuery("");
      setDashboardFilteredRowCount(null);
    } finally {
      setLoadingDashboard(false);
    }
  };


  const getSelectedRecords = () => {
    if (!gridApi.current) return;

    // Get selected nodes (not only rows)
    const selectedNodes = gridApi.current.getSelectedNodes();

    // Filter only real data rows (leaf nodes)
    const dataRows = selectedNodes
      .filter((node) => !node.group) // ignore group rows
      .map((node) => node.data);

    if (dataRows.length === 0) {
      console.log("No actual data rows selected");
      return null;
    }

    // Group selected IDs by source -> { [source]: string[] }
    const grouped: Record<string, string[]> = {};
    for (const row of dataRows) {
      const id = row.SYSTEM_REF_ID;
      if (!id) continue;
      const src = (row.SOURCE_NAME) as string;
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(String(id));
    }

    // Convert to array of objects: [{ sourceA: [ids] }, { sourceB: [ids] }]
    const records: Array<Record<string, string[]>> = Object.entries(grouped).map(
      ([src, ids]) => ({ [src]: ids })
    );

    return records;
  };

  // Helpers to detect source and amount keys in dashboard rows
  const getRowSource = (row: any): string | undefined => {
    if (!row) return undefined;
    const keys = Object.keys(row);
    // Strict preference order to avoid matching columns like "Source Count"
    const exactOrder = [
      'SOURCE_NAME', 'source_name', 'Source_Name',
      'SOURCE', 'source', 'Source',
      'SOURCE NAME', 'source name', 'Source Name',
    ];
    const key = exactOrder.find((cand) => keys.includes(cand))
      ?? keys.find((k) => k.toLowerCase() === 'source_name')
      ?? keys.find((k) => k.toLowerCase() === 'source');
    return key ? String(row[key]) : undefined;
  };
  const getRowAmount = (row: any): number => {
    if (!row) return 0;
    // Only consider the explicit dc_amount field (case-insensitive). Do NOT fall back to other amount-like fields.
    const key = Object.keys(row).find((k) => k.toLowerCase() === 'dc_amount');
    if (!key) return 0;
    const raw = row[key];
    // If it's already a number, return directly
    if (typeof raw === 'number') return raw;
    // Normalize strings: remove currency symbols, commas, and whitespace. Handle parentheses as negative.
    let s = String(raw ?? '').trim();
    if (!s) return 0;
    const isParen = /^\(.*\)$/.test(s);
    // Remove everything except digits, dot, minus, and parentheses (we handle parentheses separately)
    s = s.replace(/[^0-9.\-()]/g, '');
    if (isParen) {
      s = s.replace(/[()]/g, '');
      s = '-' + s;
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const getRowDR = (row: any): number => {
    if (!row) return 0;
    const keys = Object.keys(row);
    const drKey = keys.find(k => {
      const l = k.toLowerCase();
      return l === 'dr' || l === 'debit' || l === 'dr_amount' || l === 'debit_amount' || (l.includes('dr') && l.includes('amount'));
    });
    if (!drKey) return 0;
    const v = row[drKey];
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  const getRowCR = (row: any): number => {
    if (!row) return 0;
    const keys = Object.keys(row);
    const crKey = keys.find(k => {
      const l = k.toLowerCase();
      return l === 'cr' || l === 'credit' || l === 'cr_amount' || l === 'credit_amount' || (l.includes('cr') && l.includes('amount'));
    });
    if (!crKey) return 0;
    const v = row[crKey];
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return isNaN(n) ? 0 : n;
  };

  const clearDashboardSelection = () => {
    setSelectedPreview([]);
    setSelectedSummary([]);
    setSelectedTotals({ count: 0, amount: 0, dr: 0, cr: 0 });
    setSelectedRowsCount(0);
    setCommentsText("");

    if (gridApi.current) {
      const api = gridApi.current.api || gridApi.current;
      if (api) {
        if (typeof api.deselectAll === 'function') {
          try { api.deselectAll(); } catch (e) { /* ignore */ }
        }
        if (typeof api.forEachNode === 'function') {
          try {
            api.forEachNode((node: any) => {
              try { if (typeof node.setSelected === 'function') node.setSelected(false); } catch { };
            });
          } catch (e) { /* ignore */ }
        }
      }
    }
  };

  // Generalized action performer for selected rows
  const performAction = async (action: 'force_match' | 'rollback' | 'cancel' | 'authorize' | 'reject') => {
    if (action === 'cancel') {
      clearDashboardSelection();
      return;
    }

    if (action === 'force_match' && date && !isLatestDateSelected()) {
      toast.info("Force Match is allowed only for the latest reconciliation date.");
      return;
    }

    const records = getSelectedRecords();
    if (!records) return;

    const payload = {
      flow_id: flowId,
      operation: isBulkUploadShowing ? 'unmatched' : normalizeOperationKey(lastDashboardParams?.operation || ''),
      comments: commentsText?.trim() || "",
      stmt_date: formatDate(date),
      cycle_number: selectedCycle || undefined,
      records,
    };

    try {
      const result = await performReconciliationAction(action, payload);
      const succeeded = result?.status !== false;
      const message =
        (typeof result?.message === 'string' && result.message.trim()) ||
        (succeeded ? 'Action completed successfully' : 'Action failed');

      if (succeeded) {
        toast.success(message);
        clearDashboardSelection();
        fetchSummaryData();
        if (isBulkUploadShowing) {
          setIsBulkUploadShowing(false);
          setDashboardData([]);
          setDashboardDataClicked(false);
        } else if (lastDashboardParams) {
          await fetchDashboardData(
            lastDashboardParams.source,
            lastDashboardParams.operation,
          );
        }
      } else {
        toast.info(message);
      }
    } catch (e: any) {
      const message =
        e?.response?.data?.message || e?.message || 'Action failed';
      toast.info(message);
    }
  };

  const handleCellClick = async (
    source: string,
    operation: string,
    stmt_date: string,
    value: number
  ) => {
    if (value === 0) return;
    const effectiveAllRecords = allRecords;
    const effectiveSource = effectiveAllRecords ? '' : source;

    setAllRecords(effectiveAllRecords);
    setSelectedSource(effectiveAllRecords ? null : source);

    fetchDashboardData(
      effectiveSource,
      operation,
      { allRecordsOverride: effectiveAllRecords, sourceOverride: effectiveSource }
    );
  };

  // Refresh dashboard table (second refresh button)
  const handleRefreshDashboard = () => {
    if (lastDashboardParams) {
      fetchDashboardData(lastDashboardParams.source, lastDashboardParams.operation,);
    } else {
      toast.info("No dashboard data to refresh. Click on a cell in the summary table first.");
    }
  };

  const updateDashboardFilteredCount = useCallback(() => {
    const api = gridApi.current;
    if (!api?.forEachNodeAfterFilter) return;
    let count = 0;
    api.forEachNodeAfterFilter((node: { group?: boolean }) => {
      if (!node.group) count += 1;
    });
    setDashboardFilteredRowCount(count);
  }, []);

  const handleDashboardSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDashboardSearchQuery(value);
    gridApi.current?.setGridOption?.("quickFilterText", value);
  };

  const onExportCSV = () => {
    if (gridApi.current) {
      const hasSelection = gridApi.current.getSelectedNodes().some((n: any) => !n.group);
      gridApi.current.exportDataAsCsv({ fileName: "dashboard_data.csv", onlySelected: hasSelection });
    } else {
      toast.error("Grid API not ready yet");
    }
  };

  const onExportExcel = () => {
    if (gridApi.current) {
      const hasSelection = gridApi.current.getSelectedNodes().some((n: any) => !n.group);
      gridApi.current.exportDataAsExcel({
        fileName: "dashboard_data.xlsx",
        sheetName: "Dashboard",
        exportMode: "xlsx",
        onlySelected: hasSelection,
      });
    } else {
      toast.error("Grid API not ready yet");
    }
  };

  const checkboxColumn: any = {
    headerName: "",
    // Show checkbox only for leaf rows (not group rows)
    checkboxSelection: true,
    // Header checkbox should select all leaf rows
    headerCheckboxSelection: true,

    width: 50,
    maxWidth: 50,
    pinned: "left" as "left",
    sortable: false,
    filter: false,
    resizable: false,
    suppressMenu: true,
    suppressMovable: false,
    lockPosition: false,
    suppressColumnsToolPanel: true,
    cellStyle: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
  };

  // Visible columns for summary table (used in rendering)
  const visibleSummaryColumns = summaryColumns.filter((c) => c.visible);
  const autoGroupColumnDef = {
    minWidth: 200,
    cellRendererParams: {
      suppressCount: false,
    },
  };

  const tabledata = useMemo(() => {
    return selectedSummary.map((row, idx) => ({
      id: idx,
      source: row.source,
      count: row.count,
      amount: row.amount,
    }));
  }, [selectedSummary]);
  const previewColumns = useMemo(() => {
    return [
      { key: 'source', header: 'Source', align: 'left' as const },
      { key: 'count', header: 'No. of Transaction', align: 'left' as const },
      { key: 'amount', header: 'Amount', align: 'right' as const },
    ];
  }, []);

  // Build columns for the top Summary table to be rendered via CustomTableData
  const summaryCTDColumns = useMemo(() => {
    return visibleSummaryColumns.map((c) => {
      const originalName = getOriginalName(c.key);
      const isAbbreviated = c.header !== originalName;
      const columnWidth = getColumnWidth(c.header);

      return {
        key: c.key,
        header: (
          isAbbreviated ? (
            <ShadTooltip content={originalName}>
              <span className="text-sm" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                {c.header}
              </span>
            </ShadTooltip>
          ) : (
            <span className="text-sm" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
              {c.header}
            </span>
          )
        ),
        align: (c.align ?? 'left') as 'left' | 'center' | 'right',
        sortable: true,
        filterable: false,
        TruncateData: false,
      };
    });
  }, [visibleSummaryColumns]);

  // Build data for the top Summary table; keep previous formatting rules + clickable numbers
  const summaryCTDData = useMemo(() => {
    return summaryTable.map((row, idx) => {
      const record: any = { id: idx };
      visibleSummaryColumns.forEach((colDef) => {
        const col = colDef.key;
        const value = getRowColumnValue(row, col);

        // total_records should always render the numeric count (including 0)
        if (isTotalRecordsColumnKey(col)) {
          const numericValue = parseNumericCellValue(value);
          record[col] = (
            <span className="text-sm font-normal">{numericValue ?? 0}</span>
          );
          return;
        }

        // NA for empty
        if (value === null || value === undefined || value === "") {
          record[col] = <span className="text-sm font-normal">NA</span>;
          return;
        }

        // Execution time formatting - handle various date/time column names and formats
        const colLower = col.toLowerCase().replace(/_/g, '').replace(/\s/g, '');
        const isExecutionTime = colLower.includes('executiontime') ||
          colLower.includes('execution') ||
          colLower.includes('updatedat') ||
          colLower.includes('createdat') ||
          colLower.includes('timestamp') ||
          colLower.includes('datetime');

        // Check if value is a date string (ISO format like "2025-12-15T07:50:30.156238")
        const isDateString = typeof value === 'string' && (
          value.includes('T') || // ISO format
          /^\d{4}-\d{2}-\d{2}/.test(value) || // Date format
          !isNaN(Date.parse(value)) // Valid date string
        );

        if (isExecutionTime && isDateString) {
          record[col] = <span className="text-sm font-normal">{timeAgo(value)}</span>;
          return;
        }

        // Match rate formatting
        const isMatchRate = col.toLowerCase().includes('match') && col.toLowerCase().includes('rate');
        if (isMatchRate) {
          record[col] = <span className="text-sm font-normal">{typeof value === 'number' ? `${value.toFixed(2)}%` : String(value)}</span>;
          return;
        }

        // Source column formatting - capitalize first letter only
        const isSourceColumn = col.toLowerCase() === 'source_name' ||
          col.toLowerCase() === 'source' ||
          colLower.includes('sourcename');
        if (isSourceColumn && typeof value === 'string') {
          const formattedValue = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
          record[col] = <span className="text-sm font-normal">{formattedValue}</span>;
          return;
        }

        // Numeric: clickable if > 0
        const numericValue = parseNumericCellValue(value);
        if (numericValue !== null) {
          if (numericValue > 0) {
            const normalizedCol = col.toLowerCase().replace(/[_\s]/g, "");
            const isAmountColumn =
              normalizedCol.includes("amount") ||
              /(^|[_\s])amt([_\s]|$)/i.test(col);
            const isClickable = !isAmountColumn;
            record[col] = (
              <span
                className={
                  isClickable
                    ? "text-sm font-normal text-blue-600 cursor-pointer hover:underline"
                    : "text-sm font-normal text-foreground cursor-default"
                }
                onClick={
                  isClickable
                    ? () =>
                      handleCellClick(
                        getSourceValue(row) || "",
                        col,
                        getStmtDateValue(row) || "",
                        numericValue,
                      )
                    : undefined
                }
              >
                {numericValue}
              </span>
            );
          } else {
            record[col] = <span className="text-sm font-normal">{numericValue}</span>;
          }
          return;
        }

        // Default text
        record[col] = <span className="text-sm font-normal">{String(value)}</span>;
      });
      return record;
    });
  }, [summaryTable, visibleSummaryColumns]);

  // Calculate dynamic table height based on row count
  const tableHeight = useMemo(() => {
    // Header: ~40px, Each row: ~40px, Padding: ~20px
    const rowCount = summaryCTDData.length;
    const headerHeight = 40;
    const rowHeight = 40;
    const padding = 20;
    const minHeight = headerHeight + (2 * rowHeight) + padding; // Minimum for 2 rows (140px)
    const calculatedHeight = headerHeight + (rowCount * rowHeight) + padding;
    const maxHeight = 170; // Maximum height

    // Use calculated height, but clamp between min and max
    const finalHeight = Math.max(minHeight, Math.min(calculatedHeight, maxHeight));
    return `h-[${finalHeight}px]`;
  }, [summaryCTDData.length]);

  if (showPossibleMatches) {
    return (
      <ForceMatchSuggestionsView
        flowId={flowId}
        stmtDate={formatDate(date)}
        cycleNumber={selectedCycle}
        flowRunId={matchingDateObj?.flow_run_id || summaryTable[0]?.flow_run_id}
        executionNumber={matchingDateObj?.execution_number || summaryTable[0]?.execution_number}
        onBack={() => setShowPossibleMatches(false)}
      />
    );
  }

  return (
    <div className="p-0 w-full">
      {/* Header with buttons */}
      <header className="flex items-center justify-between px-0 py-0 pb-1 border-gray-200 bg-background m-1 mb-0">
        <h1 className="text-sm font-semibold text-gray-800">
          <span className="text-lg font-semibold">Operations</span>
        </h1>
        <div className="flex items-center gap-2">
          {/* Select Cycle */}
          {/* <div className="relative w-60 ">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search "
              className="pl-9 h-8"
              // value={searchQuery}
              // onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div> */}
          {/* Cycle Wise Dropdown */}
          <ShadTooltip
            content={
              date && !isLatestDateSelected()
                ? "Force Match Suggestions are disabled when an older Statement Date is selected"
                : "Force Match Suggestions"
            }
          >
            <Button
              variant="default"
              className="!h-7 text-xs !px-2 disabled:cursor-not-allowed"
              onClick={() => setShowPossibleMatches(true)}
              disabled={!!date && !isLatestDateSelected()}
            >
              < Sparkles className="!h-3.5 !w-3.5" />
              {/* Force Match Suggestions */}
            </Button>
          </ShadTooltip>
          <ShadTooltip content={!date ? "Select a date first" : cycleWiseOptions.length > 0 ? "Select Cycle" : "No cycle data available for selected date"}>
            <Select
              value={selectedCycle}
              onValueChange={(value) => setSelectedCycle(value)}
              disabled={!date || cycleWiseOptions.length === 0 || loadingCycleWise}
            >
              <SelectTrigger className="w-[110px] !h-7 text-xs">
                {loadingCycleWise ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Loading...</span>
                  </div>
                ) : cycleWiseOptions.length > 0 ? (
                  <SelectValue placeholder="Select Cycle" />
                ) : (
                  <span className="text-muted-foreground">No Cycle</span>
                )}
              </SelectTrigger>
              <SelectContent className="!text-xs !min-w-[60px]">
                {cycleWiseOptions.map((cycle: string) => (
                  <SelectItem key={cycle} value={cycle}>
                    {formatCycleName(cycle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ShadTooltip>
          {/* Refresh Button - FIRST REFRESH (Summary Table) */}
          <ShadTooltip content="Refresh Summary Table">
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-gray-100"
              onClick={handleRefreshSummary}
              disabled={loading}
            >
              <RefreshCcw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </ShadTooltip>

          {/* Statement Date Calendar */}
          <ShadTooltip content="Select Statement Date">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="hover:bg-gray-100 h-7 w-7"
                >
                  <CalendarIcon className="h-4 w-4 cursor-pointer" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-auto !mr-20 p-0 rounded-md bg-white shadow-md"
                style={{ border: '1px solid rgb(209, 213, 219)' }}>
                <style>{`
                  .custom-calendar .rdp-day_selected,
                .custom-calendar .rdp-day[data-selected="true"] {
                  background: transparent !important; /* remove grey */
                }

                /* Selected day button */
                .custom-calendar .rdp-day_selected button,
                .custom-calendar .rdp-day[data-selected="true"] button,
                .custom-calendar button[data-selected-single="true"] {
                  background-color:#0370f1!important;      /* BLUE like your screenshot */
                  color: white !important;                   /* White text */
                  font-weight: 600 !important;
                  border-radius: 10px !important;             /* rounded square like screenshot */
                  border: none !important;
                  box-shadow: none !important;
                }

                /* Remove focus ring */
                .custom-calendar .rdp-day button:focus-visible {
                  outline: none !important;
                  box-shadow: none !important;
                }

                `}</style>
                <Calendar
                  mode="single"
                  selected={date}
                  fromYear={new Date().getFullYear() - 10}
                  toYear={new Date().getFullYear()}
                  captionLayout="dropdown"
                  onSelect={(newDate) => {
                    if (newDate) {
                      setDate(newDate);
                      setSelectedCycle(""); // Reset cycle when date changes
                    }
                  }}
                  disabled={isDateDisabled}
                  initialFocus
                  className="custom-calendar"
                />
              </PopoverContent>
            </Popover>
          </ShadTooltip>
          {/* View columns & reorder (for SUMMARY TABLE) */}
          <ShadTooltip content="View columns and reorder columns">
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-gray-100 h-7 w-7"
              onClick={() => {
                setTempColumns(summaryColumns);  // work on a copy
                setShowColumnManager(true);
              }}
            >
              <Columns className="h-4 w-4 cursor-pointer" />
            </Button>
          </ShadTooltip>

          {/* Save settings (persist to localStorage and backend with is_select: true) */}
          <ShadTooltip content="Save settings">
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-gray-100 h-7 w-7"
              onClick={async () => {
                try {
                  // Save immediately to localStorage
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(summaryColumns));

                  const activeSortCol = summarySort.key || "u";
                  const activeSortDir = summarySort.dir || "asc";

                  const data = summaryColumns.map((col, index) => {
                    const hasPositive = summaryTable.some(r => typeof r[col.key] === "number" && r[col.key] > 0);

                    return {
                      header: col.key,
                      columnDef: col.header.toLowerCase(),
                      order: index,
                      visible: col.visible,
                      isHyperlink: hasPositive,
                      isSort: true
                    };
                  });

                  const savePayload = {
                    flow_id: flowId,
                    table_id: "summary table",
                    settings: {
                      gFilter: [],
                      sortoptions: {
                        active: activeSortCol,
                        direction: activeSortDir,
                      },
                    },
                    data
                  };

                  const res = (await saveChartTable(savePayload)) as ApiErrorResponse;

                  // Log response for debugging
                  console.log('Save table response:', res);
                  console.log('Response status:', res?.status, typeof res?.status);

                  // Check multiple possible response structures
                  const isSuccess = res?.status === true ||
                    res?.status === 'true' ||
                    String(res?.status) === 'true' ||
                    (res && !res?.error);

                  if (isSuccess) {
                    toast.success(
                      (typeof res?.message === 'string' && res.message) || 'Settings saved',
                    );
                    fetchSummaryData();   // <-- THIS refreshes summary table
                  } else {
                    console.error('Save failed - Full response:', res);
                    toast.error(resolveApiErrorMessage(res, 'Failed to save settings on server'));
                  }

                } catch (e) {
                  console.error(e);
                  toast.error(getDisplayErrorMessage(e, 'Failed to save settings'));
                }
              }}
            >
              <Save className="h-4 w-4 cursor-pointer" />
            </Button>
          </ShadTooltip>
          {/* <Button
          onClick={() => {
            if (!showCards) {
              // Only fetch when SHOWING cards
              fetchSummaryCards();
            }
            setShowCards(!showCards);
          }}
          variant="outline"
          className="mb-0 !h-7 !w-32"
        >
          {showCards ? "Hide Summary" : "Show Summary"}
        </Button> */}
        </div>
      </header>

      {/* Summary cards */}
      <div>
        {showCards && (
          <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-2 w-full">
            {["total_records", "matched", "unmatched", "match_rate"].map(
              (key, idx) => (
                <div
                  key={idx}
                  className="
                    bg-white dark:bg-gray-900 text-center h-20 p-2 flex flex-col justify-center items-center shadow-sm rounded-md border
                    transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="text-sm font-bold">
                    {key.replace("_", " ").toUpperCase()}
                  </div>
                  <div
                    className={`text-xl font-bold ${key === "matched"
                      ? "text-green-600"
                      : key === "unmatched"
                        ? "text-red-600"
                        : key === "match_rate"
                          ? "text-purple-600"
                          : "text-blue-600"
                      }`}
                  >
                    {loading
                      ? "..."
                      : key === "match_rate"
                        ? `${summaryCards?.[key] ?? 0}%`
                        : summaryCards?.[key] ?? 0}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
      {/* <div className="border rounded-md shadow-sm overflow-hidden mt-0"> */}

      {/* <ScrollArea className="h-[120px] w-[82vw]">
    <div className="min-w-max overflow-x-auto overflow-y-auto">
      <Table className="table-auto">
            <TableHeader>
              <TableRow className="sticky top-0 z-10">
                {visibleSummaryColumns.map((colDef, index) => (
                  <TableHead
                    key={colDef.key}
                    className={` py-2 whitespace-normal break-words ${index === 0
                      ? 'text-left'
                      : colDef.align === 'center'
                        ? 'text-center'
                        : colDef.align === 'right'
                          ? 'text-right'
                          : 'text-left'} font-semibold,`}
                  >
                    {colDef.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader> */}

      {/* ---------- Dynamic Rows (respects order + visibility) ---------- */}
      {/* <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleSummaryColumns.length || 1}
                    className="px-4 py-2 text-left whitespace-normal break-words"
                  >
                    Loading...
                  </TableCell>
                </TableRow>
              ) : summaryTable.length > 0 ? (
                summaryTable.map((row, idx) => (
                  <TableRow key={idx} >
                    {visibleSummaryColumns.map((colDef, colIndex) => {
                        const col = colDef.key;
                        const value = row[col];

                        // ------ Show NA for null/undefined/empty ------
                        if (value === null || value === undefined || value === "") {
                        return (
                            <TableCell
                            key={col}
                            className="text-center text-gray-500 !px-6"
                            >
                            NA
                            </TableCell>
                        );
                        } */}

      {/* // ------ Match Rate Formatting ------
                        // ------ Match Rate style columns (e.g., "Match Rate (%)") ------ */}
      {/* const isMatchRate = col.toLowerCase().includes('match') && col.toLowerCase().includes('rate');
                        if (isMatchRate) {
                          return (
                            <TableCell
                            key={col}
                            className="text-right"
                            >
                            {typeof value === 'number' ? `${value.toFixed(2)}%` : String(value)}
                            </TableCell>
                          );
                        }

                        // ------ Execution Date Time formatting ------
                        const isExecutionDateTime = (() => {
                          const l = col.toLowerCase();
                          return l.includes('execution') && (l.includes('date') );
                        })();
                        if (isExecutionDateTime) {
                          return (
                            <TableCell key={col} className={colIndex === 0 ? 'text-left' : 'text-left'}>
                              {formatExecDateTime(value)}
                            </TableCell>
                          );
                        } */}

      {/* // ------ Numeric columns: use CountCell ------ */}
      {/* if (typeof value === "number") {
                          return (
                            <CountCell
                            key={col}
                            count={value}
                            align={colIndex === 0 ? 'left' : (colDef.align ?? 'left')}
                            onClick={() => handleCellClick(
                              getSourceValue(row) || '',
                              mapOperationFromColumn(col),
                              getStmtDateValue(row) || '',
                              value
                            )}
                            />
                          );
                        } */}

      {/* // ------ Default Text rendering ------ */}
      {/* return (
                          <TableCell
                            key={col}
                            className={`${colIndex === 0
                              ? 'text-left'
                              : colDef.align === 'center'
                                ? 'text-center'
                                : colDef.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'}`}
                          >
                            {value}
                          </TableCell>
                        );
                        
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleSummaryColumns.length || 1}
                    className="text-center py-6"
                  >
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
            </div>
            
        </ScrollArea> */}
      {/* </div> */}

      <div className="border rounded-md shadow-sm mt-2 mb-2">
        <style>{`
          /* Ensure scrollbars are always visible for summary table */
          .summary-table-container {
            overflow-x: auto;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #cbd5e1 #f1f5f9;
            scrollbar-gutter: stable;
          }
          .summary-table-container::-webkit-scrollbar {
            width: 8px;
            height: 8px;
            -webkit-appearance: none;
            display: block;
          }
          .summary-table-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
            display: block;
          }
          .summary-table-container::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
            -webkit-appearance: none;
            min-height: 20px;
            min-width: 20px;
          }
          .summary-table-container::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
          .summary-table-container::-webkit-scrollbar-corner {
            background: #f1f5f9;
          }
        `}</style>
        <div className="summary-table-container">
          <CustomTableData
            data={summaryCTDData}
            columns={summaryCTDColumns as any}
            rowKey="id"
            scrollHeightClass={tableHeight}
            HorizontalScroll={true}
            showSpinnerFlag={loading}
            spinnerLabel="Loading..."
            onSortChange={(key, dir) => {
              setSummarySort({ key, dir: (dir === 'asc' || dir === 'desc') ? dir : null });
            }}
          />
        </div>
      </div>

      {/* ---------------- BOTTOM CONTROLS (unchanged) ---------------- */}
      <div className="py-2 border-gray-700">
        <div className="flex items-end gap-4 flex-wrap">
          <Button
            variant="outline"
            className="bg-transparent border-gray-600 text-gray-300 gap-2 !h-8"
            onClick={() => {
              if (date && !isLatestDateSelected()) {
                toast.info("Force Match is allowed only for the latest reconciliation date.");
                return;
              }
              setIsBulkDialogOpen(true);
            }}
          >
            <CloudUpload className="h-4 w-4" />
            Bulk Upload
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-[#333] hover:bg-[#444] text-blue-400 !h-8 w-10 border border-gray-600"
            onClick={() => {
              setIsDownloadDialogOpen(true);
              fetchSourceColumns();
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
          <div className="flex-1 max-w-md">
            <CommentBox
              initialValue={commentsText}
              onCommit={(v) => setCommentsText(v)}
              placeholder="Comments*"
              className="bg-transparent text-black focus:border-blue-500 min-h-[31px] resize-none  px-2 py-1"
            />
          </div>


          {/* <Button className="bg-blue-500 text-white !h-8 px-6">
           Rollback
          </Button>
          <Button className="bg-red-600 text-white !h-8 px-6">
           Cancel
          </Button> */}
          <div className="w-auto">
            <Select
              key={allRecords ? 'source-select-all-records' : 'source-select-by-source'}
              value={
                allRecords || selectedSource == null || selectedSource === ''
                  ? undefined
                  : selectedSource
              }
              onValueChange={(v) => {
                // Selecting a source disables All Records and reloads (avoid race by passing overrides)
                setAllRecords(false);
                setSelectedSource(v);
                if (lastDashboardParams) {
                  fetchDashboardData(
                    v,
                    lastDashboardParams.operation,
                    { allRecordsOverride: false, sourceOverride: v }
                  );
                }
              }}
              disabled={allRecords || !dashboardDataClicked}
            >
              <SelectTrigger className="!h-8">
                <SelectValue placeholder={allRecords ? 'All Records' : 'Choose Source'} />
              </SelectTrigger>
              <SelectContent>
                {availableSources.length === 0 ? (
                  <div className="px-2 py-1 text-xs text-muted-foreground">No sources</div>
                ) : (
                  availableSources.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="all-records"
              checked={allRecords}
              onCheckedChange={(c) => {
                const v = !!c;
                setAllRecords(v);
                if (v) {
                  setSelectedSource(null);
                  if (lastDashboardParams) {
                    fetchDashboardData(
                      '',
                      lastDashboardParams.operation,
                      { allRecordsOverride: true, sourceOverride: '' }
                    );
                  }
                } else if (selectedSource && lastDashboardParams) {
                  fetchDashboardData(
                    selectedSource,
                    lastDashboardParams.operation,
                    { allRecordsOverride: false, sourceOverride: selectedSource }
                  );
                }
              }}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white"
            />
            <label
              htmlFor="all-records"
              className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              All Records
            </label>
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="insights"
              checked={showInsights}
              onCheckedChange={(c) => {
                const v = !!c;
                setShowInsights(v);
                if (v) {
                  clearDashboardSelection();
                }
              }}
              className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-white"
            />
            <label
              htmlFor="insights"
              className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Insights
            </label>
          </div>
          {/* Context-aware actions based on selected summary metric - only show when checkboxes are selected */}
          <div className="ml-auto flex justify-end">
            {selectedRowsCount > 0 && (() => {
              if (isBulkUploadShowing) {
                return (
                  <div className="flex gap-2">
                    <Button className="bg-blue-500 text-white !h-8 px-2" onClick={() => performAction('force_match')}>Force Match</Button>
                    <Button className="bg-red-600 text-white !h-8 px-2" onClick={() => performAction('cancel')}>Cancel</Button>
                  </div>
                );
              }
              const op = normalizeOperationKey(lastDashboardParams?.operation || '');
              if (op === 'matched') {
                return (
                  <div className="flex gap-2">
                    <Button className="bg-blue-500 text-white !h-8 px-2" onClick={() => performAction('rollback')}>Rollback</Button>
                    <Button className="bg-red-600 text-white !h-8 px-2" onClick={() => performAction('cancel')}>Cancel</Button>
                  </div>
                );
              }
              if (op === 'unmatched' || op === 'force_matched') {
                return (
                  <div className="flex gap-2">
                    <Button className="bg-blue-500 text-white !h-8 px-2" onClick={() => performAction('force_match')}>Force Match</Button>
                    <Button className="bg-red-600 text-white !h-8 px-2" onClick={() => performAction('cancel')}>Cancel</Button>
                  </div>
                );
              }
              if (op === 'auth_waiting' || op === 'rollback_waiting') {
                return (
                  <div className="flex gap-2">
                    <Button className="bg-green-600 text-white !h-8 px-2" onClick={() => performAction('authorize')}>Authorize</Button>
                    <Button className="bg-red-600 text-white !h-8 px-2" onClick={() => performAction('reject')}>Reject</Button>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
        {/* Selected preview summary */}
        {selectedRowsCount > 0 && (
          <div className="mt-3 border rounded-md overflow-hidden">

            {/* <CustomTableData
              data={tabledata}
              columns={previewColumns as any}
              rowKey="id"
              scrollHeightClass="max-h-[100px] max-w-[500px]"
              emptyState={<div className="p-8 text-center text-slate-500">No data Available</div>}
              spinnerLabel="Loading..."
              HorizontalScroll
            /> */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Source</TableHead>
                  <TableHead className="text-left">No. of Transaction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">DR</TableHead>
                  <TableHead className="text-right">CR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedSummary.map((row, idx) => (
                  <TableRow key={`sel-sum-${idx}`}>
                    <TableCell className="text-left">{row.source}</TableCell>
                    <TableCell className="text-left">{row.count}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{row.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{row.dr.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-semibold">{row.cr.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="text-left font-semibold">Total</TableCell>
                  <TableCell className="text-left font-semibold">{selectedTotals.count}</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{selectedTotals.amount.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">{selectedTotals.dr.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">{selectedTotals.cr.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ---------------- DASHBOARD (AG GRID) or INSIGHTS ---------------- */}
      {showInsights ? (
        <div className="shadow-sm bg-background">
          <AnalyticsAgingView
            flowId={flowId}
            dateFilter={{ mode: 'all' }}
            hideTopCardsAndBars={true}
          />
        </div>
      ) : (
        (loadingDashboard || dashboardData.length > 0 || dashboardDataClicked) && (
          <div className="border rounded-md shadow-sm">
            {loadingDashboard ? (
              <div className="flex flex-col items-center gap-3 p-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading Dashboard details...</p>
              </div>
            ) : dashboardData.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <p className="text-red-600">No data available</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 border-t flex items-center justify-between text-sm text-gray-300 bg-background">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col justify-center">
                      <span className="text-xs text-foreground flex items-center gap-1.5 flex-wrap">
                        Total Row(s) Count : {dashboardData.length}
                        {isBulkUploadShowing && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            Bulk Uploaded Records
                          </span>
                        )}
                      </span>
                      {dashboardSearchQuery.trim() && dashboardFilteredRowCount !== null && (
                        <span className="text-xs text-foreground">
                          Filtered Row Count : {dashboardFilteredRowCount}
                        </span>
                      )}
                    </div>
                    <div className="relative w-60 shrink-0">
                      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search"
                        value={dashboardSearchQuery}
                        onChange={handleDashboardSearchChange}
                        className="h-8 w-full pl-9 text-sm leading-none border focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <ShadTooltip content="Refresh Dashboard Table">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full text-blue-400 h-7 w-7 transition-colors"
                        onClick={handleRefreshDashboard}
                        disabled={loadingDashboard || !lastDashboardParams}
                      >
                        <RefreshCcw className={`h-3 w-3 ${loadingDashboard ? 'animate-spin' : ''}`} />
                      </Button>
                    </ShadTooltip>
                  </div>
                  <div className="flex items-center gap-3">
                    {groupedColumns.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors gap-1 px-2.5 font-medium text-xs rounded-full"
                        onClick={clearGrouping}
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear Grouping
                      </Button>
                    )}

                    <Checkbox className="h-5 w-5 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    <span className="text-sm text-foreground ">Download Selected Only</span>


                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="rounded-full h-7 w-7 text-blue-400 "
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={onExportCSV}>
                          📄 Download CSV
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={onExportExcel}>
                          📘 Download Excel
                        </DropdownMenuItem>


                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div
                  className={`dashboard-grid-container flex-grow h-[540px] bg-background ${document.documentElement.classList.contains("dark")
                    ? "ag-theme-quartz-dark"
                    : "ag-theme-quartz"
                    }`}
                >
                  <AgGridReact
                    rowHeight={35}
                    headerHeight={35}
                    ref={gridApi}
                    rowData={dashboardData}
                    quickFilterText={dashboardSearchQuery}
                    onFilterChanged={updateDashboardFilteredCount}
                    onModelUpdated={updateDashboardFilteredCount}
                    suppressMovableColumns={false}
                    rowDragManaged={true}
                    suppressDragLeaveHidesColumns={true}
                    suppressMaintainUnsortedOrder={true}
                    allowDragFromColumnsToolPanel={true}
                    groupDisplayType="multipleColumns"
                    autoGroupColumnDef={autoGroupColumnDef}
                    rowGroupPanelShow="always"
                    // When a group's checkbox is clicked, select/deselect all children
                    groupSelectsChildren={true}
                    groupSelectsFiltered={true}

                    rowSelection="multiple"
                    getRowId={(params) => params.data.SYSTEM_REF_ID}
                    columnDefs={
                      dashboardData.length > 0
                        ? [
                          checkboxColumn,
                          ...(function () {
                            const keys = Object.keys(dashboardData[0]);
                            const hasDcAmount = keys.some(k => k.toLowerCase() === 'dc_amount');
                            return keys.map((key) => {
                              const lower = key.toLowerCase();
                              const isAmountLike = lower === 'dc_amount' || lower === 'amount' || lower.endsWith('_amount');
                              return {
                                field: key,
                                headerName: key, // Show exactly as it comes from API response
                                sortable: true,
                                filter: true,
                                resizable: true,
                                width: 150,
                                enableRowGroup: true,
                                enableValue: true,
                                hide: hasDcAmount && lower === 'amount',
                                valueFormatter: isAmountLike
                                  ? (p: any) => {
                                    if (p.value == null) return '';
                                    const v = typeof p.value === 'number' ? p.value : parseFloat(String(p.value));
                                    return isNaN(v) ? '' : v.toFixed(2);
                                  }
                                  : undefined,
                              } as any;
                            });
                          })(),
                        ]
                        : []
                    }
                    defaultColDef={{
                      resizable: true,
                      sortable: true,
                      filter: true,
                      minWidth: 150,
                      filterParams: {
                        buttons: ['apply', 'reset'],
                        closeOnApply: true,
                        applyMiniFilterWhileTyping: false,
                        defaultToNothingSelected: true,
                      },
                    }}
                    pivotMode={false}
                    onSelectionChanged={() => {
                      if (!gridApi.current) return;
                      const selectedNodes = gridApi.current.getSelectedNodes();
                      const rows = selectedNodes.filter((n: any) => !n.group).map((n: any) => n.data);
                      setSelectedRowsCount(rows.length);
                      // Build summary by source
                      const groups: Record<string, { count: number; amount: number; dr: number; cr: number }> = {};
                      for (const r of rows) {
                        const src = getRowSource(r) || 'Unknown';
                        const amt = getRowAmount(r);
                        const dr = getRowDR(r);
                        const cr = getRowCR(r);
                        if (!groups[src]) groups[src] = { count: 0, amount: 0, dr: 0, cr: 0 };
                        groups[src].count += 1;
                        groups[src].amount += amt;
                        groups[src].dr += dr;
                        groups[src].cr += cr;
                      }
                      const summary = Object.entries(groups).map(([source, v]) => ({ source, count: v.count, amount: v.amount, dr: v.dr, cr: v.cr }));
                      setSelectedSummary(summary);

                      const totalsCount = summary.reduce((acc, s) => acc + s.count, 0);
                      const totalsDr = summary.reduce((acc, s) => acc + (s.dr || 0), 0);
                      const totalsCr = summary.reduce((acc, s) => acc + (s.cr || 0), 0);

                      // Amount logic: if all selected records are from the same source -> sum amounts.
                      // If multiple sources exist -> total amount = first source amount - sum(other sources amounts).
                      let totalAmount = 0;
                      if (summary.length === 1) {
                        totalAmount = summary[0].amount || 0;
                      } else if (summary.length > 1) {
                        const first = summary[0].amount || 0;
                        const rest = summary.slice(1).reduce((acc, s) => acc + (s.amount || 0), 0);
                        totalAmount = first - rest;
                      }

                      setSelectedTotals({ count: totalsCount, amount: totalAmount, dr: totalsDr, cr: totalsCr });
                    }}
                    sideBar={{
                      toolPanels: [
                        {
                          id: "columns",
                          labelDefault: "Columns",
                          labelKey: "columns",
                          iconKey: "columns",
                          toolPanel: "agColumnsToolPanel",
                        },
                        {
                          id: "filters",
                          labelDefault: "Filters",
                          labelKey: "filters",
                          iconKey: "filter",
                          toolPanel: "agFiltersToolPanel",
                        },
                      ],
                    }}
                    animateRows={true}
                    pagination={true}
                    paginationPageSize={20}
                    paginationPageSizeSelector={[10, 20, 50, 100]}
                    onGridReady={(params) => {
                      gridApi.current = params.api;
                      gridColumnApi.current = (params as any).columnApi;
                      // Keep sidebar visible but closed (collapsed) by default
                      params.api.setSideBarVisible(true);
                      params.api.closeToolPanel();
                      if (dashboardSearchQuery) {
                        params.api.setGridOption("quickFilterText", dashboardSearchQuery);
                      }
                      updateDashboardFilteredCount();

                      // Restore column state (grouping/sorting/width) from cache if available
                      if (globalDashboardCache && globalDashboardCache.flowId === flowId && globalDashboardCache.columnState) {
                        try {
                          params.api.applyColumnState({
                            state: globalDashboardCache.columnState,
                            applyOrder: true,
                          });
                        } catch (e) {
                          console.error("Failed to restore column state in onGridReady:", e);
                        }
                      }

                      try {
                        const columnState = params.api.getColumnState();
                        const groups = columnState
                          .filter((col: any) => col.rowGroup)
                          .map((col: any) => col.colId);
                        setGroupedColumns(groups);
                      } catch (e) {
                        console.error("Failed to read column state in onGridReady:", e);
                      }
                    }}
                    onColumnRowGroupChanged={(params) => {
                      try {
                        const columnState = params.api.getColumnState();
                        const groups = columnState
                          .filter((col: any) => col.rowGroup)
                          .map((col: any) => col.colId);
                        setGroupedColumns(groups);

                        // Save updated column state to cache immediately
                        if (globalDashboardCache && globalDashboardCache.flowId === flowId) {
                          globalDashboardCache.columnState = columnState;
                        }
                      } catch (e) {
                        console.error("Failed to read column state in onColumnRowGroupChanged:", e);
                      }
                    }}
                  // onSelectionChanged={handleSelectionChange}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      {/* ------------- BULK UPLOAD DIALOG ------------- */}
      <Dialog
        open={isBulkDialogOpen}
        onOpenChange={(open) => {
          setIsBulkDialogOpen(open);
          if (!open) setBulkFile(null);
        }}
      >
        <DialogContent className="sm:max-w-[520px] p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Bulk Upload File
            </DialogTitle>
          </DialogHeader>

          {/* Drag & Drop Section */}
          <div
            className="border-2 border-dashed border-gray-400 rounded-lg h-48 
                 flex flex-col items-center justify-center bg-gray-50 cursor-pointer"
            onClick={() => document.getElementById("bulk-file-input")?.click()}
          >
            <Upload className="h-8 w-8 text-gray-500 mb-2" />

            <p className="text-base font-medium text-gray-700">
              Drag & drop CSV or Excel file here
            </p>

            <p className="text-sm text-gray-600 mt-1">
              or{" "}
              <span className="text-blue-600 font-semibold underline cursor-pointer">
                browse file
              </span>{" "}
              from device (.csv/.xlsx)
            </p>
            <input
              id="bulk-file-input"
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Show selected file */}
          {bulkFile && (
            <p className="text-sm text-muted-foreground mt-2">
              Selected: <span className="font-semibold">{bulkFile.name}</span>
            </p>
          )}

          {/* Footer Buttons */}
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkDialogOpen(false);
                setBulkFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!bulkFile}
              onClick={async () => {
                if (!bulkFile) {
                  toast.info("Please select a file to upload");
                  return;
                }

                if (!flowId) {
                  toast.error('Flow ID is missing. Please select a workflow.');
                  return;
                }

                if (date && !isLatestDateSelected()) {
                  toast.info("Force Match is allowed only for the latest reconciliation date.");
                  setIsBulkDialogOpen(false);
                  setBulkFile(null);
                  return;
                }

                try {
                  const payload = {
                    flow_id: flowId,
                    stmt_date: formatDate(date),
                    cycle_number: selectedCycle || undefined,
                    match_records: true,
                    file: bulkFile,
                  };

                  const uploadResponse = await uploadBulkForceMatchRecords(payload as any);

                  const rows = Array.isArray(uploadResponse)
                    ? uploadResponse
                    : Array.isArray((uploadResponse as any)?.data)
                      ? (uploadResponse as any).data
                      : [];

                  const rowsWithVisibility = rows.map((row: any) => ({ ...row, visible: true }));

                  setDashboardData(rowsWithVisibility);
                  setIsBulkUploadShowing(true);
                  setDashboardDataClicked(true);
                  setDashboardSearchQuery("");
                  setDashboardFilteredRowCount(rowsWithVisibility.length);
                  setSelectedPreview([]);
                  setSelectedSummary([]);
                  setSelectedTotals({ count: 0, amount: 0, dr: 0, cr: 0 });

                  if (gridApi.current) {
                    const apiRef = gridApi.current.api || gridApi.current;
                    try {
                      apiRef.deselectAll();
                    } catch { }
                  }

                  toast.success(rowsWithVisibility.length > 0
                    ? `Loaded ${rowsWithVisibility.length} row(s) into table.`
                    : 'Upload succeeded, but no data rows found.');

                  setIsBulkDialogOpen(false);
                  // keep bulkFile if you want the button to remain visible elsewhere
                } catch (error: any) {
                  console.error('Upload failed:', error);
                  toast.error(getDisplayErrorMessage(error, 'File upload failed'));
                }
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------- DOWNLOAD COLUMNS DIALOG ------------- */}
      <Dialog
        open={isDownloadDialogOpen}
        onOpenChange={(open) => {
          setIsDownloadDialogOpen(open);
          if (!open) {
            setSelectedColumns({});
            setSelectedConditions([]);
            setExpandedSources(new Set());
            setSelectedStatus({
              unMatched: false,
              matched: false,
              twoWayMatch: false,
              forceMatchWithDrCr: false,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                Select Columns
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex">
            {/* Left Side - Source Names and Columns */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingColumns ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {Object.keys(sourceColumns)
                    .filter((source) => source !== '_conditions')
                    .map((source) => {
                      const columns = sourceColumns[source] || [];
                      const isExpanded = expandedSources.has(source);
                      const selectedCols = selectedColumns[source] || [];

                      return (
                        <div key={source} className="border rounded-lg bg-white dark:bg-gray-800">
                          <div
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                            onClick={() => {
                              const newExpanded = new Set(expandedSources);
                              if (isExpanded) {
                                newExpanded.delete(source);
                              } else {
                                newExpanded.add(source);
                              }
                              setExpandedSources(newExpanded);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                Source Name: {source}
                              </span>
                            </div>
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </div>

                          {isExpanded && (
                            <div className="border-t p-3 space-y-2 max-h-[300px] overflow-y-auto">
                              {columns.map((column) => {
                                const isSelected = selectedCols.includes(column);
                                return (
                                  <div
                                    key={column}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const newSelected = { ...selectedColumns };
                                        if (!newSelected[source]) {
                                          newSelected[source] = [];
                                        }
                                        if (checked) {
                                          if (!newSelected[source].includes(column)) {
                                            newSelected[source].push(column);
                                          }
                                        } else {
                                          newSelected[source] = newSelected[source].filter(
                                            (c) => c !== column
                                          );
                                        }
                                        setSelectedColumns(newSelected);
                                      }}
                                    />
                                    <label className="text-sm cursor-pointer">
                                      {column}
                                    </label>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Conditions Section */}
                  {sourceColumns._conditions && (
                    <div className="border rounded-lg bg-white dark:bg-gray-800">
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => {
                          const newExpanded = new Set(expandedSources);
                          if (expandedSources.has('_conditions')) {
                            newExpanded.delete('_conditions');
                          } else {
                            newExpanded.add('_conditions');
                          }
                          setExpandedSources(newExpanded);
                        }}
                      >
                        <span className="text-sm font-medium">
                          Source Name: _conditions
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${expandedSources.has('_conditions') ? 'rotate-180' : ''}`}
                        />
                      </div>

                      {expandedSources.has('_conditions') && (
                        <div className="border-t p-3 space-y-2">
                          {sourceColumns._conditions.map((condition) => {
                            const isSelected = selectedConditions.includes(condition);
                            return (
                              <div
                                key={condition}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedConditions([
                                        ...selectedConditions,
                                        condition,
                                      ]);
                                    } else {
                                      setSelectedConditions(
                                        selectedConditions.filter((c) => c !== condition)
                                      );
                                    }
                                  }}
                                />
                                <label className="text-sm cursor-pointer">
                                  {condition}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right Side - Status Options */}
            <div className="w-64 border-l p-4 bg-gray-50 dark:bg-gray-900">
              <div className="space-y-3">
                <div className="text-sm font-semibold mb-3">Status</div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-unmatched"
                    checked={selectedStatus.unMatched}
                    onCheckedChange={(checked) =>
                      setSelectedStatus((prev) => ({ ...prev, unMatched: !!checked }))
                    }
                  />
                  <label htmlFor="status-unmatched" className="text-sm cursor-pointer">
                    UnMatched
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-matched"
                    checked={selectedStatus.matched}
                    onCheckedChange={(checked) =>
                      setSelectedStatus((prev) => ({ ...prev, matched: !!checked }))
                    }
                  />
                  <label htmlFor="status-matched" className="text-sm cursor-pointer">
                    Matched
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-two-way"
                    checked={selectedStatus.twoWayMatch}
                    onCheckedChange={(checked) =>
                      setSelectedStatus((prev) => ({ ...prev, twoWayMatch: !!checked }))
                    }
                  />
                  <label htmlFor="status-two-way" className="text-sm cursor-pointer">
                    Two way match
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="status-force-match"
                    checked={selectedStatus.forceMatchWithDrCr}
                    onCheckedChange={(checked) =>
                      setSelectedStatus((prev) => ({ ...prev, forceMatchWithDrCr: !!checked }))
                    }
                  />
                  <label htmlFor="status-force-match" className="text-sm cursor-pointer">
                    Forcematch with Dr/Cr
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsDownloadDialogOpen(false);
                setSelectedColumns({});
                setSelectedConditions([]);
                setSelectedStatus({
                  unMatched: false,
                  matched: false,
                  twoWayMatch: false,
                  forceMatchWithDrCr: false,
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!flowId) {
                  toast.error('Flow ID is missing. Please select a workflow.');
                  return;
                }

                // Build source_columns array with source_name and columns structure
                const sourceColumnsArray: Array<{ source_name: string; columns: string[] }> = [];
                Object.keys(selectedColumns).forEach((source) => {
                  const cols = selectedColumns[source] || [];
                  if (cols.length > 0) {
                    sourceColumnsArray.push({
                      source_name: source,
                      columns: cols,
                    });
                  }
                });

                // Build payload
                const payload = {
                  flow_id: flowId,
                  stmt_date: formatDate(date) || '',
                  cycle_number: selectedCycle || undefined,
                  source_columns: sourceColumnsArray,
                  is_unmatched: selectedStatus.unMatched,
                  is_matched: selectedStatus.matched,
                };

                try {
                  const response = await downloadBulkForceMatchRecords(payload);

                  // Create a blob from the response
                  const blob = new Blob([response.data]);
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;

                  // Try to get filename from response headers
                  const contentDisposition = response.headers['content-disposition'];
                  let filename = 'download.xlsx';
                  if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                    if (filenameMatch) {
                      filename = filenameMatch[1];
                    }
                  }

                  link.setAttribute('download', filename);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);

                  toast.success('Download started successfully');

                  // Close dialog and reset state
                  setIsDownloadDialogOpen(false);
                  setSelectedColumns({});
                  setSelectedConditions([]);
                  setSelectedStatus({
                    unMatched: false,
                    matched: false,
                    twoWayMatch: false,
                    forceMatchWithDrCr: false,
                  });
                } catch (error: any) {
                  console.error('Download failed:', error);
                  toast.error(getDisplayErrorMessage(error, 'Download failed'));
                }
              }}
            >
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------- COLUMN MANAGER MODAL (SUMMARY TABLE) ------------- */}
      {showColumnManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white shadow-lg rounded-md w-96 p-4">
            <h2 className="text-lg font-semibold mb-3">Manage Summary Columns</h2>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tempColumns.map((col, index) => (
                <div
                  key={col.key}
                  className="flex items-center gap-3 p-2 border rounded cursor-move bg-gray-50"
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("col-index", index.toString())
                  }
                  onDrop={(e) => {
                    const from = Number(e.dataTransfer.getData("col-index"));
                    const to = index;
                    const updated = [...tempColumns];
                    const temp = updated[from];
                    updated[from] = updated[to];
                    updated[to] = temp;
                    setTempColumns(updated);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Checkbox
                    checked={col.visible}
                    onCheckedChange={(checked) => {
                      const updated = [...tempColumns];
                      updated[index].visible = !!checked;
                      setTempColumns(updated);
                    }}
                  />
                  <span className="text-sm">{col.header}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  // discard changes
                  setShowColumnManager(false);
                  setTempColumns(summaryColumns);
                }}
              >
                Close
              </Button>

              <Button
                onClick={() => {
                  // Apply changes immediately to runtime state
                  setSummaryColumns(tempColumns);
                  setShowColumnManager(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
