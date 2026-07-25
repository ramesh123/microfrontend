export interface FlowJob {
  id: number;
  deployment_name: string;
  deployment_id: string;
  flow_name: string;
  flow_id: string;
  flow_run_name: string;
  flow_run_id: string;
  job_status: string;
  statement_date: string;
  created_at: string;
  updated_at: string;
  executed_by: string;
  rollbacked_by: string;
  flow_statement_date: string;
  error_msg: string;
  stmt_date: string;
}

export interface Task {
  id: number;
  task_name: string;
  task_id: string;
  flow_run_name: string;
  flow_run_id: string;
  flow_name: string;
  flow_id: string;
  start_time: string;
  end_time: string;
  duration: number;
  task_state: string;
  created_at: string;
  updated_at: string;
  error_msg: string;
  input_records_count: number;
  output_records_count: number;
  workflow_type: string;
  execution_number: string;
  task_key: string;
}

export interface TaskRunsChartDay {
  date: string;
  Completed: number;
  Running: number;
  Failed: number;
}

export interface TaskRunsChartSummary {
  completed?: { count: number; percentage: number };
  failed?: { count: number; percentage: number };
  running?: { count: number; percentage: number };
}

export interface TaskRunsChartData {
  total: number;
  summary: TaskRunsChartSummary;
  chartData: TaskRunsChartDay[];
}

/** POST body for `/task-details/get-task-runs-chart`. */
export interface TaskRunsChartRequest {
  time_grain: string;
  deployment_name: string;
  flow_name: string;
}

export interface ApiResponse<T> {
  data: T[];
  total: number;
  count: number;
}

/** One bar in the flow status chart; `status` is the API value (e.g. COMPLETED, ROLLBACK_FAILED). */
export interface StatusChartData {
  status: string;
  count: number;
  /** Human-readable axis label; optional (chart can derive from status). */
  label?: string;
  date?: string;
}

export interface TasksChartData {
  date: string;
  Completed: number;
  Failed: number;
}

export type TimeRange = 'all' | 'today' | 'yesterday' | 'last_7_days' | 'last_15_days' | 'last_30_days' | 'last_90_days';

export interface DateRange {
  from: Date;
  to?: Date;
}

export interface JobsFilter {
  timeRange?: TimeRange;
  dateRange?: DateRange;
  deploymentName?: string;
  taskName?: string;
  status?: string;
  searchText?: string;
}
