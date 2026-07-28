import { useCallback, useRef, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { getReconciliationDetails } from '@/controllers/API/ReconcilationAPI';
import {
  buildColDefs,
  buildReconciliationDetailsPayload,
  normaliseReconciliationDetailsResponse,
} from '../utils/agingReconciliationDetailsShared';

export interface AgingChartClickParams {
  statementDate: string;
  dataKey: string;
}

interface UseAgingReconciliationDetailsOptions {
  flowId?: string;
  sourceNames: string[];
}

export function useAgingReconciliationDetails({
  flowId,
  sourceNames,
}: UseAgingReconciliationDetailsOptions) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsData, setDetailsData] = useState<Record<string, unknown>[]>([]);
  const [detailsColumns, setDetailsColumns] = useState<ColDef[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedSourceName, setSelectedSourceName] = useState<string | null>(null);
  const [activeParams, setActiveParams] = useState<AgingChartClickParams | null>(null);
  const fetchIdRef = useRef(0);

  const fetchDetails = useCallback(
    async (params: AgingChartClickParams, sourceName: string | null) => {
      if (!flowId) return;

      const thisFetchId = ++fetchIdRef.current;
      setDetailsLoading(true);

      try {
        const raw = await getReconciliationDetails(
          buildReconciliationDetailsPayload({
            flowId,
            statementDate: params.statementDate,
            sourceNames: sourceName ? [sourceName] : [],
            dataKey: params.dataKey,
          }),
        );

        if (thisFetchId !== fetchIdRef.current) return;

        const { records, count } = normaliseReconciliationDetailsResponse(raw);
        setDetailsColumns(records.length > 0 ? buildColDefs(records[0]) : []);
        setDetailsData(records);
        setTotalRows(count);
      } catch (error) {
        if (thisFetchId !== fetchIdRef.current) return;
        console.error('[AgingReconciliationDetails] fetchDetails error:', error);
        setDetailsData([]);
        setDetailsColumns([]);
        setTotalRows(0);
      } finally {
        if (thisFetchId === fetchIdRef.current) setDetailsLoading(false);
      }
    },
    [flowId],
  );

  const handleChartClick = useCallback(
    (params: AgingChartClickParams) => {
      if (!flowId) return;

      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
      setDetailsOpen(true);
      setActiveParams(params);

      const defaultSource = sourceNames[0] || null;
      setSelectedSourceName(defaultSource);
      void fetchDetails(params, defaultSource);
    },
    [flowId, fetchDetails, sourceNames],
  );

  const handleBarClick = useCallback(
    (payload: { row: Record<string, string | number>; dataKey: string }) => {
      const statementDate = String(payload.row.statement_date ?? '').trim();
      if (!statementDate) return;

      handleChartClick({
        statementDate,
        dataKey: payload.dataKey,
      });
    },
    [handleChartClick],
  );

  const handleSourceTabChange = useCallback(
    (sourceName: string) => {
      setSelectedSourceName(sourceName);
      if (activeParams) {
        setDetailsData([]);
        setDetailsColumns([]);
        setTotalRows(0);
        void fetchDetails(activeParams, sourceName);
      }
    },
    [activeParams, fetchDetails],
  );

  const handleSheetOpenChange = useCallback((nextOpen: boolean) => {
    setDetailsOpen(nextOpen);
    if (!nextOpen) {
      fetchIdRef.current++;
      setDetailsData([]);
      setDetailsColumns([]);
      setTotalRows(0);
      setDetailsLoading(false);
      setActiveParams(null);
      setSelectedSourceName(null);
    }
  }, []);

  return {
    detailsOpen,
    detailsData,
    detailsColumns,
    detailsLoading,
    totalRows,
    selectedSourceName,
    handleChartClick,
    handleBarClick,
    handleSourceTabChange,
    handleSheetOpenChange,
    activeParams,
  };
}
