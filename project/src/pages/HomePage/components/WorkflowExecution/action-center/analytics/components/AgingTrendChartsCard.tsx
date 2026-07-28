import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AgingSegmentToggle } from './AgingSegmentToggle';
import {
  AgingTrendChartContent,
  type AgingTrendChartType,
  type AgingTrendLine,
} from './AgingTrendChart';

export type AgingTrendChartView = 'amount' | 'count';

interface TrendViewConfig {
  id: AgingTrendChartView;
  label: string;
  title: string;
  data: Record<string, string | number>[];
  lines: AgingTrendLine[];
  chartType?: AgingTrendChartType;
  yAxisFormatter?: (value: number) => string;
  tooltipValueFormatter?: (value: number) => string;
}

interface AgingTrendChartsCardProps {
  views: TrendViewConfig[];
  defaultView?: AgingTrendChartView;
  className?: string;
  chartHeight?: number | '100%';
  isLoading?: boolean;
}

export function AgingTrendChartsCard({
  views,
  defaultView = 'amount',
  className,
  chartHeight = '100%',
  isLoading,
}: AgingTrendChartsCardProps) {
  const [activeView, setActiveView] = useState<AgingTrendChartView>(defaultView);
  const activeConfig = views.find((v) => v.id === activeView) ?? views[0];
  const fillHeight = chartHeight === '100%';

  return (
    <Card
      className={cn(
        'overflow-hidden border-border/60 shadow-sm p-0 flex min-h-0 flex-col',
        className,
      )}
    >
      <CardHeader className="shrink-0 px-3 py-2 flex flex-row items-center justify-between gap-2 space-y-0 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <BarChart3 className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{activeConfig?.title ?? 'Trends'}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">By statement date</p>
          </div>
        </div>
        <AgingSegmentToggle<AgingTrendChartView>
          options={views.map((v) => ({ id: v.id, label: v.label }))}
          value={activeView}
          onChange={setActiveView}
        />
      </CardHeader>
      <CardContent
        className={cn(
          'px-2 pb-2 pt-0',
          fillHeight ? 'flex min-h-0 flex-1 flex-col' : 'pt-1',
        )}
      >
        {isLoading ? (
          <div
            className={cn(
              'flex flex-1 items-center justify-center text-xs text-muted-foreground',
              !fillHeight && 'min-h-[180px]',
            )}
            style={!fillHeight && typeof chartHeight === 'number' ? { height: chartHeight } : undefined}
          >
            Loading trends…
          </div>
        ) : activeConfig ? (
          <div className={cn(fillHeight && 'min-h-0 flex-1')}>
            <AgingTrendChartContent
              key={activeConfig.id}
              data={activeConfig.data}
              lines={activeConfig.lines}
              chartType={activeConfig.chartType ?? 'bar'}
              height={chartHeight}
              yAxisFormatter={activeConfig.yAxisFormatter}
              tooltipValueFormatter={activeConfig.tooltipValueFormatter}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
