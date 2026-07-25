"use client";
import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { flushSync } from 'react-dom';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, SizeColumnsToContentStrategy } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
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
} from 'ag-grid-enterprise';
import { Button } from '@/components/ui/button';
import { Loader2, Download, CloudUpload, Upload, ChevronDown, Copy, CalendarIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  getReconSourceColumns,
  getDashboardDataStreaming,
  bulkUploadForceMatch,
  uploadBulkForceMatchRecords,
  downloadBulkForceMatchRecords,
  getSummaryTable,
  performReconciliationAction,
  getStatementDates,
  getcycleWiseData
} from '@/controllers/API/ReconcilationAPI';
import {
  ApiRequestError,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from '@/utils/exceptionHelper';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import ShadTooltip from '@/components/ui/shadTooltipComponent';
import "../Reconcilationtab/Summary.css";

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

const statusTabs = [
  { id: 'matched', label: 'Matched', badge: null },
  { id: 'unmatched', label: 'Unmatched', badge: null },
  { id: 'auth-waiting', label: 'Auth waiting', badge: null },
  { id: 'rollback-waiting', label: 'Rollback waiting', badge: null },
];

interface OperationsTabProps {
  workflowId?: string;
  selectedWorkflow?: any;
}

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // sync from parent when it changes (e.g., cleared after submit)
  useEffect(() => {
    setLocal(initialValue ?? '');
  }, [initialValue]);

  // commit debounced
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
      onChange={(e: any) => setLocal(e.target?.value ?? '')}
      onBlur={() => onCommit(local)}
      className={className}
      disabled={disabled}
    />
  );
});

export default function OperationsTab({ workflowId, selectedWorkflow }: OperationsTabProps) {
  const [dashboardOperation, setDashboardOperation] = useState('matched');
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasFirstDataRef = useRef<boolean>(false);
  const pendingChunksRef = useRef<any[]>([]);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentDataLengthRef = useRef<number>(0);
  const [operationCounts, setOperationCounts] = useState<{
    matched: number;
    unmatched: number;
    'auth-waiting': number;
    'rollback-waiting': number;
  }>({
    matched: 0,
    unmatched: 0,
    'auth-waiting': 0,
    'rollback-waiting': 0,
  });
  const gridApi = useRef<any>(null);
  const gridColumnApi = useRef<any>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [selectedRowsCount, setSelectedRowsCount] = useState<number>(0);
  const [commentsText, setCommentsText] = useState<string>("");
  const [allRecords, setAllRecords] = useState<boolean>(true);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<Array<{ source: string; count: number; amount: number; dr: number; cr: number }>>([]);
  const [selectedTotals, setSelectedTotals] = useState<{ count: number; amount: number; dr: number; cr: number }>({ count: 0, amount: 0, dr: 0, cr: 0 });
  const [selectedRowsData, setSelectedRowsData] = useState<any[]>([]);
  const [downloadSelectedOnly, setDownloadSelectedOnly] = useState<boolean>(false);
  const [lastDashboardParams, setLastDashboardParams] = useState<{
    source: string;
    operation: string;
    stmt_date: string;
  } | null>(null);
  const lastFetchRef = useRef<{ operation: string; workflowId: string | undefined; date?: string; cycle?: string } | null>(null);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
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
    if (!workflowId || !date) {
      setCycleWiseOptions([]);
      setSelectedCycle("");
      return;
    }

    setLoadingCycleWise(true);
    try {
      const response = await getcycleWiseData({
        flow_id: workflowId,
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

  // Fetch available statement dates
  const fetchStatementDates = async () => {
    if (!workflowId) return;
    setLoadingDates(true);
    try {
      const response = await getStatementDates({ flow_id: workflowId });
      // Handle response - could be array directly or wrapped in data property
      const datesArray = Array.isArray(response) ? response : (response?.data || []);

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
    } finally {
      setLoadingDates(false);
    }
  };

  // Function to check if a date is disabled (not in available dates)
  // Compares dates by their date string (YYYY-MM-DD) to avoid timezone issues
  const isDateDisabled = (date: Date) => {
    if (availableDates.length === 0) return false; // If no dates loaded, don't disable
    const dateStr = formatDate(date);
    return !availableDates.some(availableDate => formatDate(availableDate) === dateStr);
  };

  // Helper to get source from row (for dashboard data)
  const getRowSource = (row: any): string | undefined => {
    if (!row) return undefined;
    const key = Object.keys(row).find(k => {
      const l = k.toLowerCase();
      return l === 'source_name' || l === 'source' || l === 'sourcename' || l.includes('source');
    });
    return key ? String(row[key]) : undefined;
  };

  // Helper to get amount from row - prioritize dc_amount
  const getRowAmount = (row: any): number => {
    if (!row) return 0;
    const keys = Object.keys(row);

    // First, try to find exact dc_amount (case-insensitive)
    const dcAmountKey = keys.find(k => k.toLowerCase() === 'dc_amount');
    if (dcAmountKey) {
      const v = row[dcAmountKey];
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      if (!isNaN(n)) return n;
    }

    // If no dc_amount, try amount (but only if dc_amount doesn't exist)
    const amountKey = keys.find(k => {
      const l = k.toLowerCase();
      return l === 'amount' && !keys.some(k2 => k2.toLowerCase() === 'dc_amount');
    });
    if (amountKey) {
      const v = row[amountKey];
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      if (!isNaN(n)) return n;
    }

    // Fallback: try any field ending with _amount
    const amountLikeKey = keys.find(k => {
      const l = k.toLowerCase();
      return l.endsWith('_amount') && l !== 'dc_amount';
    });
    if (amountLikeKey) {
      const v = row[amountLikeKey];
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      if (!isNaN(n)) return n;
    }

    return 0;
  };

  // Helper to get DR (Debit) from row
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

  // Helper to get CR (Credit) from row
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

  // Helper to get source value from a row with dynamic key names
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

  // Fetch source columns for download dialog
  const fetchSourceColumns = async () => {
    if (!workflowId) {
      toast.error('Flow ID is missing. Please select a workflow.');
      return;
    }

    setIsLoadingColumns(true);
    try {
      const payload = {
        flow_id: workflowId,
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
    } catch (error: unknown) {
      console.error('Failed to fetch source columns:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, 'Failed to load source columns'));
      }
    } finally {
      setIsLoadingColumns(false);
    }
  };
  // Copy cell value to clipboard
  const copyCellValue = (params: any) => {
    const cellValue = params.value || params.node?.data?.[params.column?.getColId() || ''] || '';
    navigator.clipboard.writeText(String(cellValue)).then(() => {
      toast.success("Cell value copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  // Context menu items with copy option above export
  const getContextMenuItems = (params: any) => {
    return [
      {
        name: "Copy Cell",
        action: () => copyCellValue(params),
        icon: '<span class="ag-icon ag-icon-copy"></span>',
      },
      "separator",
      "export",
    ] as any;
  };

  // Fetch summary table to get available sources and operation counts
  const fetchSummaryTable = async (useEmptyPayload = false) => {
    try {
      // Use empty payload if requested (for initial page load)
      const payload = useEmptyPayload
        ? { flow_id: workflowId, stmt_date: "", cycle_number: undefined, is_select: false }
        : {
          flow_id: workflowId,
          stmt_date: formatDate(date),
          cycle_number: selectedCycle || undefined,
          is_select: false,
        };

      const response = await getSummaryTable(payload);
      if (response?.status && response?.data) {
        const rows: any[] = response.data || [];

        // Extract sources from summary table
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

          // Extract operation counts from summary table using explicit field names when available
          const counts = {
            matched: 0,
            unmatched: 0,
            'auth-waiting': 0,
            'rollback-waiting': 0,
          };

          rows.forEach((row: any) => {
            // Prefer explicit keys returned by backend (underscore names), fall back to loose matching

            // Matched: prefer matched_count, else try matched or matchedCount/matchedcount.
            // Also include carry-forward matched columns if present (carry_forward_matched_count, carry_forward_matched, carryForwardMatchedCount, etc.)
            const matchedVal = (row.matched_count ?? row.matched ?? row.matchedCount ?? row.matchedcount ?? 0);
            const carryForwardMatchedVal = (row.carry_forward_matched_count ?? row.carry_forward_matched ?? row.carryForwardMatchedCount ?? row.carryForwardMatched ?? 0);
            const m = Number(matchedVal) || 0;
            const cfm = Number(carryForwardMatchedVal) || 0;
            counts.matched += m + cfm;

            // Unmatched: prefer unmatched_count, else try unmatched or unmatchedCount.
            // Include carry-forward unmatched counts as well (carry_forward_unmatched_count, carry_forward_unmatched, carryForwardUnmatchedCount, etc.)
            const unmatchedVal = (row.unmatched_count ?? row.unmatched ?? row.unmatchedCount ?? 0);
            const carryForwardUnmatchedVal = (row.carry_forward_unmatched_count ?? row.carry_forward_unmatched ?? row.carryForwardUnmatchedCount ?? row.carryForwardUnmatched ?? 0);
            const u = Number(unmatchedVal) || 0;
            const cfu = Number(carryForwardUnmatchedVal) || 0;
            counts.unmatched += u + cfu;

            // Auth waiting: prefer auth_awaiting / auth_waiting
            const authVal = (row.auth_awaiting ?? row.auth_waiting ?? row.authAwaiting ?? 0);
            const a = Number(authVal) || 0;
            counts['auth-waiting'] += a;

            // Rollback waiting: prefer rollback_awaiting / rollback_waiting
            const rbVal = (row.rollback_awaiting ?? row.rollback_waiting ?? row.rollbackAwaiting ?? 0);
            const r = Number(rbVal) || 0;
            counts['rollback-waiting'] += r;
          });

          setOperationCounts(counts);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch summary table:', error);
      // Don't show error toast as this is a background operation
    }
  };

  // Fetch dashboard data - using hardcoded payload
  const fetchDashboardData = async (
    operation: string,
    opts?: { allRecordsOverride?: boolean; sourceOverride?: string | null; useEmptyPayload?: boolean }
  ) => {
    // Prevent concurrent calls
    if (isLoadingDashboard) {
      return;
    }

    // // Cancel any ongoing request
    // if (abortControllerRef.current) {
    //   abortControllerRef.current.abort();
    // }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsLoadingDashboard(true);
    setIsStreaming(true);
    setDashboardData([]);
    hasFirstDataRef.current = false;
    pendingChunksRef.current = [];

    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
      updateTimerRef.current = null;
    }

    try {
      // Payload with operation from selected tab
      const operationMap: Record<string, string> = {
        'matched': 'matched',
        'unmatched': 'unmatched',
        'auth-waiting': 'auth_waiting',
        'rollback-waiting': 'rollback_waiting'
      };

      // Use the operation argument passed to this function so callers (e.g. tab clicks)
      // can trigger a fetch immediately without relying on async state updates.
      const operationValue = operationMap[operation] || operation || 'matched';

      // Get flow_id dynamically from selected workflow
      const flowId = workflowId;
      if (!flowId) {
        console.error('Flow ID is missing');
        toast.error('Flow ID is missing. Please select a workflow.');
        setDashboardData([]);
        return;
      }

      // Determine allRecords and sourceName from options or current state
      const effectiveAllRecords = opts?.allRecordsOverride ?? allRecords;
      const effectiveSource = opts?.sourceOverride ?? selectedSource ?? '';

      // Use empty payload if requested (for initial page load)
      const useEmptyPayload = opts?.useEmptyPayload ?? false;
      const payload = useEmptyPayload
        ? {
          flow_id: workflowId,
          stmt_date: "",
          cycle_number: undefined,
          payload: {
            operation: operationValue,
            source_name: "",
            all_records: true
          }
        }
        : {
          flow_id: workflowId,
          stmt_date: formatDate(date),
          cycle_number: selectedCycle || undefined,
          payload: {
            operation: operationValue,
            source_name: effectiveAllRecords ? "" : effectiveSource,
            all_records: effectiveAllRecords
          }
        };

      // Store last dashboard params for refresh
      setLastDashboardParams({
        source: effectiveSource,
        operation: operationValue,
        stmt_date: formatDate(date),
      });
      // Fetch with streaming
      const response = await getDashboardDataStreaming(payload, signal);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Streaming not available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // Helper function to extract complete JSON objects from a string
      const extractCompleteJSON = (text: string): { parsed: any[], remaining: string } => {
        const results: any[] = [];
        let remaining = text;
        let startIndex = 0;

        while (startIndex < remaining.length) {
          // Skip whitespace
          while (startIndex < remaining.length && /\s/.test(remaining[startIndex])) {
            startIndex++;
          }
          if (startIndex >= remaining.length) break;

          // Find the start of a JSON object/array
          const char = remaining[startIndex];
          if (char !== '{' && char !== '[') {
            startIndex++;
            continue;
          }

          // Find the matching closing brace/bracket
          let depth = 0;
          let inString = false;
          let escapeNext = false;
          let endIndex = startIndex;

          for (let i = startIndex; i < remaining.length; i++) {
            const c = remaining[i];
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            if (c === '\\') {
              escapeNext = true;
              continue;
            }
            if (c === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }
            if (!inString) {
              if (c === '{' || c === '[') {
                depth++;
              } else if (c === '}' || c === ']') {
                depth--;
                if (depth === 0) {
                  endIndex = i + 1;
                  break;
                }
              }
            }
          }

          // If we found a complete JSON object
          if (depth === 0 && endIndex > startIndex) {
            try {
              const jsonStr = remaining.substring(startIndex, endIndex).trim();
              if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                results.push(parsed);
              }
              remaining = remaining.substring(endIndex);
              startIndex = 0;
            } catch (parseError) {
              // Incomplete JSON, keep it in buffer
              break;
            }
          } else {
            // Incomplete JSON, keep it in buffer
            break;
          }
        }

        return { parsed: results, remaining };
      };

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const { parsed } = extractCompleteJSON(buffer);
            for (const item of parsed) {
              let dataToAdd: any[] = [];

              if (Array.isArray(item)) {
                dataToAdd = item;
              } else if (item && typeof item === 'object') {
                if (Array.isArray(item.data)) {
                  dataToAdd = item.data;
                } else if (Array.isArray(item.payload)) {
                  dataToAdd = item.payload;
                } else if (Array.isArray(item.result)) {
                  dataToAdd = item.result;
                } else if (Array.isArray(item.rows)) {
                  dataToAdd = item.rows;
                } else {
                  dataToAdd = [item];
                }
              }

              if (dataToAdd.length > 0) {
                const rowsWithVisibility = dataToAdd.map((row: any) => ({
                  ...row,
                  visible: true,
                }));

                if (!hasFirstDataRef.current) {
                  hasFirstDataRef.current = true;
                  flushSync(() => {
                    setDashboardData(rowsWithVisibility);
                    currentDataLengthRef.current = rowsWithVisibility.length;
                    setIsLoadingDashboard(false);
                  });
                } else {
                  pendingChunksRef.current.push(...rowsWithVisibility);
                }
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Extract complete JSON objects from buffer
        const { parsed, remaining } = extractCompleteJSON(buffer);
        buffer = remaining;

        // Process parsed JSON objects
        for (const item of parsed) {
          try {
            let dataToAdd: any[] = [];

            if (Array.isArray(item)) {
              dataToAdd = item;
            } else if (item && typeof item === 'object') {
              if (Array.isArray(item.data)) {
                dataToAdd = item.data;
              } else if (Array.isArray(item.payload)) {
                dataToAdd = item.payload;
              } else if (Array.isArray(item.result)) {
                dataToAdd = item.result;
              } else if (Array.isArray(item.rows)) {
                dataToAdd = item.rows;
              } else {
                dataToAdd = [item];
              }
            }

            if (dataToAdd.length > 0) {
              const rowsWithVisibility = dataToAdd.map((row: any) => ({
                ...row,
                visible: true,
              }));

              // First chunk - display immediately
              if (!hasFirstDataRef.current) {
                hasFirstDataRef.current = true;
                flushSync(() => {
                  setDashboardData(rowsWithVisibility);
                  currentDataLengthRef.current = rowsWithVisibility.length;
                  setIsLoadingDashboard(false);
                });
              } else {
                // Subsequent chunks - batch updates
                pendingChunksRef.current.push(...rowsWithVisibility);

                // Clear existing timer
                if (updateTimerRef.current) {
                  clearTimeout(updateTimerRef.current);
                }

                // Batch update: wait a bit to accumulate chunks, then update
                updateTimerRef.current = setTimeout(() => {
                  if (pendingChunksRef.current.length > 0) {
                    const chunksToAdd = [...pendingChunksRef.current];
                    pendingChunksRef.current = [];
                    setDashboardData((prevData) => {
                      const newData = [...prevData, ...chunksToAdd];
                      currentDataLengthRef.current = newData.length;
                      return newData;
                    });
                  }
                  updateTimerRef.current = null;
                }, 100);
              }
            }
          } catch (error) {
            console.error("Error processing parsed item:", error);
          }
        }
      }

      // Process any remaining pending chunks before finishing
      if (pendingChunksRef.current.length > 0) {
        const chunksToAdd = [...pendingChunksRef.current];
        pendingChunksRef.current = [];
        setDashboardData((prevData) => {
          const newData = [...prevData, ...chunksToAdd];
          currentDataLengthRef.current = newData.length;
          return newData;
        });
      }

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
        updateTimerRef.current = null;
      }

      // Update sources from dashboard data
      setDashboardData((currentData) => {
        // Extract sources if showing all records
        if (effectiveAllRecords) {
          let srcs = Array.from(new Set(currentData.map((r) => getRowSource(r)).filter(Boolean)));
          if (srcs.length > 0) {
            setAvailableSources(srcs.sort());
          }
        }

        return currentData;
      });

      // Reset selection
      setSelectedRows([]);
      setSelectedRowsCount(0);
      setSelectedSummary([]);
      setSelectedTotals({ count: 0, amount: 0, dr: 0, cr: 0 });
      setSelectedRowsData([]);

      // Clear AG Grid selection
      if (gridApi.current) {
        const api = gridApi.current.api || gridApi.current;
        if (api && typeof api.deselectAll === 'function') {
          api.deselectAll();
        }
      }

      setIsStreaming(false);
      setIsLoadingDashboard(false);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log("Fetch aborted");
        setIsLoadingDashboard(false);
        setIsStreaming(false);
        return;
      }
      console.error("Streaming error:", err);
      if (!(err instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(err, "Failed to fetch data"));
      }
      setDashboardData([]);
      setIsLoadingDashboard(false);
      setIsStreaming(false);
    }
  };

  // Get selected records grouped by source
  const getSelectedRecords = () => {
    if (!gridApi.current) return null;

    // Get selected nodes (not only rows)
    const selectedNodes = gridApi.current.getSelectedNodes();

    // Filter only real data rows (leaf nodes)
    const dataRows = selectedNodes
      .filter((node: any) => !node.group) // ignore group rows
      .map((node: any) => node.data);

    if (dataRows.length === 0) {
      return null;
    }

    // Group selected IDs by source -> { [source]: string[] }
    const grouped: Record<string, string[]> = {};
    for (const row of dataRows) {
      const id = row.SYSTEM_REF_ID || row.system_ref_id || row.id;
      if (!id) continue;
      const src = (row.SOURCE_NAME || row.source_name || row.source || '') as string;
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(String(id));
    }

    // Convert to array of objects: [{ sourceA: [ids] }, { sourceB: [ids] }]
    const records: Array<Record<string, string[]>> = Object.entries(grouped).map(
      ([src, ids]) => ({ [src]: ids })
    );

    return records;
  };

  // Generalized action performer for selected rows
  const performAction = async (action: 'force_match' | 'rollback' | 'cancel' | 'authorize' | 'reject') => {
    // Handle cancel - just clear selection
    if (action === 'cancel') {
      setSelectedRows([]);
      setCommentsText("");
      setSelectedRowsCount(0);
      setSelectedSummary([]);
      setSelectedTotals({ count: 0, amount: 0, dr: 0, cr: 0 });
      setSelectedRowsData([]);
      // Clear AG Grid selection
      if (gridApi.current) {
        const api = gridApi.current.api || gridApi.current;
        if (api && typeof api.deselectAll === 'function') {
          api.deselectAll();
        }
      }
      return;
    }

    const records = getSelectedRecords();
    if (!records || records.length === 0) {
      toast.error('Please select at least one record');
      return;
    }

    // Get flow_id dynamically from selected workflow
    const flowId = workflowId;
    if (!flowId) {
      toast.error('Flow ID is missing. Please select a workflow.');
      return;
    }

    const payload = {
      flow_id: workflowId,
      operation: dashboardOperation,
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
        setCommentsText("");
        // Clear selection after successful action
        setSelectedRows([]);
        setSelectedRowsCount(0);
        setSelectedSummary([]);
        setSelectedTotals({ count: 0, amount: 0, dr: 0, cr: 0 });
        setSelectedRowsData([]);
        // Clear AG Grid selection
        if (gridApi.current) {
          const api = gridApi.current.api || gridApi.current;
          if (api && typeof api.deselectAll === 'function') {
            api.deselectAll();
          }
        }
        // Refresh the summary table to update counts
        await fetchSummaryTable();
        // Refresh the dashboard data after action
        fetchDashboardData(dashboardOperation);
      } else {
        toast.error(message);
      }
    } catch (error: unknown) {
      console.error('Action failed:', error);
      if (!(error instanceof ApiRequestError)) {
        toast.error(getDisplayErrorMessage(error, 'Action failed'));
      }
    }
  };

  // Handle selection change in AG Grid
  const handleSelectionChange = () => {
    if (!gridApi.current) return;

    const api = gridApi.current.api || gridApi.current;
    if (!api || typeof api.getSelectedNodes !== 'function') return;
    const selectedNodes = api.getSelectedNodes();
    const rows = selectedNodes.filter((n: any) => !n.group).map((n: any) => n.data);

    setSelectedRows(rows);
    setSelectedRowsCount(rows.length);
    setSelectedRowsData(rows);

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
  };

  // Prepare table data for selected records preview - show only Source, No. of transactions, Amount grouped by source
  const tabledata = useMemo(() => {
    if (selectedSummary.length === 0) return [];

    // Show original dc_amount for each source (not differences)
    return selectedSummary.map((item, idx) => ({
      id: idx,
      source: item.source || 'Unknown',
      count: item.count || 0, // Number of selected records for this source
      amount: item.amount, // Original dc_amount for this source
      dr: item.dr || 0, // DR amount
      cr: item.cr || 0, // CR amount
    }));
  }, [selectedSummary]);

  const previewColumns = useMemo(() => {
    return [
      {
        key: 'source',
        header: 'Source',
        align: 'left' as const,
      },
      {
        key: 'count',
        header: 'No. of transactions',
        align: 'right' as const,
      },
      {
        key: 'amount',
        header: 'Amount',
        align: 'right' as const,
      },
      {
        key: 'dr',
        header: 'DR',
        align: 'right' as const,
      },
      {
        key: 'cr',
        header: 'CR',
        align: 'right' as const,
      },
    ];
  }, []);

  // Checkbox column definition for AG Grid
  const checkboxColumn: any = {
    headerName: "",
    checkboxSelection: true,
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

  // Auto group column definition
  const autoGroupColumnDef = useMemo<ColDef>(() => {
    return {
      minWidth: 200,
    };
  }, []);

  // Export functions
  const onExportCSV = () => {
    if (gridApi.current) {
      const api = gridApi.current.api || gridApi.current;
      if (api && typeof api.getSelectedNodes === 'function' && typeof api.exportDataAsCsv === 'function') {
        const shouldExportSelected = downloadSelectedOnly && api.getSelectedNodes().some((n: any) => !n.group);
        if (downloadSelectedOnly && !shouldExportSelected) {
          toast.error("No records selected");
          return;
        }
        api.exportDataAsCsv({
          fileName: `${dashboardOperation}_data.csv`,
          onlySelected: shouldExportSelected
        });
      }
      toast.success('CSV downloaded');
    } else {
      toast.error("Grid API not ready yet");
    }
  };

  const onExportExcel = () => {
    if (gridApi.current) {
      const api = gridApi.current.api || gridApi.current;
      if (api && typeof api.getSelectedNodes === 'function' && typeof api.exportDataAsExcel === 'function') {
        const shouldExportSelected = downloadSelectedOnly && api.getSelectedNodes().some((n: any) => !n.group);
        if (downloadSelectedOnly && !shouldExportSelected) {
          toast.error("No records selected");
          return;
        }
        api.exportDataAsExcel({
          fileName: `${dashboardOperation}_data.xlsx`,
          sheetName: "Dashboard",
          exportMode: "xlsx",
          onlySelected: shouldExportSelected,
        });
        toast.success('Excel downloaded');
      }
    } else {
      toast.error("Grid API not ready yet");
    }
  };

  // Fetch statement dates when workflowId changes
  useEffect(() => {
    fetchStatementDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  // Fetch cycle wise data when date changes
  useEffect(() => {
    fetchCycleWiseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, workflowId]);

  // Initial page load: Call APIs with empty values
  useEffect(() => {
    if (workflowId) {
      fetchSummaryTable(true); // Pass true to use empty payload
      fetchDashboardData(dashboardOperation, { useEmptyPayload: true }); // Call dashboard API with empty payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]); // Only run once when workflowId is available

  // Fetch summary table when date or cycle changes
  useEffect(() => {
    // Don't fetch while cycle data is loading
    if (loadingCycleWise) {
      return;
    }

    const currentWorkflowId = workflowId;
    if (!currentWorkflowId) {
      return;
    }

    // Skip if no date selected (initial load is handled separately)
    if (!date) {
      return;
    }

    // Only fetch if date is selected and (no cycle data exists OR cycle is selected)
    const canFetch = cycleWiseOptions.length === 0 || selectedCycle;

    if (canFetch) {
      fetchSummaryTable(false); // Use normal payload with date and cycle
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedCycle, cycleWiseOptions.length, loadingCycleWise]);

  // Fetch data when component mounts or operation/date/cycle changes
  useEffect(() => {
    // Don't fetch while cycle data is loading
    if (loadingCycleWise) {
      return;
    }

    // Skip if no date selected
    if (!date) {
      return;
    }

    // Only fetch if date is selected and (no cycle data exists OR cycle is selected)
    const canFetch = cycleWiseOptions.length === 0 || selectedCycle;

    if (!canFetch) {
      return;
    }

    // Check if we've already fetched this operation (but allow refetch if date or cycle changed)
    const lastFetch = lastFetchRef.current;
    if (
      lastFetch &&
      lastFetch.operation === dashboardOperation &&
      lastFetch.date === formatDate(date) &&
      lastFetch.cycle === selectedCycle &&
      !isLoadingDashboard
    ) {
      return; // Skip duplicate call (same operation, date, and cycle)
    }

    // Update ref before fetching
    lastFetchRef.current = {
      operation: dashboardOperation,
      workflowId: 'hardcoded', // Since we're using hardcoded payload
      date: formatDate(date),
      cycle: selectedCycle,
    };

    // Call API - will use current date and cycle_number in the payload
    // The fetchDashboardData function will include cycle_number: selectedCycle || undefined
    fetchDashboardData(dashboardOperation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardOperation, date, selectedCycle, cycleWiseOptions.length, loadingCycleWise]); // Triggers when cycle is selected

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Operation Tabs */}
      <div className="border-b shrink-0 bg-background">
        <div className="flex items-center gap-0 relative">
          {statusTabs.map((tab) => {
            const count = operationCounts[tab.id as keyof typeof operationCounts] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setDashboardOperation(tab.id);
                  // Reset to all records when switching tabs
                  setAllRecords(true);
                  setSelectedSource(null);
                  // Clear bulk file when switching tabs
                  setBulkFile(null);
                  // Immediately fetch dashboard data for the new tab.
                  // If no date is selected, request with empty payload so API returns initial data.
                  try {
                    fetchDashboardData(tab.id, { useEmptyPayload: !date });
                  } catch (e) {
                    // swallow - fetchDashboardData handles errors and toasts
                    console.error('Error triggering fetch on tab change', e);
                  }
                }}
                className={`
                px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out
                border-b-2 relative z-10
                ${dashboardOperation === tab.id
                    ? 'border-primary text-primary bg-primary/10 font-semibold'
                    : 'border-transparent text-primary hover:text-primary hover:border-primary/50 hover:bg-primary/5'
                  }
              `}
                style={{
                  animation: dashboardOperation === tab.id ? 'fadeIn 0.3s ease-in-out' : 'none'
                }}
              >
                {tab.label}({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Dashboard Table with AG Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoadingDashboard ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading dashboard data...</p>
            </div>
          </div>
        ) : dashboardData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-red-600">No data available</p>
            </div>
          </div>
        ) : (
          <>
            {/* Action Bar with Comments and Buttons */}
            <div className="border-b bg-background dark:bg-gray-800 p-3 space-y-3">
              <div className="flex items-center gap-3">

                {/* Bulk Upload, Download buttons - Only show in unmatched operation */}
                {dashboardOperation === 'unmatched' && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="bg-transparent border-gray-600 text-gray-700 dark:text-gray-300 gap-2 !h-8"
                      onClick={() => setIsBulkDialogOpen(true)}
                    >
                      <CloudUpload className="h-4 w-4" />
                      Bulk Upload
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="rounded-full bg-gray-200 dark:bg-[#333] hover:bg-gray-300 dark:hover:bg-[#444] text-blue-600 dark:text-blue-400 !h-8 w-8 border border-gray-300 dark:border-gray-600"
                      onClick={() => {
                        setIsDownloadDialogOpen(true);
                        fetchSourceColumns();
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {/* Show Bulk Upload Force Match button when file is uploaded */}
                    {bulkFile && (
                      <>
                        {/* Comments textbox for bulk upload */}
                        {/* <div className="flex-1">
                  <Textarea
                    placeholder="Comments*"
                    value={commentsText}
                    onChange={(e) => setCommentsText(e.target.value)}
                    className="bg-transparent text-black dark:text-white focus:border-blue-500 min-h-[31px] resize-none px-2 py-1"
                  />
                        </div> */}
                        {/* <Button
                          className="bg-blue-500 text-white !h-8 px-6"
                          onClick={async () => {
                            if (!bulkFile) {
                              toast.error('Please select a file first');
                              return;
                            }

                            const flowId = workflowId;
                            if (!flowId) {
                              toast.error('Flow ID is missing. Please select a workflow.');
                              return;
                            }

                            try {
                              // Call bulk upload force match API
                              await bulkUploadForceMatch({
                                flow_id: flowId,
                                operation: dashboardOperation,
                                comments: commentsText?.trim() || '',
                                stmt_date: formatDate(date),
                                cycle_number: selectedCycle || undefined,
                                file: bulkFile,
                              });

                              toast.success('Bulk upload force match completed successfully');

                              // Clear bulk file and comments after successful upload
                              setBulkFile(null);
                              setCommentsText('');

                              // Refresh the summary table to update counts
                              await fetchSummaryTable();
                              // Refresh the data after action
                              fetchDashboardData(dashboardOperation);
                            } catch (error: any) {
                              console.error('Bulk upload force match failed:', error);
                              if (!(error instanceof ApiRequestError)) {
                                toast.error(getDisplayErrorMessage(error, 'Bulk upload force match failed'));
                              }
                            }
                          }}
                        >
                        
                        </Button> */}
                      </>
                    )}
                  </div>
                )}

                {/* Comments textbox - Hide when bulk file is selected */}
                {!bulkFile && (
                  <div className="flex-1">
                    <CommentBox
                      initialValue={commentsText}
                      onCommit={(v) => setCommentsText(v)}
                      placeholder="Comments*"
                      className="bg-transparent text-black dark:text-white focus:border-blue-500 min-h-[31px] resize-none px-2 py-1"
                    />
                  </div>
                )}

                {/* All Records Checkbox and Source Dropdown - Beside Comments */}
                <div className="flex items-center gap-2">


                  <div className="w-64">
                    <Select
                      value={selectedSource ?? undefined}
                      onValueChange={(v) => {
                        // Selecting a source disables All Records and reloads (avoid race by passing overrides)
                        setAllRecords(false);
                        setSelectedSource(v);
                        if (lastDashboardParams) {
                          fetchDashboardData(
                            lastDashboardParams.operation,
                            { allRecordsOverride: false, sourceOverride: v }
                          );
                        } else {
                          // If no lastDashboardParams, use current operation
                          fetchDashboardData(
                            dashboardOperation,
                            { allRecordsOverride: false, sourceOverride: v }
                          );
                        }
                      }}
                      disabled={allRecords || !dashboardData.length}
                    >
                      <SelectTrigger className="!h-8">
                        <SelectValue placeholder={allRecords ? "All Records" : (selectedSource || "Choose Source")} />
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

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="all-records"
                      checked={allRecords}
                      onCheckedChange={(c) => {
                        const v = !!c;
                        setAllRecords(v);
                        if (v) {
                          // go back to all records view
                          setSelectedSource(null);
                          if (lastDashboardParams) {
                            fetchDashboardData(
                              lastDashboardParams.operation,
                              { allRecordsOverride: true, sourceOverride: '' }
                            );
                          } else {
                            // If no lastDashboardParams, fetch with current operation
                            fetchDashboardData(
                              dashboardOperation,
                              { allRecordsOverride: true, sourceOverride: '' }
                            );
                          }
                        } else {
                          // When unchecking, if a source is selected, fetch with that source
                          // Otherwise, user needs to select a source first
                          if (selectedSource) {
                            if (lastDashboardParams) {
                              fetchDashboardData(
                                lastDashboardParams.operation,
                                { allRecordsOverride: false, sourceOverride: selectedSource }
                              );
                            } else {
                              fetchDashboardData(
                                dashboardOperation,
                                { allRecordsOverride: false, sourceOverride: selectedSource }
                              );
                            }
                          }
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
                </div>
                {/* Cycle Wise Dropdown */}
                <ShadTooltip content={!date ? "Select a date first" : cycleWiseOptions.length > 0 ? "Select Cycle" : "No cycle data available for selected date"}>
                  <Select
                    value={selectedCycle}
                    onValueChange={(value) => setSelectedCycle(value)}
                    disabled={!date || cycleWiseOptions.length === 0 || loadingCycleWise}
                  >
                    <SelectTrigger
                      className="w-[110px] !text-xs !p-2"
                      style={{ height: '28px', minHeight: '28px', maxHeight: '28px' }}
                    >
                      {loadingCycleWise ? (
                        <div className="flex items-center gap-1.5 h-4">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-[10px] leading-none">Loading...</span>
                        </div>
                      ) : !date ? (
                        <span className="text-muted-foreground text-xs leading-none">Select Date</span>
                      ) : cycleWiseOptions.length > 0 ? (
                        <SelectValue placeholder="Select Cycle" className="text-xs" />
                      ) : (
                        <span className="text-muted-foreground text-xs leading-none">No Cycle</span>
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
                      className="w-auto !mr-20 p-0 rounded-md bg-background shadow-md"
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
              </div>

              {selectedRowsCount > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedRowsCount} record(s) selected
                </div>
              )}

              {/* Selected preview summary - Show all selected records */}
              {selectedRowsCount > 0 && selectedRowsData.length > 0 && (
                <div className="mt-3 border rounded-md overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
                    <div className="text-sm font-semibold">
                      Selected Records Preview ({selectedRowsCount} record{selectedRowsCount !== 1 ? 's' : ''})
                    </div>
                  </div>
                  <div className="max-h-[170px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-gray-100 dark:bg-gray-800 z-10">
                        <TableRow>
                          {previewColumns.map((col: any) => (
                            <TableHead key={col.key} className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}>
                              {col.header}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tabledata.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={previewColumns.length} className="text-center text-slate-500 py-8">
                              No records selected
                            </TableCell>
                          </TableRow>
                        ) : (
                          tabledata.map((row: any, idx: number) => (
                            <TableRow key={row.id || idx}>
                              {previewColumns.map((col: any) => (
                                <TableCell key={col.key} className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}>
                                  {row[col.key]}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Summary totals row */}
                  {selectedSummary.length > 0 && (
                    <div className="border-t bg-gray-50 dark:bg-gray-800 px-4 py-2 flex justify-between text-sm font-semibold">
                      <span>Summary by Source:</span>
                      <div className="flex gap-6">
                        <span>Total Count: {selectedTotals.count}</span>
                        <span className="text-green-600 dark:text-green-400">
                          Total Amount: {selectedTotals.amount.toFixed(2)}
                        </span>
                        {/* <span>Total DR: {selectedTotals.dr.toFixed(2)}</span>
                        <span>Total CR: {selectedTotals.cr.toFixed(2)}</span> */}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center p-2 border-b bg-background dark:bg-gray-800">
              {/* Center Title */}
              <div className="flex-1 text-center font-semibold text-base">
                {/* {dashboardOperation.charAt(0).toUpperCase() + dashboardOperation.slice(1).replace('-', ' ')} Data */}
              </div>

              {/* Right Buttons */}
              <div className="flex gap-2 items-center">
                {/* Context-aware actions based on operation type - Hide when bulk file is selected, show only when rows are selected */}
                {!bulkFile && selectedRowsCount > 0 && (() => {
                  const op = dashboardOperation?.toLowerCase() || '';
                  if (op === 'matched') {
                    return (
                      <div className="flex gap-2">
                        <Button
                          className="bg-blue-500 text-white !h-8 px-6"
                          onClick={() => performAction('rollback')}
                        >
                          Rollback
                        </Button>
                        <Button
                          className="bg-red-600 text-white !h-8 px-6"
                          onClick={() => performAction('cancel')}
                        >
                          Cancel
                        </Button>
                      </div>
                    );
                  }
                  if (op === 'unmatched' || op === 'force_matched') {
                    return (
                      <div className="flex gap-2">
                        <Button
                          className="bg-blue-500 text-white !h-8 px-6"
                          onClick={() => performAction('force_match')}
                        >
                          Force Match
                        </Button>
                        <Button
                          className="bg-red-600 text-white !h-8 px-6"
                          onClick={() => performAction('cancel')}
                        >
                          Cancel
                        </Button>
                      </div>
                    );
                  }
                  if (op === 'auth_waiting' || op === 'auth-waiting' || op === 'rollback_waiting' || op === 'rollback-waiting') {
                    return (
                      <div className="flex gap-2">
                        <Button
                          className="bg-green-600 text-white !h-8 px-6"
                          onClick={() => performAction('authorize')}
                        >
                          Authorize
                        </Button>
                        <Button
                          className="bg-red-600 text-white !h-8 px-6"
                          onClick={() => performAction('reject')}
                        >
                          Reject
                        </Button>
                      </div>
                    );
                  }
                  return null;
                })()}

                <Checkbox
                  checked={downloadSelectedOnly}
                  onCheckedChange={(checked) => setDownloadSelectedOnly(!!checked)}
                  className="h-4 w-4 border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
                <span className="text-sm text-foreground">Download Selected Only</span>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-full h-7 w-7 text-blue-400 !border-none !bg-transparent"
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

            {/* AG Grid */}
            <div
              className={`dashboard-grid-container flex-grow h-[460px] bg-background ${document.documentElement.classList.contains("dark")
                ? "ag-theme-quartz-dark"
                : "ag-theme-quartz"
                }`}
            >
              <AgGridReact
                rowHeight={35}
                headerHeight={35}
                ref={gridApi}
                rowData={dashboardData}
                suppressMovableColumns={false}
                rowDragManaged={true}
                suppressDragLeaveHidesColumns={true}
                suppressMaintainUnsortedOrder={true}
                allowDragFromColumnsToolPanel={true}
                groupDisplayType="multipleColumns"
                autoGroupColumnDef={autoGroupColumnDef}
                rowGroupPanelShow="always"
                rowSelection="multiple"
                groupSelectsChildren={true}
                groupSelectsFiltered={true}
                enableRangeSelection={true}
                suppressCopyRowsToClipboard={false}
                getContextMenuItems={getContextMenuItems}

                getRowId={(params) => {
                  const id = params.data.SYSTEM_REF_ID || params.data.system_ref_id || params.data.id || params.data.PK;
                  return id ? String(id) : `row-${params.data.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }}
                columnDefs={
                  dashboardData.length > 0
                    ? [
                      checkboxColumn,
                      ...(function () {
                        const keys = Object.keys(dashboardData[0]);
                        const hasDcAmount = keys.some(k => k.toLowerCase() === 'dc_amount');
                        return keys
                          .filter(key => {
                            const lower = key.toLowerCase();
                            // Exclude system keys
                            if (key === 'visible' || key === 'id' || key === '_rowId') {
                              return false;
                            }
                            // If dc_amount exists, exclude amount column completely
                            if (hasDcAmount && lower === 'amount') {
                              return false;
                            }
                            return true;
                          })
                          .map((key) => {
                            const lower = key.toLowerCase();
                            const isAmountLike = lower === 'dc_amount';
                            return {
                              field: key,
                              headerName: key, // Show exactly as it comes from API response
                              sortable: true,
                              filter: true,
                              resizable: true,
                              width: 150,
                              enableRowGroup: true,
                              valueFormatter: isAmountLike
                                ? (p: any) => {
                                  const v = typeof p.value === 'number' ? p.value : parseFloat(String(p.value ?? '0'));
                                  return isNaN(v) ? '' : v.toFixed(2);
                                }
                                : undefined,
                            } as ColDef;
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
                }
                }

                pivotMode={false}
                onSelectionChanged={handleSelectionChange}
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
                  defaultToolPanel: "columns",
                }}
                animateRows={true}
                pagination={true}
                paginationPageSize={20}
                paginationPageSizeSelector={[10, 20, 50, 100]}
                onGridReady={(params) => {
                  gridApi.current = params.api;
                  gridColumnApi.current = (params as any).columnApi;
                  params.api.setSideBarVisible(true);
                  params.api.openToolPanel("columns");
                }}
              />
            </div>
          </>
        )}
      </div>

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

                if (!workflowId) {
                  toast.error('Flow ID is missing. Please select a workflow.');
                  return;
                }

                try {
                  const payload = {
                    flow_id: workflowId,
                    stmt_date: formatDate(date),
                    cycle_number: selectedCycle || undefined,
                    match_records: true,
                    file: bulkFile,
                  };

                  const uploadResponse = await uploadBulkForceMatchRecords(payload);

                  const rows = Array.isArray(uploadResponse)
                    ? uploadResponse
                    : Array.isArray((uploadResponse as any)?.data)
                      ? (uploadResponse as any).data
                      : [];

                  const rowsWithVisibility = rows.map((row: any) => ({
                    ...row,
                    visible: true,
                  }));

                  setDashboardData(rowsWithVisibility);
                  setSelectedRows([]);
                  setSelectedRowsCount(0);
                  setSelectedSummary([]);
                  setSelectedTotals({ count: 0, amount: 0, dr: 0, cr: 0 });
                  setSelectedRowsData([]);

                  if (gridApi.current) {
                    const api = gridApi.current.api || gridApi.current;
                    if (api && typeof api.deselectAll === 'function') {
                      api.deselectAll();
                    }
                  }

                  if (rowsWithVisibility.length > 0) {
                    const srcs = Array.from(new Set(rowsWithVisibility.map((r: any) => getRowSource(r)).filter(Boolean) as string[]));
                    if (srcs.length > 0) setAvailableSources(srcs.sort());
                    setAllRecords(true);
                    setSelectedSource(null);
                  }

                  toast.success(rowsWithVisibility.length > 0
                    ? `Loaded ${rowsWithVisibility.length} row(s) into table.`
                    : "Upload succeeded, but no data rows found.");
                  setIsBulkDialogOpen(false);
                  // Keep bulkFile state so the "Bulk Upload Force Match" button appears
                } catch (error: unknown) {
                  console.error('Upload failed:', error);
                  if (!(error instanceof ApiRequestError)) {
                    toast.error(getDisplayErrorMessage(error, 'File upload failed'));
                  }
                }
              }}
            >
              Upload
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
                        <div key={source} className="border rounded-lg bg-background dark:bg-gray-800">
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
                              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''
                                }`}
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
                    <div className="border rounded-lg bg-background dark:bg-gray-800">
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
                          className={`h-4 w-4 transition-transform ${expandedSources.has('_conditions') ? 'rotate-180' : ''
                            }`}
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
                if (!workflowId) {
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
                  flow_id: workflowId,
                  stmt_date: formatDate(date),
                  cycle_number: selectedCycle || undefined,
                  source_columns: sourceColumnsArray,
                  is_unmatched: selectedStatus.unMatched,
                  is_matched: selectedStatus.matched,
                  // isTwoWayMatch: selectedStatus.twoWayMatch,
                  // isForceMatchWithDrCr: selectedStatus.forceMatchWithDrCr,
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
                } catch (error: unknown) {
                  console.error('Download failed:', error);
                  if (!(error instanceof ApiRequestError)) {
                    toast.error(getDisplayErrorMessage(error, 'Download failed'));
                  }
                }
              }}
            >
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

