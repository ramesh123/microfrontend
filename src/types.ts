import { Node } from "@xyflow/react";
import { FetchAPIParams } from "./types/form";

export type Status = 'online' | 'offline' | 'warning' | 'error' | 'idle' | 'loading' | 'success';

export interface NodeDataType {
  id: string;
  name: string;
  description?: string;
  icon: string;
  status?: Status;
  content?: React.ReactNode;
  [key: string]: any; // Allow additional properties
}

export type CustomNode = Node<NodeDataType>;


export interface Source {
  data: any[];
  id: string;
  name: string;
  columns: Column[];
  tag: string;
  selected: boolean;
}

export interface Column {
  id: string;
  name: string;
  type: string;
  sourceId: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceColumn: string;
  targetColumn: string;
  sourceTag: string;
  targetTag: string;
}
export interface CustomFilter {
  id: string;
  value: string;
  user_request?: string;
}
export interface SourceFilter {
  dropDuplicates: boolean;
  duplicateColumns: string[];
  customFilters: CustomFilter[];
}



export type AggregationType = 'sum' | 'count' | 'min' | 'max' | 'agg' | 'equal' | 'none';

export interface AggregationRule {
  tolerance?: string;
  connectionId: string;
  sourceColumnAggregation: AggregationType;
  targetColumnAggregation: AggregationType;
}
export type ConnectionType = 'key' | 'validation' | 'aggregation';

export interface MatchRule {
  selfMatchDebitCreditColumn: string
    isSelfMatch: unknown;
    selfMatchSourceId: string;
    matchCriteria: any;
    sourceFilters: any;
    id: string;
    name: string;
    connections: Connection[];
    aggregationRules: AggregationRule[];
    connectionTypes: Map<string, ConnectionType>;
    processAllRecords: boolean;
    toleranceMatch: boolean;
    toleranceValue?: string;
    bucketMatch: boolean;
    bucketSourceSide?: 'LEFT' | 'RIGHT';
    matchDuplicate: boolean;
    mapAndCompare: boolean;
    dropDuplicates: boolean;
    roundTo: number;
  }
  export interface FlowNode {
    id: string;
    data: {
      display_name?: string;
      flow_id?: string;
      node?: {
        title?: string;
        payload?: {
          table: string;
          tag?: string;
          datasets?: any;
          rules?: any[]; // For multiple rules
        };
        output?: {
          columns?: string[];
          data?: any[];
        };
        save_node?: FetchAPIParams;
      };
    };
  }
  
  export interface ColumnNodeData {
    label: string;
    isKey: boolean;
    isValidation: boolean;
    isAggregation: boolean;
  }
  
  export interface TitleNodeData {
    [key: string]: unknown;
    label: string;
  }
  
  export interface MatchCriterion {
    id: string
      source1Id: string
      source2Id: string
      matchType: 'MATCHED' | 'UNMATCHED'
      condition: 'AND' | 'OR'
  }

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'pending' | 'error';
  lastRun: Date;
  createdAt: Date;
  steps: number;
  templateName?: string;
  templateId?: string;
  tags?: string[];
  projectId: string;
  supports?: string;
}

export interface Template {
  id: string;
  name:string;
  description: string;
  category: string;
  workflows: Workflow[];
  createdAt: Date;
  author: string;
  isPublic: boolean;
  tags: string[];
  projectId: string;
  supports?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  templateId: string;
  projectType: string;
  status: 'enabled' | 'disabled';
  createdAt: Date;
}

export interface JobLog {
  id: string;
  message: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  workflowName: string;
  projectName: string;
}

export interface User {
  last_name?: string;
  first_name?: string;
  id: string;
  email: string;
  name: string;
  avatar?: string;
  // The user's assigned role in the current organization
  role: string; 
}

export type Permission = 
  | 'create-organization'
  | 'edit-organization'
  | 'create-workflow'
  | 'edit-workflow'
  | 'view-analytics'
  | 'manage-settings';

export type Permissions = Record<Permission, boolean>;

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
}

export interface Organization {
  id: string;
  org_id: string;
  org_name: string;
  description?: string;
  logo?: string;
  created_at: string;
  memberCount: number;
  plan: 'free' | 'pro' | 'enterprise';
  roles: Role[];
  
  // Extended organization fields
  industryType?: string;
  companyId?: string;
  country?: string;
  state?: string;
  city?: string;
  contact?: string;
  email?: string;
  zipcode?: string;
  address1?: string;
  address2?: string;
}

export interface OrganizationFormData {
  name: string;
  industryType: string;
  companyId?: string;
  country: string;
  state: string;
  city: string;
  contact?: string;
  email: string;
  zipcode?: string;
  address1?: string;
  address2?: string;
}
