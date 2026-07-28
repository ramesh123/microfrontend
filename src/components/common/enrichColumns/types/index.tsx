// The shape of the `data` property within a SourceNode
export interface SourceNodeData {
  display_name?: string;
  node: {
    output: {
      columns: string[];
    };
  };
}

// Represents a node available for selection (e.g., from a previous step in a workflow)
export interface SourceNode {
  id: string;
  data: SourceNodeData;
}

// Represents the data payload of the node being configured
export interface NodeData {
  data: {
    saved_node?: boolean;
    node: {
      payload?: {
        source_name?: string;
        target_name?: string;
        how?: string;
        target_key_columns?: string[];
        source_key_columns?: string[];
        source_extra_columns?: string[];
        target_filter?: string[];
        source_filter?: string[];
      };
    };
  };
}

// Represents the form configuration data
export interface FormData {
  name: string;
  mergeType: { 
    label: string; 
    value: string; 
    options: Array<{ label: string; value: string }> 
  };
}

// Combined props for the main EnrichColumns component
export interface EnrichColumnsProps {
  formData: FormData;
  nodeData: NodeData;
  onSave: (data: any) => void;
  onCancel: () => void;
}

// Internal state types
export interface FilterItem { 
  id: string; 
  value: string; 
}

export interface KeyPair { 
  source_column: string; 
  lookup_column: string; 
}
