import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  type ApiErrorResponse,
  getDisplayErrorMessage,
  resolveApiErrorMessage,
} from '@/utils/exceptionHelper';
import { Loader2, Columns, Save, RefreshCcw, CalendarIcon } from "lucide-react";
import { getSummaryCards, getSummaryTable, getDashboardData, getDashboardDataStreaming, saveChartTable, getStatementDates, getcycleWiseData } from "@/controllers/API/ReconcilationAPI";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ShadTooltip from "@/components/ui/shadTooltipComponent";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import CustomTableData from "@/components/ui/CustomTableData";
import CustomSVAGrid from "@/components/ui/customsvargrid";
import { toast } from "sonner";
import { AgGridReact } from "ag-grid-react";
import { includes } from "lodash";
import "./Summary.css";

type SummaryColumn = {
  key: string;
  header: string;
  visible: boolean;
  align?: 'left' | 'right' | 'center';
};

function parsePossiblyStreamedJson(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    // SSE format: lines like "data: {...}"
    const sseDataLines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);

    for (let i = sseDataLines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(sseDataLines[i]);
      } catch {
        // keep scanning backwards
      }
    }

    // NDJSON / mixed output: parse the last valid JSON line
    const lines = trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      try {
        return JSON.parse(lines[i]);
      } catch {
        // keep scanning backwards
      }
    }

    throw new SyntaxError("Unable to parse streamed JSON response");
  }
}

async function readDashboardJson(response: Response) {
  const text = await response.text();
  return parsePossiblyStreamedJson(text);
}

const DEFAULT_SUMMARY_COLUMNS: SummaryColumn[] = [];

/** flow_id is hidden by default in the summary table. */
const isFlowIdColumnKey = (key: string): boolean => {
  const n = key.toLowerCase().replace(/\s+/g, '_');
  return n === 'flow_id' || n === 'flowid';
};

export function SummaryTable({ flowId }: { flowId: string }) {
  const gridApi = useRef<any>(null);

  const [summaryCards, setSummaryCards] = useState<any>(null);
  const [summaryTable, setSummaryTable] = useState<any[]>([]);
  const [dashboardData, setDashboardData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);
  const [dashboardDataClicked, setDashboardDataClicked] = useState(false);

  // Store last dashboard params for refresh when date changes
  const [lastDashboardParams, setLastDashboardParams] = useState<{
    source: string;
    operation: string;
  } | null>(null);

  // Summary table column state (for reorder + hide/show)
  const [summaryColumns, setSummaryColumns] = useState<SummaryColumn[]>(
    DEFAULT_SUMMARY_COLUMNS
  );

  // Column manager modal UI state (works on a temp copy)
  const [showColumnManager, setShowColumnManager] = useState(false);
  const [tempColumns, setTempColumns] = useState<SummaryColumn[]>(DEFAULT_SUMMARY_COLUMNS);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Summary table sort state
  const [summarySort, setSummarySort] = useState<{ key: string | null; dir: 'asc' | 'desc' | null }>({ key: null, dir: null });

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

  // Payload with dynamic stmt_date and cyclewise
  const payload = useMemo(() => ({
    flow_id: flowId,
    stmt_date: formatDate(date),
    cycle_number: selectedCycle || undefined,
    is_select: false
  }), [flowId, date, selectedCycle]);

  // Fetch available statement dates
  const fetchStatementDates = async () => {
    if (!flowId) return;
    setLoadingDates(true);
    try {
      const response = await getStatementDates({ flow_id: flowId });
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

  // Initial page load: Call APIs with empty values
  useEffect(() => {
    if (flowId) {
      fetchSummaryData(true); // Pass true to use empty payload
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowId]); // Only run once when flowId is available

  // Function to check if a date is disabled (not in available dates)
  // Compares dates by their date string (YYYY-MM-DD) to avoid timezone issues
  const isDateDisabled = (date: Date) => {
    if (availableDates.length === 0) return false; // If no dates loaded, don't disable
    const dateStr = formatDate(date);
    return !availableDates.some(availableDate => formatDate(availableDate) === dateStr);
  };

  // Persist and load column settings
  const STORAGE_KEY = `summary_table_columns_${flowId}`;

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

  // Helper function to get original/full name from key
  const getOriginalName = (key: string): string => {
    const shortcuts: { [key: string]: string } = {
      'source_name': 'Source Name',
      'total_records': 'Total Records',
      'matched': 'Matched',
      'unmatched': 'Unmatched',
      'match_rate': 'Match Rate',
      'unmatched_rate': 'Unmatched Rate',
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
      'total_records': 'Total Rec.',
      'matched': 'Matched',
      'unmatched': 'Unmatched',
      'match_rate': 'Match %',
      'unmatched_rate': 'Unmatch %',
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
    // Handle "unmatched count" -> "UM count"
    if (lowerKey.includes('unmatched') && lowerKey.includes('amount')) {
      return 'UM amount';
    }
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

  // Reconcile current/saved columns with API keys
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

  // Helper: get source value from a row with dynamic key names
  const getSourceValue = (row: any): string | undefined => {
    if (!row || typeof row !== "object") return undefined;
    const keys = Object.keys(row);
    const exactOrder = [
      "SOURCE_NAME",
      "source_name",
      "Source_Name",
      "SOURCE",
      "source",
      "Source",
      "SOURCE NAME",
      "source name",
      "Source Name",
    ];
    const key =
      exactOrder.find((cand) => keys.includes(cand)) ??
      keys.find((k) => k.toLowerCase() === "source_name") ??
      keys.find((k) => k.toLowerCase() === "source");
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

  // === Fetch Summary Data ===
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

      const [cardsRes, tableRes] = await Promise.all([
        getSummaryCards(apiPayload),
        getSummaryTable(apiPayload),
      ]);

      const cardsPayload = cardsRes && typeof cardsRes === 'object' && 'data' in cardsRes ? (cardsRes as { status?: boolean; data?: any }).data : cardsRes;
      // Accept both wrapped ({ status, data }) and unwrapped (data object) responses.
      if (cardsPayload && typeof cardsPayload === 'object' && Object.keys(cardsPayload).length > 0) {
        setSummaryCards(cardsPayload);
      } else if (cardsRes && typeof cardsRes === 'object' && ((cardsRes as any).status === true || (cardsRes as any).status === 'true') && (cardsRes as any).data) {
        setSummaryCards((cardsRes as any).data);
      }
      // getSummaryTable returns { status, message, data: SummaryTableRow[] }
      const tablePayload = tableRes && typeof tableRes === 'object' && 'data' in tableRes ? (tableRes as { data?: any[] }).data : tableRes;
      const rows: any[] = Array.isArray(tablePayload) ? tablePayload : (Array.isArray(tableRes) ? tableRes : []);
      const tableSuccess = tableRes && (Array.isArray(tablePayload) || (tableRes as { status?: boolean }).status);
      if (tableSuccess) {
        setSummaryTable(rows);

        // Update columns when data is loaded
        if (rows.length > 0) {
          const apiKeys = Object.keys(rows[0]);
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
      console.error("Error fetching summary data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardData = async (source: string, operation: string) => {
    try {
      setLoadingDashboard(true);
      setDashboardDataClicked(true);
      setLastDashboardParams({ source, operation });

      const response = await getDashboardDataStreaming({
        flow_id: payload.flow_id,
        payload: { operation, source_name: source, all_records: !source },
        stmt_date: payload.stmt_date,
        cycle_number: payload.cycle_number,
      });

      const raw = await readDashboardJson(response);
      let rows: any[] = [];

      if (raw?.status === true) {
        rows = raw.data || [];
      } else if (Array.isArray(raw)) {
        rows = raw;
      } else if (Array.isArray(raw?.data)) {
        rows = raw.data;
      } else {
        console.warn('Unexpected response structure:', raw);
        setDashboardData([]);
        return;
      }

      if (rows.length > 0) {
        const sanitized = rows.map((row) => sanitizeKeys({
          ...row,
          visible: true,
        }));
        setDashboardData(sanitized);
      } else {
        setDashboardData([]);
      }
    } catch (err) {
      console.error(err);
      const message =
        getDisplayErrorMessage(err, "Failed to load dashboard data");
      toast.error(message);
      setDashboardData([]);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const refetchDashboardData = async () => {
    if (!dashboardDataClicked || !lastDashboardParams) return;
    await fetchDashboardData(lastDashboardParams.source, lastDashboardParams.operation);
  };

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
      refetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedCycle, cycleWiseOptions.length, loadingCycleWise]); // Refetch when date or cycle changes

  const handleRefreshSummary = () => {
    fetchSummaryData(false);
  };

  const handleRefreshDashboard = () => {
    if (lastDashboardParams) {
      void fetchDashboardData(lastDashboardParams.source, lastDashboardParams.operation);
    } else {
      toast.info("No dashboard data to refresh. Click on a cell in the summary table first.");
    }
  };

  function sanitizeKeys(row: any) {
    const newRow: any = {};
    Object.keys(row).forEach((key) => {
      const safeKey = key.replace(/\s+/g, "_"); // Replace spaces
      newRow[safeKey] = row[key];
    });
    return newRow;
  }

  const handleCellClick = useCallback(async (source: string, operation: string, value: number) => {
    if (value === 0) return;
    if (loadingDashboard) return;
    await fetchDashboardData(source, operation);
  }, [loadingDashboard, payload.cycle_number, payload.flow_id, payload.stmt_date]);



  const onExportCSV = () => {
    if (gridApi.current) {
      gridApi.current.exportDataAsCsv({
        fileName: "dashboard_data.csv",
      });
    } else {
      toast.error("Grid API not ready yet");
    }
  };

  const onExportExcel = () => {
    if (gridApi.current) {
      gridApi.current.exportDataAsExcel({
        fileName: "dashboard_data.xlsx",
        sheetName: "Dashboard",
        exportMode: "xlsx",
      });
    } else {
      toast.error("Grid API not ready yet");
    }
  };


  // Visible columns for summary table (used in rendering)
  const visibleSummaryColumns = summaryColumns.filter((c) => c.visible);

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

        // Match / unmatched rate formatting (exclude unmatched_* from "match" substring match)
        const colLc = col.toLowerCase();
        const isUnmatchedRateCol = colLc.includes('unmatched') && colLc.includes('rate');
        const isMatchRateCol =
          !isUnmatchedRateCol && colLc.includes('match') && colLc.includes('rate');
        if (isMatchRateCol || isUnmatchedRateCol) {
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
            const isClickable = !loadingDashboard && !isAmountColumn;
            record[col] = (
              <span
                className={
                  isClickable
                    ? "text-sm font-normal text-blue-600 cursor-pointer hover:underline"
                    : "text-sm font-normal text-foreground cursor-default"
                }
                onClick={
                  isClickable
                    ? () => handleCellClick(getSourceValue(row) || "", col, numericValue)
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
  }, [summaryTable, visibleSummaryColumns, loadingDashboard, handleCellClick]);

  // Calculate dynamic table height based on row count
  const tableHeight = useMemo(() => {
    // Header: ~40px, Each row: ~40px, Padding: ~20px
    const rowCount = summaryCTDData.length;
    const headerHeight = 40;
    const rowHeight = 40;
    const padding = 20;
    // Minimum height for 2 rows: header + 2 rows + padding = 40 + 80 + 20 = 140px
    const minHeightFor2Rows = headerHeight + (2 * rowHeight) + padding;
    // Calculated height based on actual rows
    const calculatedHeight = headerHeight + (rowCount * rowHeight) + padding;
    const maxHeight = 170; // Maximum height

    // Use calculated height, but ensure minimum for 2 rows and clamp to max
    const finalHeight = Math.max(minHeightFor2Rows, Math.min(calculatedHeight, maxHeight)) - 10;
    return `h-[${finalHeight}px]`;
  }, [summaryCTDData.length]);

  const getUnmatchedRateCardValue = (cards: typeof summaryCards) => {
    if (!cards) return 0;
    const raw = cards.unmatched_rate;
    if (raw !== undefined && raw !== null && raw !== "") return raw;
    const mr = Number(cards.match_rate);
    if (!Number.isNaN(mr)) return (100 - mr).toFixed(2);
    const total = Number(cards.total_records);
    const um = Number(cards.unmatched);
    if (total > 0 && !Number.isNaN(um)) return ((um / total) * 100).toFixed(2);
    return 0;
  };

  return (
    <div className="p-0 w-full">
      {/* Header with buttons */}
      <header className="flex items-center justify-between px-0 py-0 pb-1 border-gray-200 bg-background m-1 mb-0">
        <h1 className="text-sm font-semibold text-gray-800">
          <span className="font-semibold text-lg">Summary</span>
        </h1>
        <div className="flex items-center gap-2">
          <ShadTooltip content="Refresh Summary Table">
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-gray-100 h-7 w-7"
              onClick={handleRefreshSummary}
              disabled={loading}
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </ShadTooltip>

          {/* Statement Date Calendar */}
          {/* <ShadTooltip content="Select Statement Date"> */}
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
                  background-color: #0370f1 !important;
                  color: white !important;
                  font-weight: 600 !important;
                  border-radius: 10px !important;
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
                className="custom-calendar"
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
              />
            </PopoverContent>
          </Popover>
          {/* </ShadTooltip> */}



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

                  // If saveChartTable returns without throwing, it means the request was successful (HTTP 200)
                  // Check for explicit status field, but if not present, assume success
                  const hasStatusField = res && typeof res === 'object' && 'status' in res;
                  const isSuccess = hasStatusField
                    ? (res.status === true || res.status === 'true' || String(res.status) === 'true')
                    : true; // No status field means success (function only returns on HTTP 200)

                  if (isSuccess) {
                    toast.success(
                      (typeof res?.message === 'string' && res.message) || 'Settings saved successfully',
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
        </div>
      </header>

      {/* === Summary Cards === */}
      <div className="grid lg:grid-cols-5 md:grid-cols-2 gap-2 w-full mt-0">
        {["total_records", "matched", "unmatched", "match_rate", "unmatched_rate"].map((key, idx) => {
          const headerText = key.replace(/_/g, " ").toLowerCase();
          const formattedHeader = headerText.charAt(0).toUpperCase() + headerText.slice(1);
          const pctKeys = key === "match_rate" || key === "unmatched_rate";
          return (
            <div
              key={idx}
              className="bg-background dark:bg-gray-900 text-center h-14 p-1.5 flex flex-col justify-center items-center shadow-sm rounded-md border"
            >
              <div className="text-sm font-semibold">
                {formattedHeader}
              </div>
              <div
                className={`text-sm font-bold ${key === "matched"
                  ? "text-green-600"
                  : key === "unmatched"
                    ? "text-red-600"
                    : key === "match_rate"
                      ? "text-purple-600"
                      : key === "unmatched_rate"
                        ? "text-orange-600"
                        : "text-blue-600"
                  }`}
              >
                {loading
                  ? "..."
                  : pctKeys
                    ? `${key === "unmatched_rate" ? getUnmatchedRateCardValue(summaryCards) : summaryCards?.[key] ?? 0}%`
                    : summaryCards?.[key] ?? 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* === Summary Table (CustomTableData) === */}
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

      {/* === Dashboard Grid === */}
      {(loadingDashboard || dashboardData.length > 0 || dashboardDataClicked) && (
        <div className="border rounded-md shadow-sm">
          {loadingDashboard ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading Dashboard details...</p>
            </div>
          ) : dashboardData.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-sm text-red-600">No data available</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center p-1 border-b bg-background rounded-t-md">
                {/* Center Title */}
                <div className="flex-1 text-center font-semibold text-sm">
                  {/* Dashboard Data */}
                </div>

                <div className="flex gap-2 items-center">
                  <ShadTooltip content="Refresh Dashboard Table">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleRefreshDashboard}
                      disabled={loadingDashboard || !lastDashboardParams}
                    >
                      <RefreshCcw className={`h-3 w-3 ${loadingDashboard ? 'animate-spin' : ''}`} />
                    </Button>
                  </ShadTooltip>
                  <Button
                    onClick={onExportCSV}
                    variant="outline"
                    className="!h-8 !w-28 text-xs"
                  >
                    Download CSV
                  </Button>

                  <Button
                    onClick={onExportExcel}
                    variant="outline"
                    className="!h-8 !w-28 text-xs"
                  >
                    Download Excel
                  </Button>
                </div>

              </div>

              {/* AG Grid - bg-background so table uses theme colours */}
              <div
                className={`dashboard-grid-container flex-grow h-[400px] bg-background ${document.documentElement.classList.contains("dark")
                  ? "ag-theme-quartz-dark"
                  : "ag-theme-quartz"
                  }`}
              >
                <AgGridReact
                  rowHeight={30}
                  headerHeight={30}
                  ref={gridApi}
                  rowData={dashboardData}
                  groupDisplayType="multipleColumns"
                  rowGroupPanelShow="always"
                  rowDragManaged={true}
                  suppressMovableColumns={false}
                  allowDragFromColumnsToolPanel={true}
                  autoGroupColumnDef={{ minWidth: 200 }}
                  columnDefs={
                    dashboardData.length > 0
                      ? Object.keys(dashboardData[0]).map((key) => ({
                        field: key,
                        headerName: key.replace(/_/g, " ").toUpperCase(),
                        sortable: true,
                        filter: true,
                        resizable: true,
                        flex: 1,
                        enablePivot: false,     // ← REQUIRED
                        enableRowGroup: true,  // ← For row grouping
                        enableValue: false,     // ← For values in pivot table

                      }))
                      : []
                  }
                  defaultColDef={{
                    resizable: true,
                    sortable: true,
                    filter: true,
                    minWidth: 150,
                  }}
                  pivotMode={false}
                  suppressHorizontalScroll={false}
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
                    // defaultToolPanel: "columns",
                  }}
                  animateRows={true}
                  pagination={true}
                  paginationPageSize={20}
                  paginationPageSizeSelector={[10, 20, 50, 100]}
                  onGridReady={(params) => {
                    gridApi.current = params.api;
                    params.api.setSideBarVisible(true);
                    params.api.closeToolPanel();
                    // params.api.openToolPanel("columns");
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ------------- COLUMN MANAGER MODAL (SUMMARY TABLE) ------------- */}
      {showColumnManager && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background shadow-lg rounded-md w-96 p-4">
            <h2 className="text-sm font-semibold mb-3">Manage Summary Columns</h2>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tempColumns.map((col, index) => (
                <div
                  key={col.key}
                  className={`flex items-center gap-3 p-1.5 border rounded cursor-move transition-colors text-sm ${draggedIndex === index
                    ? 'bg-blue-100 border-blue-400 opacity-50'
                    : dragOverIndex === index
                      ? 'bg-blue-50 border-blue-300'
                      : 'bg-gray-50'
                    }`}
                  draggable
                  onDragStart={(e) => {
                    setDraggedIndex(index);
                    e.dataTransfer.setData("col-index", index.toString());
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverIndex !== index) {
                      setDragOverIndex(index);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === index) {
                      setDragOverIndex(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData("col-index"));
                    const to = index;

                    if (from === to) {
                      setDraggedIndex(null);
                      setDragOverIndex(null);
                      return;
                    }

                    // Insert-based reordering: remove from original position and insert at new position
                    const updated = [...tempColumns];
                    const [removed] = updated.splice(from, 1); // Remove from original position
                    updated.splice(to, 0, removed); // Insert at new position
                    setTempColumns(updated);
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  <Checkbox
                    checked={col.visible}
                    onCheckedChange={(checked) => {
                      const updated = [...tempColumns];
                      updated[index].visible = !!checked;
                      setTempColumns(updated);
                    }}
                  />
                  <span className="text-sm">{getOriginalName(col.key)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                className="text-sm h-8"
                onClick={() => {
                  // discard changes
                  setShowColumnManager(false);
                  setTempColumns(summaryColumns);
                }}
              >
                Close
              </Button>

              <Button
                className="text-sm h-8"
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
