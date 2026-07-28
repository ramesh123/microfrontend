import React from 'react';
import { EnterprisePivotTable } from './EnterprisePivotTable';
import type { PivotRawResponse } from './EnterprisePivotTable';
import { cn } from '@/lib/utils';
import type { TableChartConfig } from '../../Tablechartcustomization';

export type { PivotRawResponse };

export type OnPivotRowExpand = (params: {
  dimension: string;
  value: string;
}) => Promise<PivotRawResponse | null>;

interface PivotChartProps {
  data: Array<{ category: string; value: number; originalData: any }>;
  rawResponse?: PivotRawResponse | Record<string, unknown> | null;
  chartName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onRowExpand?: OnPivotRowExpand;
  nestingLevel?: number;
  forceMock?: boolean;
  mockResponse?: PivotRawResponse;
  flowId?: string;
  selectedSource?: string | null;
  /** Same customize config shape as table chart. */
  config?: TableChartConfig | null;
}

export function PivotChart({
  data,
  rawResponse,
  chartName = 'Pivot Table',
  icon: IconComponent,
  flowId,
  selectedSource,
  config,
}: PivotChartProps) {
  return (
    <div className={cn('flex w-full flex-col h-full min-h-0')}>
      <EnterprisePivotTable
        data={data}
        rawResponse={rawResponse}
        chartName={chartName}
        icon={IconComponent}
        flowId={flowId}
        selectedSource={selectedSource}
        config={config ?? undefined}
      />
    </div>
  );
}
