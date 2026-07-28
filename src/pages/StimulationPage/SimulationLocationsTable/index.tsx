
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  SimulationDeviceTypeAlert,
  SimulationInterlockAlert,
  SimulationLocationData,
  SimulationTrackRun,
} from '@/controllers/API/simulationTrackApi';
import { cn } from '@/lib/utils';
import { formatSimulationDateTime, formatSimulationNumber } from '../simulationTrackDashboardUtils';

type SimulationLocationsTableProps = {
  runs: SimulationTrackRun[];
  selectedRunId: string;
  onRunChange: (runId: string) => void;
};

const ALL_LOCATIONS_VALUE = 'all';
const COMBOBOX_CLASS = 'h-[28px] min-h-[28px] w-[12rem] px-2 py-0 text-[11px] font-normal';
const SIMULATION_TABLE_CLASS = cn(
  'w-full border-collapse text-xs',
  '[&_th]:border [&_th]:border-solid [&_th]:border-border/60',
  '[&_td]:border [&_td]:border-solid [&_td]:border-border/60',
  '[&_tr]:border-0',
);
const TABLE_HEADER_CLASS =
  'sticky top-0 z-30 bg-muted [&_tr]:border-0 [&_tr]:bg-muted [&_tr:hover]:bg-muted';
const TABLE_HEADER_ROW_CLASS = 'border-0 bg-muted hover:bg-muted';
const TABLE_HEAD_CLASS =
  '!h-auto !min-h-[36px] bg-muted px-2 py-2 text-xs font-semibold uppercase leading-tight tracking-wide text-foreground/80 [box-shadow:inset_-1px_0_0_0_var(--border)]';
const TABLE_HEAD_SEVERITY_CLASS = cn(TABLE_HEAD_CLASS, 'border-b-0 pb-1 text-center align-bottom');
const TABLE_HEAD_SUB_CLASS =
  '!h-auto !min-h-[32px] bg-muted px-2 py-1.5 text-[11px] font-semibold uppercase leading-tight tracking-wide text-foreground/80 [box-shadow:inset_-1px_0_0_0_var(--border)] border-t-0 pt-0';
const TABLE_BODY_ROW_CLASS = 'border-0 bg-background hover:bg-muted/40';
const TABLE_BODY_CLASS = '[&_tr]:bg-background';
const TABLE_BODY_CELL = 'px-2 py-1 text-xs leading-tight';
const TABLE_NUM_CELL = cn(TABLE_BODY_CELL, 'text-center tabular-nums text-foreground');
const EXPANDED_GROUP_CELL = '!bg-muted/35 hover:!bg-muted/50';
const TOTAL_ROW_CELL =
  '!bg-muted/80 font-semibold sticky bottom-0 z-10';

const MAIN_COLUMN_COUNT = 9;

const SEVERITY_LEVELS = {
  critical: 'text-destructive',
  high: 'text-orange-600 dark:text-orange-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  low: 'text-green-600 dark:text-green-400',
} as const;

const SEVERITY_SUB_HEADERS = [
  { key: 'critical', label: 'Critical' },
  { key: 'high', label: 'High' },
  { key: 'medium', label: 'Medium' },
  { key: 'low', label: 'Low' },
] as const satisfies ReadonlyArray<{ key: keyof typeof SEVERITY_LEVELS; label: string }>;

function SeveritySubHeaders() {
  return SEVERITY_SUB_HEADERS.map(({ key, label }) => (
    <TableHead key={key} className={cn(TABLE_HEAD_SUB_CLASS, 'text-center', SEVERITY_LEVELS[key])}>
      {label}
    </TableHead>
  ));
}

function locationOptionValue(location: SimulationLocationData): string {
  return `${location.location_name}|${location.sap_id}`;
}

function SeverityCountCell({
  value,
  level,
  className,
}: {
  value: number;
  level: keyof typeof SEVERITY_LEVELS;
  className?: string;
}) {
  const hasValue = value > 0;

  return (
    <TableCell className={cn(TABLE_NUM_CELL, className)}>
      <span
        className={cn(
          'tabular-nums',
          hasValue ? cn('font-bold', SEVERITY_LEVELS[level]) : 'font-normal text-muted-foreground/50',
        )}
      >
        {formatSimulationNumber(value)}
      </span>
    </TableCell>
  );
}

function InterlockRow({ interlock }: { interlock: SimulationInterlockAlert }) {
  return (
    <TableRow className="border-0">
      <TableCell
        colSpan={2}
        className={cn(TABLE_BODY_CELL, EXPANDED_GROUP_CELL, 'min-w-[12rem] pl-14 text-xs text-foreground/85')}
      >
        {interlock.interlock_name}
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, EXPANDED_GROUP_CELL)}>
        {formatSimulationNumber(interlock.total_alerts)}
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, EXPANDED_GROUP_CELL)}>
        {formatSimulationNumber(interlock.open_count)}
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, EXPANDED_GROUP_CELL)}>
        {formatSimulationNumber(interlock.closed_count)}
      </TableCell>
      <SeverityCountCell value={interlock.critical_count} level="critical" className={EXPANDED_GROUP_CELL} />
      <SeverityCountCell value={interlock.high_count} level="high" className={EXPANDED_GROUP_CELL} />
      <SeverityCountCell value={interlock.medium_count} level="medium" className={EXPANDED_GROUP_CELL} />
      <SeverityCountCell value={interlock.low_count} level="low" className={EXPANDED_GROUP_CELL} />
    </TableRow>
  );
}

function DeviceTypeRow({
  deviceType,
  locationKey,
}: {
  deviceType: SimulationDeviceTypeAlert;
  locationKey: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasInterlocks = deviceType.interlocks.length > 0;
  const groupActive = expanded && hasInterlocks;

  return (
    <>
      <TableRow className={cn(TABLE_BODY_ROW_CLASS, groupActive && 'hover:[&_td]:!bg-muted/45')}>
        <TableCell className={cn(TABLE_BODY_CELL, 'min-w-[12rem] font-medium', groupActive && EXPANDED_GROUP_CELL)}>
          <div className="flex items-center gap-0.5 pl-8">
            {hasInterlocks ? (
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted/60"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse interlocks' : 'Expand interlocks'}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
            )}
            <span className="text-xs">
              {deviceType.device_type}
              <span className="ml-1 font-normal text-muted-foreground">
                ({formatSimulationNumber(deviceType.distinct_interlocks_count)} interlocks)
              </span>
            </span>
          </div>
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, 'text-muted-foreground', groupActive && EXPANDED_GROUP_CELL)}>
          —
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, 'font-semibold', groupActive && EXPANDED_GROUP_CELL)}>
          {formatSimulationNumber(deviceType.total_alerts)}
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, groupActive && EXPANDED_GROUP_CELL)}>
          {formatSimulationNumber(deviceType.open_count)}
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, groupActive && EXPANDED_GROUP_CELL)}>
          {formatSimulationNumber(deviceType.closed_count)}
        </TableCell>
        <SeverityCountCell value={deviceType.critical_count} level="critical" className={groupActive ? EXPANDED_GROUP_CELL : undefined} />
        <SeverityCountCell value={deviceType.high_count} level="high" className={groupActive ? EXPANDED_GROUP_CELL : undefined} />
        <SeverityCountCell value={deviceType.medium_count} level="medium" className={groupActive ? EXPANDED_GROUP_CELL : undefined} />
        <SeverityCountCell value={deviceType.low_count} level="low" className={groupActive ? EXPANDED_GROUP_CELL : undefined} />
      </TableRow>

      {expanded && hasInterlocks
        ? deviceType.interlocks.map((interlock) => (
            <InterlockRow
              key={`${locationKey}-${deviceType.device_type}-${interlock.interlock_name}`}
              interlock={interlock}
            />
          ))
        : null}
    </>
  );
}

function LocationRow({ location }: { location: SimulationLocationData }) {
  const [expanded, setExpanded] = useState(false);
  const hasDeviceTypes = location.device_types.length > 0;
  const locationKey = `${location.location_name}-${location.sap_id}`;
  const groupActive = expanded && hasDeviceTypes;

  return (
    <>
      <TableRow className={cn(TABLE_BODY_ROW_CLASS, groupActive && 'hover:[&_td]:!bg-muted/45')}>
        <TableCell className={cn(TABLE_BODY_CELL, 'min-w-[12rem] font-medium', groupActive && EXPANDED_GROUP_CELL)}>
          <div className="flex items-center gap-0.5">
            {hasDeviceTypes ? (
              <button
                type="button"
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted/60"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse device types' : 'Expand device types'}
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block h-5 w-5 shrink-0" aria-hidden />
            )}
            <span className="text-xs">{location.location_name}</span>
          </div>
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, 'font-mono', groupActive && EXPANDED_GROUP_CELL)}>
          {location.sap_id}
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, 'font-semibold', groupActive && EXPANDED_GROUP_CELL)}>
          {formatSimulationNumber(location.total_alerts)}
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, groupActive && EXPANDED_GROUP_CELL)}>
          {formatSimulationNumber(location.open_count)}
        </TableCell>
        <TableCell className={cn(TABLE_NUM_CELL, groupActive && EXPANDED_GROUP_CELL)}>
          {formatSimulationNumber(location.closed_count)}
        </TableCell>
        <SeverityCountCell
          value={location.critical_count}
          level="critical"
          className={groupActive ? EXPANDED_GROUP_CELL : undefined}
        />
        <SeverityCountCell
          value={location.high_count}
          level="high"
          className={groupActive ? EXPANDED_GROUP_CELL : undefined}
        />
        <SeverityCountCell
          value={location.medium_count}
          level="medium"
          className={groupActive ? EXPANDED_GROUP_CELL : undefined}
        />
        <SeverityCountCell
          value={location.low_count}
          level="low"
          className={groupActive ? EXPANDED_GROUP_CELL : undefined}
        />
      </TableRow>

      {expanded && hasDeviceTypes
        ? location.device_types.map((deviceType) => (
            <DeviceTypeRow
              key={`${locationKey}-${deviceType.device_type}`}
              locationKey={locationKey}
              deviceType={deviceType}
            />
          ))
        : null}
    </>
  );
}

function TotalRow({ locations }: { locations: SimulationLocationData[] }) {
  const totals = useMemo(
    () =>
      locations.reduce(
        (acc, loc) => ({
          total_alerts: acc.total_alerts + loc.total_alerts,
          open_count: acc.open_count + loc.open_count,
          closed_count: acc.closed_count + loc.closed_count,
          critical_count: acc.critical_count + loc.critical_count,
          high_count: acc.high_count + loc.high_count,
          medium_count: acc.medium_count + loc.medium_count,
          low_count: acc.low_count + loc.low_count,
        }),
        {
          total_alerts: 0,
          open_count: 0,
          closed_count: 0,
          critical_count: 0,
          high_count: 0,
          medium_count: 0,
          low_count: 0,
        },
      ),
    [locations],
  );

  return (
    <TableRow className="border-0 hover:bg-muted/80">
      <TableCell
        colSpan={2}
        className={cn(TABLE_BODY_CELL, TOTAL_ROW_CELL, 'min-w-[12rem] pl-[1.875rem] text-left text-xs uppercase tracking-wide text-foreground/70')}
      >
        Total
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        {formatSimulationNumber(totals.total_alerts)}
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        {formatSimulationNumber(totals.open_count)}
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        {formatSimulationNumber(totals.closed_count)}
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        <span className={cn('tabular-nums', totals.critical_count > 0 ? cn('font-bold', SEVERITY_LEVELS.critical) : 'font-normal text-muted-foreground/50')}>
          {formatSimulationNumber(totals.critical_count)}
        </span>
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        <span className={cn('tabular-nums', totals.high_count > 0 ? cn('font-bold', SEVERITY_LEVELS.high) : 'font-normal text-muted-foreground/50')}>
          {formatSimulationNumber(totals.high_count)}
        </span>
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        <span className={cn('tabular-nums', totals.medium_count > 0 ? cn('font-bold', SEVERITY_LEVELS.medium) : 'font-normal text-muted-foreground/50')}>
          {formatSimulationNumber(totals.medium_count)}
        </span>
      </TableCell>
      <TableCell className={cn(TABLE_NUM_CELL, TOTAL_ROW_CELL)}>
        <span className={cn('tabular-nums', totals.low_count > 0 ? cn('font-bold', SEVERITY_LEVELS.low) : 'font-normal text-muted-foreground/50')}>
          {formatSimulationNumber(totals.low_count)}
        </span>
      </TableCell>
    </TableRow>
  );
}

export function SimulationLocationsTable({
  runs,
  selectedRunId,
  onRunChange,
}: SimulationLocationsTableProps) {
  const [selectedLocationKey, setSelectedLocationKey] = useState(ALL_LOCATIONS_VALUE);

  const chartOrderedRuns = useMemo(
    () =>
      [...runs].sort(
        (a, b) =>
          new Date(a.run_info.listener_started_at).getTime() -
          new Date(b.run_info.listener_started_at).getTime(),
      ),
    [runs],
  );

  const runOptions = useMemo(
    () =>
      chartOrderedRuns.map((run) => ({
        value: run.run_info.run_id,
        label: formatSimulationDateTime(run.run_info.listener_started_at),
      })),
    [chartOrderedRuns],
  );

  const selectedRun = useMemo(
    () =>
      chartOrderedRuns.find((run) => run.run_info.run_id === selectedRunId) ??
      chartOrderedRuns[chartOrderedRuns.length - 1] ??
      null,
    [chartOrderedRuns, selectedRunId],
  );

  const locations = selectedRun?.location_data ?? [];

  const sortedLocations = useMemo(
    () => [...locations].sort((a, b) => b.total_alerts - a.total_alerts),
    [locations],
  );

  const locationOptions = useMemo(
    () => [
      { value: ALL_LOCATIONS_VALUE, label: 'All locations' },
      ...sortedLocations.map((location) => ({
        value: locationOptionValue(location),
        label: location.location_name,
      })),
    ],
    [sortedLocations],
  );

  const visibleLocations = useMemo(() => {
    if (selectedLocationKey === ALL_LOCATIONS_VALUE) return sortedLocations;
    return sortedLocations.filter((location) => locationOptionValue(location) === selectedLocationKey);
  }, [selectedLocationKey, sortedLocations]);

  useEffect(() => {
    setSelectedLocationKey(ALL_LOCATIONS_VALUE);
  }, [selectedRunId]);

  useEffect(() => {
    if (selectedLocationKey === ALL_LOCATIONS_VALUE) return;
    const stillExists = sortedLocations.some(
      (location) => locationOptionValue(location) === selectedLocationKey,
    );
    if (!stillExists) {
      setSelectedLocationKey(ALL_LOCATIONS_VALUE);
    }
  }, [selectedLocationKey, sortedLocations]);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm gap-0 p-0">
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-x-3 gap-y-2 space-y-0 border-b border-border px-3 pt-3 pb-2">
        <CardTitle className="-mt-3 text-base leading-none">Locations, device types & interlocks</CardTitle>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="space-y-0.5">
            <Combobox
              options={runOptions}
              value={selectedRun?.run_info.run_id ?? ''}
              onChange={(value) => onRunChange(String(value))}
              placeholder="Listener started"
              searchPlaceholder="Search run time..."
              emptyText="No run found."
              disabled={chartOrderedRuns.length === 0}
              className={COMBOBOX_CLASS}
            />
          </div>
          <div className="space-y-0.5">
            <Combobox
              options={locationOptions}
              value={selectedLocationKey}
              onChange={(value) => setSelectedLocationKey(String(value || ALL_LOCATIONS_VALUE))}
              placeholder="All locations"
              searchPlaceholder="Search location..."
              emptyText="No location found."
              disabled={sortedLocations.length === 0}
              className={COMBOBOX_CLASS}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className={SIMULATION_TABLE_CLASS}>
            <TableHeader className={TABLE_HEADER_CLASS}>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <TableHead rowSpan={2} className={cn(TABLE_HEAD_CLASS, 'min-w-[12rem] text-left align-middle')}>
                  Location Name
                </TableHead>
                <TableHead rowSpan={2} className={cn(TABLE_HEAD_CLASS, 'text-center align-middle')}>
                  SAP ID
                </TableHead>
                <TableHead rowSpan={2} className={cn(TABLE_HEAD_CLASS, 'text-center align-middle')}>
                  Total Alerts
                </TableHead>
                <TableHead rowSpan={2} className={cn(TABLE_HEAD_CLASS, 'text-center align-middle')}>
                  Open Count
                </TableHead>
                <TableHead rowSpan={2} className={cn(TABLE_HEAD_CLASS, 'text-center align-middle')}>
                  Closed Count
                </TableHead>
                <TableHead colSpan={4} className={TABLE_HEAD_SEVERITY_CLASS}>
                  Severity
                </TableHead>
              </TableRow>
              <TableRow className={TABLE_HEADER_ROW_CLASS}>
                <SeveritySubHeaders />
              </TableRow>
            </TableHeader>
            <TableBody className={TABLE_BODY_CLASS}>
              {visibleLocations.length === 0 ? (
                <TableRow className={TABLE_BODY_ROW_CLASS}>
                  <TableCell colSpan={MAIN_COLUMN_COUNT} className={cn(TABLE_BODY_CELL, 'py-6 text-center text-muted-foreground')}>
                    No location data for this run.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {visibleLocations.map((location) => (
                    <LocationRow key={`${location.location_name}-${location.sap_id}`} location={location} />
                  ))}
                  <TotalRow locations={visibleLocations} />
                </>
              )}
            </TableBody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
