import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isThemeDarkAppearance, useTheme } from '@/context/theme';
import {
  deviceTypeWiseToBarItems,
  fetchBarChartDeviceTypeWise,
  type SimulationDeviceTypeAlert,
} from '@/controllers/API/simulationTrackApi';
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { cn } from '@/lib/utils';

import {
  buildSimulationFilterApiBody,
  formatDeviceTypeTwoLineLabel,
  formatSimulationNumber,
} from '../simulationTrackDashboardUtils';
import type { SimulationFilter } from '../types';
import { DeviceTypeIcon, useDeviceTypeVisual } from './DeviceTypeIcon';
import {
  createDeviceTypeBarAm5Chart,
  disposeAm5Root,
} from './deviceTypeBarAm5Chart';
import { SeverityRingsRow } from './SeverityRing';

type SimulationDeviceTypeChartsProps = {
  runId?: string;
  filters?: SimulationFilter;
};

/** Fixed plot area — bar chart (left) and scrollable severity grid (right). */
export const DEVICE_TYPE_PANEL_HEIGHT = 280;

function DeviceTypeNameLabel({ deviceType, color }: { deviceType: string; color: string }) {
  const { line1, line2 } = formatDeviceTypeTwoLineLabel(deviceType);

  return (
    <h4
      className="w-full text-center text-xs font-bold leading-snug"
      style={{ color }}
      title={deviceType}
    >
      <span className="block">{line1}</span>
      {line2 ? <span className="block font-semibold">{line2}</span> : null}
    </h4>
  );
}

function DeviceTypeSeverityMiniCard({ item }: { item: SimulationDeviceTypeAlert }) {
  const visual = useDeviceTypeVisual(item.device_type);

  const total = useMemo(() => {
    const sum =
      item.critical_count + item.high_count + item.medium_count + item.low_count;
    return item.total_alerts || sum;
  }, [item]);

  return (
    <article
      className={cn(
        'flex w-full flex-row items-stretch gap-2 rounded-lg border border-border/60',
        'bg-gradient-to-r from-card via-card to-muted/10 px-2 py-2 shadow-sm',
        'transition-shadow hover:border-border hover:shadow-md',
      )}
      title={`${item.device_type} — ${formatSimulationNumber(item.total_alerts)} alerts`}
    >
      <div className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border/40 pr-1.5">
        <DeviceTypeIcon deviceType={item.device_type} />
        <DeviceTypeNameLabel deviceType={item.device_type} color={visual.accentColor} />
        <p className="text-center text-[11px] font-medium leading-tight text-muted-foreground">
          {formatSimulationNumber(item.total_alerts)} alerts
        </p>
      </div>

      <div className="min-w-0 flex-1 py-1">
        {total <= 0 ? (
          <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No severity data
          </p>
        ) : (
          <SeverityRingsRow
            critical={item.critical_count}
            high={item.high_count}
            medium={item.medium_count}
            low={item.low_count}
            total={total}
            compact
          />
        )}
      </div>
    </article>
  );
}

function DeviceTypeSeverityGrid({ items }: { items: SimulationDeviceTypeAlert[] }) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.total_alerts - a.total_alerts),
    [items],
  );

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {sorted.map((item) => (
        <DeviceTypeSeverityMiniCard key={item.device_type} item={item} />
      ))}
    </div>
  );
}

export function SimulationDeviceTypeCharts({ runId, filters }: SimulationDeviceTypeChartsProps) {
  const barChartId = useId().replace(/:/g, '');
  const rootRef = useRef<ReturnType<typeof createDeviceTypeBarAm5Chart> | null>(null);

  const { theme } = useTheme();
  const isDark = isThemeDarkAppearance(theme);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceTypes, setDeviceTypes] = useState<SimulationDeviceTypeAlert[]>([]);
  const [totalDeviceTypes, setTotalDeviceTypes] = useState(0);

  const apiBody = useMemo(
    () =>
      buildSimulationFilterApiBody(filters ?? { timeRange: 'all' }, {
        run_id: runId || undefined,
      }),
    [filters, runId],
  );

  const loadCharts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBarChartDeviceTypeWise(apiBody);
      if (!response.success) {
        setDeviceTypes([]);
        setTotalDeviceTypes(0);
        setError('Device type chart data is unavailable.');
        return;
      }
      setDeviceTypes(response.data);
      setTotalDeviceTypes(response.total_device_types);
    } catch (err) {
      setDeviceTypes([]);
      setTotalDeviceTypes(0);
      setError(getDisplayErrorMessage(err, 'Failed to load device type charts.'));
    } finally {
      setLoading(false);
    }
  }, [apiBody]);

  useEffect(() => {
    void loadCharts();
  }, [loadCharts]);

  const barItems = useMemo(
    () =>
      deviceTypeWiseToBarItems({
        success: true,
        total_device_types: totalDeviceTypes,
        data: deviceTypes,
      }),
    [deviceTypes, totalDeviceTypes],
  );

  const totalAlerts = useMemo(
    () => barItems.reduce((sum, item) => sum + item.alert_count, 0),
    [barItems],
  );

  useLayoutEffect(() => {
    disposeAm5Root(rootRef.current);
    rootRef.current = null;
    if (!barItems.length || loading || error) return;

    const root = createDeviceTypeBarAm5Chart(barChartId, barItems);
    rootRef.current = root;

    return () => {
      disposeAm5Root(rootRef.current);
      rootRef.current = null;
    };
  }, [barChartId, barItems, error, isDark, loading, theme]);

  if (loading) {
    return (
      <div className="flex min-h-[10rem] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading device type charts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!deviceTypes.length) {
    return (
      <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-4 text-center text-sm text-muted-foreground">
        No device type chart data available.
      </div>
    );
  }

  return (
    <div className="grid items-start gap-2 lg:grid-cols-2">
      <Card className="flex flex-col overflow-hidden rounded-lg border border-border/80 bg-card py-0 shadow-sm gap-0">
        <CardHeader className="shrink-0 space-y-0 px-3 pt-2 pb-0">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Alerts by device type
          </CardTitle>
        </CardHeader>
        <CardContent className="shrink-0 px-2 pb-2 pt-0">
          <div
            className="overflow-hidden rounded-md border border-border/50 bg-muted/10"
            style={{ height: DEVICE_TYPE_PANEL_HEIGHT }}
          >
            <div
              id={barChartId}
              className="h-full w-full [&_.am5-layer]:outline-none"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden rounded-lg border border-border/80 bg-card py-0 shadow-sm gap-0">
        <CardHeader className="shrink-0 space-y-0 px-3 pt-2 pb-0">
          <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
            Severity by equipment type
          </CardTitle>
        </CardHeader>
        <CardContent className="shrink-0 px-2 pb-2 pt-0">
          <div
            className="overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-md border border-border/50 bg-muted/10 pr-1"
            style={{ height: DEVICE_TYPE_PANEL_HEIGHT, maxHeight: DEVICE_TYPE_PANEL_HEIGHT }}
          >
            <div className="px-1.5 py-1.5">
              <DeviceTypeSeverityGrid items={deviceTypes} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
