export interface NodeItem {
  node_id: string;
  name: string;
  display_name: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
  datasets?: Dataset[];
}

export interface NodeGroup { 
  [groupName: string]: NodeItem[];
}

export interface Dataset {
  dataset_id?: string;
  type: string;
  name: string;
  display_name?: string;
  payload: any;
  group: string;
  node_id: string;
  updated_at: string;
  entity_id: string | null;
  template: any;
  id: number;
  created_at: string;
  enabled?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  enabled: boolean;
}

export interface TemplateGroup {
  [categoryName: string]: Template[];
}

export interface NodesApiResponse {
  status: boolean;
  message: string;
  data: NodeGroup;
}

export interface DatasetsApiResponse {
  data: Dataset[];
  count: number;
  total: number;
}


export interface IconComponentProps {
  name: string;
  className?: string;
  iconColor?: string;
  stroke?: string;
  strokeWidth?: number;
  id?: string;
  skipFallback?: boolean;
  dataTestId?: string;
}

