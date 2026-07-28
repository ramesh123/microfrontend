import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Download, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface NWayMatchingResponse {
  status: boolean;
  message: string;
  data: {
    [sourceName: string]: Record<string, any>[];
  };
}

/** Cap DOM rows so multi‑MB API payloads do not freeze the UI. */
const PREVIEW_PAGE_SIZE = 200;

const MatchStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const normalizedStatus = (status ?? '').toUpperCase();

  if (normalizedStatus.includes('UNMATCHED')) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1 bg-red-100 text-red-800">
        <XCircle size={12} />
        {status}
      </Badge>
    );
  }
  if (normalizedStatus.includes('MATCHED')) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
        <CheckCircle2 size={12} />
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <HelpCircle size={12} />
      {status}
    </Badge>
  );
};

const DataTable: React.FC<{ records: Record<string, any>[], sourceName: string }> = ({ records, sourceName }) => {
  const [filter, setFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PREVIEW_PAGE_SIZE);

  const loadMore = useCallback(() => {
    setVisibleCount((n) => n + PREVIEW_PAGE_SIZE);
  }, []);

  useEffect(() => {
    setVisibleCount(PREVIEW_PAGE_SIZE);
  }, [sourceName, filter, records.length]);

  const columns = useMemo(() => {
    if (records.length === 0) return [];
    const allKeys = new Set<string>();
    records.forEach(record => Object.keys(record).forEach(key => allKeys.add(key)));
    const preferredOrder = ['RECONCILIATION_STATUS', 'Final Match', 'Rule Name'];
    return [
      ...preferredOrder.filter(key => allKeys.has(key)),
      ...Array.from(allKeys).filter(key => !preferredOrder.includes(key)).sort()
    ];
  }, [records]);

  // Memoize records that have a valid status to avoid re-filtering
  const recordsWithStatus = useMemo(() => {
    return records.filter(r => r.RECONCILIATION_STATUS !== null && r.RECONCILIATION_STATUS !== undefined && r.RECONCILIATION_STATUS !== '');
  }, [records]);

  // Derive status counts from the pre-filtered list of records
  const statusCounts = useMemo(() => {
    return recordsWithStatus.reduce((acc, record) => {
      const status = record.RECONCILIATION_STATUS;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [recordsWithStatus]);

  // When filtering, use the pre-filtered list for consistency
  const filteredRecords = useMemo(() => {
    if (filter === 'all') {
      return recordsWithStatus;
    }
    return recordsWithStatus.filter(r => r.RECONCILIATION_STATUS === filter);
  }, [recordsWithStatus, filter]);

  const visibleRecords = useMemo(
    () => filteredRecords.slice(0, visibleCount),
    [filteredRecords, visibleCount]
  );
  const hasMore = visibleCount < filteredRecords.length;

  const handleDownload = async () => {
    if (!filteredRecords.length) return;
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.json_to_sheet(filteredRecords);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sourceName);
    XLSX.writeFile(workbook, `${sourceName}_Matching_Results.xlsx`);
  };

  return (
    <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6 pt-0">
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter by Status:</span>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              {/* The "All" option now correctly reflects the count of records with a status */}
              <SelectItem value="all">All ({recordsWithStatus.length})</SelectItem>
              {Object.entries(statusCounts).map(([status, count]) => (
                <SelectItem key={status} value={status}>{status} ({count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleDownload} size="sm" variant="outline" disabled={!filteredRecords.length}>
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>

      {filteredRecords.length > PREVIEW_PAGE_SIZE && (
        <p className="flex-shrink-0 text-xs text-muted-foreground">
          Showing {visibleRecords.length.toLocaleString()} of {filteredRecords.length.toLocaleString()} rows.
          Use Download for the full dataset.
        </p>
      )}

      <div
        className="min-h-0 flex-1 overflow-auto rounded-lg border bg-background scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
        role="region"
        aria-label={`${sourceName} matching results table`}
        tabIndex={0}
      >
        {/* Native table (not ui/Table) so sticky headers work inside this scroll container */}
        <table className="min-w-max w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="border-b">
              {columns.map(col => (
                <th
                  key={col}
                  className="sticky top-0 z-20 border-b bg-muted px-3 py-2 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground shadow-[0_1px_0_0_hsl(var(--border))]"
                >
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <TableBody>
            {visibleRecords.length > 0 ? visibleRecords.map((record, idx) => (
              <TableRow key={idx} className={cn(record.RECONCILIATION_STATUS?.includes('UNMATCHED') && 'bg-red-50/50')}>
                {columns.map(col => (
                  <TableCell key={col} className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    {col.toUpperCase().includes('MATCH') || col.toUpperCase().includes('STATUS') ? (
                      <MatchStatusBadge status={String(record[col] ?? 'N/A')} />
                    ) : (
                      String(record[col] ?? '-')
                    )}
                  </TableCell>
                ))}
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No records found for this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>
      {hasMore && (
        <div className="flex flex-shrink-0 justify-center pt-2">
          <Button type="button" variant="outline" size="sm" onClick={loadMore}>
            Load more ({Math.min(PREVIEW_PAGE_SIZE, filteredRecords.length - visibleCount).toLocaleString()} rows)
          </Button>
        </div>
      )}
    </CardContent>
  );
};

const NWayMatchingTable: React.FC<{ apiResponse: NWayMatchingResponse }> = ({ apiResponse }) => {
  const sourceNames = useMemo(() => Object.keys(apiResponse?.data || {}), [apiResponse]);
  const [activeSource, setActiveSource] = useState<string>('');

  useEffect(() => {
    if (sourceNames.length > 0) {
      setActiveSource((prev) => (sourceNames.includes(prev) ? prev : sourceNames[0]));
    } else {
      setActiveSource('');
    }
  }, [sourceNames]);

  if (!apiResponse?.data || sourceNames.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground">No Matching Data Available</h3>
            <p className="text-sm text-muted-foreground">Execute the node to see the matching results.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeRecords = activeSource ? apiResponse.data[activeSource] ?? [] : [];

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden p-4">
      <Tabs value={activeSource} onValueChange={setActiveSource} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="flex-shrink-0">
          {sourceNames.map(name => (
            <TabsTrigger key={name} value={name}>{name}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent
          value={activeSource}
          className="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0 pb-3">
              <CardTitle className="text-base">Matching Results for: {activeSource}</CardTitle>
            </CardHeader>
            <DataTable records={activeRecords} sourceName={activeSource} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NWayMatchingTable;
