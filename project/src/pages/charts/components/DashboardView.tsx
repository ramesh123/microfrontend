import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, Maximize2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartType, Config } from './ChartConfigurator';
import type { Thread } from '../ChartFormulator/types';
import { DrilldownFilter } from './DrilldownBreadcrumb';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export interface SavedChart {
  id: string;
  name: string;
  chartType: ChartType;
  config: Config;
  threadId: string;
  filters: DrilldownFilter[];
  modified: Date;
  creator: string;
  creatorAvatar: string;
}

interface DashboardViewProps {
  charts: SavedChart[];
  threads: Thread[];
  onNavigateToFormulator: () => void;
  dashboardCharts: SavedChart[];
  onRemoveChart: (chartId: string) => void;
  onMaximizeChart: (chart: SavedChart) => void;
  onDeleteSavedChart: (chartId: string) => void;
}

function ChartCard({
  chart,
  onMaximize,
  onRemove,
  onDelete,
}: {
  chart: SavedChart;
  onMaximize: (chart: SavedChart) => void;
  onRemove: (chartId: string) => void;
  onDelete: (chartId: string) => void;
}) {
  return (
    <Card className="group relative">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium">{chart.name}</CardTitle>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onMaximize(chart)}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onRemove(chart.id)}
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive"
              onClick={() => onDelete(chart.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
          <chart.chartType.icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {chart.chartType.name}
        </div>
      </CardContent>
    </Card>
  );
}

function DropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'dashboard-drop-zone',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[200px] rounded-lg border-2 border-dashed p-4 transition-colors',
        isOver && 'border-primary bg-primary/5'
      )}
    >
      {children}
    </div>
  );
}

export function DashboardView({
  charts,
  threads,
  onNavigateToFormulator,
  dashboardCharts,
  onRemoveChart,
  onMaximizeChart,
  onDeleteSavedChart,
}: DashboardViewProps) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Button onClick={onNavigateToFormulator}>
          <Plus className="h-4 w-4 mr-2" />
          Create Chart
        </Button>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {dashboardCharts.length === 0 ? (
          <DropZone>
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                No charts on dashboard
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                Drag charts here or create a new one
              </p>
              <Button onClick={onNavigateToFormulator}>
                <Plus className="h-4 w-4 mr-2" />
                Create Chart
              </Button>
            </div>
          </DropZone>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {dashboardCharts.map((chart) => (
              <ChartCard
                key={chart.id}
                chart={chart}
                onMaximize={onMaximizeChart}
                onRemove={onRemoveChart}
                onDelete={onDeleteSavedChart}
              />
            ))}
          </div>
        )}

        {charts.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4">Saved Charts</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {charts.map((chart) => (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  onMaximize={onMaximizeChart}
                  onRemove={() => {}}
                  onDelete={onDeleteSavedChart}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

