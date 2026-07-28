import { Node, Edge, Viewport } from '@xyflow/react';




export type ViewportType = {
  x: number;
  y: number;
  zoom: number;
}

export interface FlowData {
  flow_id?: number;
  nodes: Node<AlgoNodeData>[];
  edges: Edge[];
  viewport: Viewport;
}

export interface Workflow {
  id?: number;
  created_at?: string;
  updated_at?: string;
  entity_id?: string | null;
  workflow_id?: string;
  name?: string;
  description?: string;
  application_id?: string;
  workflow_type?: string;
  flow_id?: string;
  deployment_id?: string;
  deployment_name?: string;
  data?: FlowData;
  icon?: string;
  icon_bg_color?: string;
  gradient?: string;
  created_by?: string;
  updated_by?: string;
  display_name?: string;
  scheduler?: Record<string, any>;
  locked?: boolean;
  assigned_user?: any[]; // If you know the shape, replace `any` with a proper interface
  assigned_role?: any[];
  org_id?: string[];
  project?: string;
  business_process?: string;
  process_id?: string;
  execution_engine?: string | null;
  target_output?: string | null;
  storage_engine?: string | null;
  statement_date?: string;
  cycle_wise?: boolean;
  perspective_ids?: string[];
  workflow_origin?: 'AI' | 'Manual';
  virtualdb_mode?: boolean;
}

export type ConnectorTemplate = Omit<AlgoNodeData, 'isExpanded' | 'status' | 'executionTime' | 'outputRows'>;

export interface Measured {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface AlgoNodeData {
  id?: string | number;
  icon?: string;
  name?: string;
  node?: Record<string, any>; // If node has structure, replace `Record<string, any>`
  type?: "genericNode" | "noteNode";
  flow_id?: string;
  modules?: string;
  node_id?: string;
  storage?: string;
  entity_id?: string | null;
  show_node?: boolean;
  created_at?: string;
  klass_name?: string;
  saved_node?: boolean;
  updated_at?: string;
  description?: string;
  task_runner?: string;
  display_name?: string;
  current_node_id?: string;
  is_multiple_form?: boolean;
  [key: string]: any;
}

export interface FlowNode {
  id: string;
  data: AlgoNodeData;
  name: string;
  type: string;
  dragging: boolean;
  measured: Measured;
  position: Position;
  selected: boolean;
}