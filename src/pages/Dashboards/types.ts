export interface Chart {
  id: number;
  chart_name: string;
  visualization_name: string;
  updated_at: string;
  created_at: string;
  flow_id: string;
  params?: any;
  workflow_type?: string;
  schema_name?: string;
  is_drilldown?: boolean;
  node_id?: string;
  execution_id?: string;
  table_name?: string;
  created_by?: string;
  flow_run_id?: string;
  created_user?: string;
  process_cycle?: string;
  description?: string;
  execution_number?: string;
  stmt_date?: string;
  chart_type?: string;
  connection_id?: number;
  connection_type?: string;
  source_type?: string;
  database_name?: string;
  entity_id?: number | null;
  database?: string;
  linked_charts?: any;
  /** Saved appearance options from create/update chart API */
  customization?: Record<string, unknown>;
}

export interface DashboardChart {
  id: string;
  chartId: number;
  chart: Chart;
  position: { x: number; y: number };
  size: { width: number; height: number }; // width and height in pixels
  /** Saved react-grid-layout units — source of truth for edit restore */
  gridLayout?: { x: number; y: number; w: number; h: number };
  chartData?: any[];
  chartColumns?: string[];
  // Optional raw API response (used by AmChart for certain visualizations like sunburst)
  rawResponse?: {
    x_axis?: string;
    data?: any[];
    columns?: string[];
    dimensions?: any[];
  } | any;
  isLoading?: boolean;
}
