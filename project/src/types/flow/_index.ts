import type { Edge, Node, Position, ReactFlowJsonObject, Viewport } from "@xyflow/react";
import { number } from "zod";
// import { BuildStatus } from "../../constants/enums";
// import { APIClassType, OutputFieldType } from "../api/index";

export type Status =
  | "online"
  | "offline"
  | "warning"
  | "error"
  | "idle"
  | "loading"
  | "success";

export interface NodeInfo {
  node_id: string;
  name: string;
  display_name: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
  data: NodeData;
}

export interface NodeData {
  name: string;
  node?: NodeJson;
  node_id: string;
  show_node: boolean;
  display_name?: string;
  description?: string;
  current_node_id?: string;
  icon?: string;
  group?: string;
  groupColor?: string;
  iconBgColor?: string;
  isExpanded?: boolean;
  status: NodeStatus;
  executionTime?: number;
  outputRows?: number;
  color?: string;
  type: string;
  [key: string]: unknown; // This allows any additional properties with unknown type
}
// export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

// export interface AlgoNodeData {
//   // Metadata from your example
//   icon: string;
//   name: string;
//   type: string;
//   modules: string;
//   node_id: string;
//   show_node: boolean;
//   klass_name: string;
//   description: string;
//   display_name: string;
//   id?: string;
//   current_node_id: string;
//   data: NodeData;
//   width: number;
//   height: number;
//   sourcePosition: Position;
//   targetPosition: Position;
//   sourceHandle?: string;
//   targetHandle?: string;
//   source?: string;
//   target?: string;
//   parentId?: string;
  
  
//   // New properties for grouping and coloring
//   group: string;
//   groupColor: string;

//   // State for UI and execution results
//   isExpanded: boolean;
//   status: NodeStatus;
//   executionTime?: string; // e.g., "0.25s"
//   outputRows?: number;
// }

// This represents the "palette" of nodes the user can drag from.
// We only need the core metadata here. The state-related fields
// will be added when the node is dropped onto the canvas.
// export type ConnectorTemplate = Omit<AlgoNodeData, 'isExpanded' | 'status' | 'executionTime' | 'outputRows'>;

export interface NodeResponse {
  data: NodeData;
  message: string;
  status: boolean;
}  


export interface NodeJson {
  payload?: any;
  save_node?: any;
  template?: any;
  get_data?: any;
}


// export interface NodeDataType extends NodeData {
//   id: string;
//   name?: string;
//   description?: string;
//   icon?: string;
//   status?: Status;
//   content?: React.ReactNode;
//   position: { x: number; y: number };
//   type?: string;
//   node_id: string | null;
//   [key: string]: any; // Allow additional properties
// }

export type NodeDataType = Node<NodeData, "genericNode">;

export type CustomNode = Node<NodeData, "genericNode">;

export type PaginatedFlowsType = {
  items: FlowType[];
  total: number;
  size: number;
  page: number;
  pages: number;
};


export type FlowType = {
  id?: string;
  workflow_id: string;
  name: string;
  description: string;
  current_node_id?: string;
  workflow_type: string;
  flow_id: string;
  deployment_id: string;
  deployment_name: string;
  data: ReactFlowJsonObject<Node<NodeData, "genericNode">, EdgeType> | null;
  icon: string;
  icon_bg_color: string;
  gradient: string;
  locked: boolean;
  display_name: string;
  scheduler: Record<string, any>;
  assigned_user: string[];
  assigned_role: string[];
}

export type GenericNodeType = Node<NodeDataType, "genericNode">;
export type NoteNodeType = Node<NoteDataType, "noteNode">;

export type AllNodeType = GenericNodeType | any; // | NoteNodeType;
// export type SetNodeType<T = "genericNode" | "noteNode"> =
//   T extends "genericNode" ? GenericNodeType : NoteNodeType; 

// export type noteClassType = Pick<
//   APIClassType,
//   "description" | "display_name" | "documentation" | "tool_mode" | "frozen"
// > & {
//   template: {
//     backgroundColor?: string;
//     [key: string]: any;
//   };
//   outputs?: OutputFieldType[];
// };

export type NoteDataType = {
  showNode?: boolean;
  type: string;
  // node: noteClassType;
  id?: string;
  current_node_id?: string;
};

export type EdgeType = Edge<EdgeDataType, "default" | "customEdge">;

export type EdgeDataType = {
  sourceHandle?: sourceHandleType;
  targetHandle?: targetHandleType;
  onRemove?: (edgeId: string) => void;
};

// FlowStyleType is the type of the style object that is used to style the
// Flow card with an emoji and a color.
export type FlowStyleType = {
  emoji: string;
  color: string;
  flow_id: string;
};

export type TweaksType = Array<
  {
    [key: string]: {
      output_key?: string;
    };
  } & FlowStyleType
>;

// right side
export type sourceHandleType = {
  baseClasses?: string[];
  dataType: string;
  id?: string;
  output_types: string[];
  conditionalPath?: string | null;
  name: string;
};
//left side
export type targetHandleType = {
  inputTypes?: string[];
  output_types?: string[];
  type: string;
  fieldName: string;
  name?: string;
  id?: string;
  proxy?: { field: string; id: string };
};

export type FlowData = {
  nodes: NodeDataType[];
  edges: EdgeDataType[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
};

// interface IFlowFetchParams {
//   schema: string;
//   actions: string;
//   database: string;
//   connection: string;
// }

// interface IFlowFetch {
//   klass: string;
//   method: string;
//   module: string;
//   params: IFlowFetchParams;
// }

// interface FlowField {
//   key: string;
//   info: string;
//   type: string;
//   value: string;
//   is_api?: boolean;
//   position: number;
//   required: boolean;
//   placeholder: string;
//   display_name: string;
//   options?: { label: string; value: string }[];
//   fetch?: IFlowFetch;
//   depends_key?: string[];
//   depends_value?: string[];
//   default?: string;
// }

// interface ITemplate {
//   [key: string]: FlowField;
// }

// interface IResNode {
//   output: Record<string, string>;
//   template: ITemplate;
//   save_node: {
//     klass: string;
//     method: string;
//     module: string;
//     enabled: boolean;
//   };
// }

// export interface IApiResponse {
//   node: IResNode;
//   type: string;
//   id: number;
//   updated_at: string;
//   show_node: boolean;
//   flow_id: string;
//   node_id: string;
//   created_at: string;
//   entity_id: string | null;
// }

// new type for projects
export type AllProjectsApiResponse = {
  data: AllProjectsData[];
  count: number;
  total: number;
};
export type AllProjectsData = {
  data: ProjectData;
  display_name: string;
  icon: string;
  scheduler: ProjectsScheduler;
  created_at: string;
  description: string;
  icon_bg_color: string;
  name: string;
  application_id: string;
  locked: boolean;
  workflow_type: string;
  gradient: string;
  workflow_id: string;
  flow_id: string;
  assigned_user: ProjectAssignedUser;
  deployment_id: string;
  created_by: string;
  assigned_role: ProjectAssignedRole;
  entity_id: string | null;
  deployment_name: string;
  id: number;
  updated_at: string;
};
type ProjectAssignedRole = [];
type ProjectAssignedUser = [];
type ProjectsScheduler = {
  additionalProp1: ProjectsSchedulerAdditionalProp;
};
type ProjectsSchedulerAdditionalProp = {};
type ProjectData = {
  edges: ProjectNodeEdges[];
  nodes: ProjectNodes[];
  viewport: ProjectDataViewPort;
};
type ProjectDataViewPort = {
  x: string;
  y: string;
  zoom: number;
};
type ProjectNodeEdges = {
  id: string;
  source: string;
  target: string;
};
type ProjectNodes = {
  id: string;
  name: string;
  data: ProjectNode;
};
type ProjectNode = {
  template: ProjectNodeTemplate;
};
type ProjectNodeTemplate = {
  name: ProjectNodeTemplate;
};
export type SplitMode = 'open' | 'close' | 'reset';



export type NodeStatus = 'idle' | 'running' | 'success' | 'error';

export interface AlgoNodeData {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string | null;
  workflow_id: string;
  name: string;
  description: string;
  application_id: string;
  workflow_type: string;
  flow_id: string;
  deployment_id: string;
  deployment_name: string;
  data: FlowData;
  icon: string;
  icon_bg_color: string;
  gradient: string;
  created_by: string;
  updated_by: string;
  display_name: string;
  scheduler: Record<string, any>;
  locked: boolean;
  assigned_user: any[]; // If you know the shape, replace `any` with a proper interface
  assigned_role: any[];
  [key: string]: unknown;
}

// This represents the "palette" of nodes the user can drag from.
export type ConnectorTemplate = Omit<AlgoNodeData, 'isExpanded' | 'status' | 'executionTime' | 'outputRows'>;

// This represents the nested "data" object within the main workflow
export interface WorkflowData {
  nodes: Node<AlgoNodeData>[];
  edges: Edge[];
  viewport: Viewport;
}

// This is the new, complete workflow structure
export interface Workflow {
  id: number;
  created_at: string;
  updated_at: string;
  entity_id: string | null;
  workflow_id: string;
  name: string;
  description: string;
  application_id: string;
  workflow_type: string;
  flow_id: string;
  deployment_id: string;
  deployment_name: string;
  data: FlowData;
  icon: string;
  icon_bg_color: string;
  gradient: string;
  created_by: string;
  updated_by: string;
  display_name: string;
  scheduler: Record<string, any>;
  locked: boolean;
  assigned_user: any[]; // If you know the shape, replace `any` with a proper interface
  assigned_role: any[];
  perspective_ids?: string[];
  virtualdb_mode?: boolean;
}
