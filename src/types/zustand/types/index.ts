export interface TypeCategory {
  [key: string]: ConnectorConfig[];
}

export interface ConnectorConfig {
  node_id: string;
  name: string;
  display_name: string;
  group: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface TypesStore {
  data: {
    status: boolean;
    message: string;
    data: TypeCategory;
  } | null;
  setTypesData: (response: {
    status: boolean;
    message: string;
    data: TypeCategory;
  }) => void;
  getTypes: () => TypeCategory | null;
  clearTypes: () => void;
  fetchNodes: () => Promise<void>;
  isLoading?: boolean;
  error?: Error | null;
}