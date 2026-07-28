import api from './api';
import { executeApiRequestSilent } from '@/utils/exceptionHelper';

export type SimulationAlertCounts = {
  total_alerts: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  open_count: number;
  closed_count: number;
};

export type SimulationInterlockAlert = SimulationAlertCounts & {
  interlock_name: string;
};

export type SimulationDeviceTypeAlert = SimulationAlertCounts & {
  device_type: string;
  distinct_interlocks_count: number;
  interlocks: SimulationInterlockAlert[];
};

export type SimulationLocationData = SimulationAlertCounts & {
  location_name: string;
  sap_id: string;
  device_types: SimulationDeviceTypeAlert[];
};

export type SimulationLineChartPoint = {
  time: string;
  count: number;
};

export type SimulationRunInfo = {
  run_id: string;
  listener_started_at: string;
  listener_ended_at: string;
  duration_ms: number;
  total_telemetry_received: number;
  events_per_sec: number;
  alerts_created: number;
};

export type SimulationRunStats = {
  total_alerts: number;
  last_1hr_alerts: number;
  total_locations: number;
  total_sap_ids: number;
  distinct_interlocks: number;
  events_per_sec: number;
};

export type SimulationTrackRun = {
  run_info: SimulationRunInfo;
  stats: SimulationRunStats;
  location_data: SimulationLocationData[];
  line_chart: Record<string, SimulationLineChartPoint[]>;
};

export type SimulationTrackResponse = {
  success: boolean;
  total_runs: number;
  data: SimulationTrackRun[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = ''): string {
  return value != null ? String(value) : fallback;
}

function parseAlertCounts(raw: Record<string, unknown>): SimulationAlertCounts {
  return {
    total_alerts: num(raw.total_alerts),
    critical_count: num(raw.critical_count),
    high_count: num(raw.high_count),
    medium_count: num(raw.medium_count),
    low_count: num(raw.low_count),
    open_count: num(raw.open_count),
    closed_count: num(raw.closed_count),
  };
}

function parseInterlock(raw: unknown): SimulationInterlockAlert | null {
  if (!isRecord(raw)) return null;
  return {
    interlock_name: str(raw.interlock_name),
    ...parseAlertCounts(raw),
  };
}

function parseDeviceType(raw: unknown): SimulationDeviceTypeAlert | null {
  if (!isRecord(raw)) return null;
  const interlocks = Array.isArray(raw.interlocks)
    ? raw.interlocks.map(parseInterlock).filter((item): item is SimulationInterlockAlert => item != null)
    : [];
  return {
    device_type: str(raw.device_type, 'Unknown'),
    distinct_interlocks_count: num(raw.distinct_interlocks_count, interlocks.length),
    ...parseAlertCounts(raw),
    interlocks,
  };
}

function parseLocation(raw: unknown): SimulationLocationData | null {
  if (!isRecord(raw)) return null;

  let device_types = Array.isArray(raw.device_types)
    ? raw.device_types.map(parseDeviceType).filter((item): item is SimulationDeviceTypeAlert => item != null)
    : [];

  if (device_types.length === 0 && Array.isArray(raw.interlocks)) {
    const legacyInterlocks = raw.interlocks
      .map(parseInterlock)
      .filter((item): item is SimulationInterlockAlert => item != null);
    if (legacyInterlocks.length > 0) {
      device_types = [
        {
          device_type: 'General',
          distinct_interlocks_count: legacyInterlocks.length,
          ...parseAlertCounts(raw),
          interlocks: legacyInterlocks,
        },
      ];
    }
  }

  return {
    location_name: str(raw.location_name),
    sap_id: str(raw.sap_id),
    ...parseAlertCounts(raw),
    device_types,
  };
}

function parseLineChart(raw: unknown): Record<string, SimulationLineChartPoint[]> {
  if (!isRecord(raw)) return {};
  const result: Record<string, SimulationLineChartPoint[]> = {};
  for (const [location, points] of Object.entries(raw)) {
    if (!Array.isArray(points)) continue;
    result[location] = points
      .map((point) => {
        if (!isRecord(point)) return null;
        return { time: str(point.time), count: num(point.count) };
      })
      .filter((point): point is SimulationLineChartPoint => point != null);
  }
  return result;
}

function parseRun(raw: unknown): SimulationTrackRun | null {
  if (!isRecord(raw)) return null;
  const runInfo = isRecord(raw.run_info) ? raw.run_info : {};
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const location_data = Array.isArray(raw.location_data)
    ? raw.location_data.map(parseLocation).filter((item): item is SimulationLocationData => item != null)
    : [];

  return {
    run_info: {
      run_id: str(runInfo.run_id),
      listener_started_at: str(runInfo.listener_started_at),
      listener_ended_at: str(runInfo.listener_ended_at),
      duration_ms: num(runInfo.duration_ms),
      total_telemetry_received: num(runInfo.total_telemetry_received),
      events_per_sec: num(runInfo.events_per_sec),
      alerts_created: num(runInfo.alerts_created),
    },
    stats: {
      total_alerts: num(stats.total_alerts),
      last_1hr_alerts: num(stats.last_1hr_alerts),
      total_locations: num(stats.total_locations),
      total_sap_ids: num(stats.total_sap_ids),
      distinct_interlocks: num(stats.distinct_interlocks),
      events_per_sec: num(stats.events_per_sec),
    },
    location_data,
    line_chart: parseLineChart(raw.line_chart),
  };
}

function normalizeSimulationTrackResponse(data: unknown): SimulationTrackResponse {
  if (!isRecord(data)) {
    return { success: false, total_runs: 0, data: [] };
  }

  const runs = Array.isArray(data.data)
    ? data.data.map(parseRun).filter((item): item is SimulationTrackRun => item != null)
    : [];

  return {
    success: data.success === true,
    total_runs: num(data.total_runs, runs.length),
    data: runs,
  };
}

/** POST /api/simulationtrack/simulationtrack */
export async function fetchSimulationTrack(
  body: Record<string, unknown> = {},
): Promise<SimulationTrackResponse> {
  const data = await executeApiRequestSilent<unknown>(
    () => api.post('/simulationtrack/simulationtrack', body),
    'Failed to load Agent track data',
  );
  return normalizeSimulationTrackResponse(data);
}

export type DeviceTypeBarChartItem = {
  device_type: string;
  alert_count: number;
};

/** Alias used by legacy bar-chart helpers. */
export type SimulationDeviceTypeBarChartItem = DeviceTypeBarChartItem;

export type SimulationDeviceTypeWiseResponse = {
  success: boolean;
  total_device_types: number;
  data: SimulationDeviceTypeAlert[];
};

function normalizeDeviceTypeWiseResponse(data: unknown): SimulationDeviceTypeWiseResponse {
  if (!isRecord(data)) {
    return { success: false, total_device_types: 0, data: [] };
  }

  const items = Array.isArray(data.data)
    ? data.data.map(parseDeviceType).filter((item): item is SimulationDeviceTypeAlert => item != null)
    : [];

  return {
    success: data.success === true,
    total_device_types: num(data.total_device_types, items.length),
    data: items,
  };
}

export function deviceTypeWiseToBarItems(
  response: SimulationDeviceTypeWiseResponse,
): DeviceTypeBarChartItem[] {
  return response.data.map((item) => ({
    device_type: item.device_type,
    alert_count: item.total_alerts,
  }));
}

/** POST /api/simulationtrack/bar-chart-device-type-wise */
export async function fetchBarChartDeviceTypeWise(
  body: Record<string, unknown> = {},
): Promise<SimulationDeviceTypeWiseResponse> {
  const data = await executeApiRequestSilent<unknown>(
    () => api.post('/simulationtrack/bar-chart-device-type-wise', body),
    'Failed to load device type chart data',
  );
  return normalizeDeviceTypeWiseResponse(data);
}

export type SimulationAgentStopStartAction = 'start' | 'stop';

export type SimulationAgentStopStartPayload = {
  action: SimulationAgentStopStartAction;
  connection_id?: string;
};

export type SimulationAgentStopStartResponse = {
  success: boolean;
  message?: string;
};

/** POST /api/simulationtrack/agent-stop-start */
export async function postSimulationAgentStopStart(
  payload: SimulationAgentStopStartPayload,
): Promise<SimulationAgentStopStartResponse> {
  const data = await executeApiRequestSilent<unknown>(
    () => api.post('/simulationtrack/agent-stop-start', payload),
    payload.action === 'start' ? 'Failed to start agent' : 'Failed to stop agent',
  );

  if (!isRecord(data)) {
    return { success: false };
  }

  return {
    success: data.success === true,
    message: data.message != null ? String(data.message) : undefined,
  };
}

/** @deprecated Use fetchBarChartDeviceTypeWise — same endpoint and response shape. */
export async function fetchSimulationDeviceTypeChart(
  body: Record<string, unknown> = {},
): Promise<{
  bar_data: DeviceTypeBarChartItem[];
  severity_data: SimulationDeviceTypeAlert[];
}> {
  const response = await fetchBarChartDeviceTypeWise(body);
  return {
    bar_data: deviceTypeWiseToBarItems(response),
    severity_data: response.data,
  };
}
