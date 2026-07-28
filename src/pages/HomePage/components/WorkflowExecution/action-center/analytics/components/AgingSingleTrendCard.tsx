import { BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { agingCardSurface, agingEmptyState } from '../utils/agingUiTokens';
import { AGING_CHART_EXPANDED_DIALOG_HEIGHT } from '../utils/agingAmChartScrollbar';
import { AgingAnalyticsCardHeader } from './AgingAnalyticsCardHeader';
import {
  AgingChartExpandDialog,
  useAgingChartExpand,
} from './AgingChartExpandShell';
import {
  AgingTrendChartContent,
  type AgingTrendChartType,
  type AgingTrendLine,
} from './AgingTrendChart';
import type { AgingAmBarClickPayload } from './AgingAmChart';

interface AgingSingleTrendCardProps {
  title: string;
  subtitle?: string;
  data: Record<string, string | number>[];
  lines: AgingTrendLine[];
  chartType?: AgingTrendChartType;
  chartHeight?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipValueFormatter?: (value: number) => string;
  isLoading?: boolean;
  className?: string;
  onBarClick?: (payload: AgingAmBarClickPayload) => void;
}

export function AgingSingleTrendCard({
  title,
  subtitle = 'By statement date',
  data,
  lines,
  chartType = 'area',
  chartHeight = 200,
  yAxisFormatter,
  tooltipValueFormatter,
  isLoading,
  className,
  onBarClick,
}: AgingSingleTrendCardProps) {
  const canExpand = !isLoading && data.length > 0;
  const { open, setOpen, expandButton } = useAgingChartExpand(!canExpand);

  const chartContent = (height: number) => (
    <AgingTrendChartContent
      data={data}
      lines={lines}
      chartType={chartType}
      height={height}
      yAxisFormatter={yAxisFormatter}
      tooltipValueFormatter={tooltipValueFormatter}
      onBarClick={onBarClick}
    />
  );

  return (
    <Card className={cn(agingCardSurface, 'flex shrink-0 flex-col p-0', className)}>
      <AgingAnalyticsCardHeader
        icon={BarChart3}
        title={title}
        subtitle={subtitle}
        trailing={expandButton}
      />
      <CardContent className="px-3 pb-3 pt-1">
        {isLoading ? (
          <div
            className={cn('flex items-center justify-center', agingEmptyState)}
            style={{ height: chartHeight }}
          >
            Loading trends…
          </div>
        ) : (
          chartContent(chartHeight)
        )}
      </CardContent>

      <AgingChartExpandDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        subtitle={subtitle}
      >
        {chartContent(AGING_CHART_EXPANDED_DIALOG_HEIGHT)}
      </AgingChartExpandDialog>
    </Card>
  );
}
