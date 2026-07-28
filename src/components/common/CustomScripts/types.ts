// Type Definitions for CustomScripts Component

export interface ParameterPair {
  key: string;
  value: string;
}

export interface CustomScriptsNodeData {
  module_name: string;
  class_name: string;
  function_name: string;
  class_parameter: ParameterPair[];
  function_parameter: ParameterPair[];
}

export interface CustomScriptsNodeProps {
  data?: any;
  onChange?: (data: CustomScriptsNodeData) => void;
}

export interface ParameterListProps {
  label: string;
  parameters: ParameterPair[];
  onChange: (parameters: ParameterPair[]) => void;
  /** `table` = bordered key/value grid (API Connector); default = compact script style */
  layout?: "default" | "table";
  /** Shown under the title or in the empty state for `table` layout */
  hint?: string;
  /** Table layout: drop heavy outer border (e.g. API Connector in a grid) */
  tableBorderless?: boolean;
}

export interface MonacoEditorSectionProps {
  code: string;
  theme: 'vs-dark' | 'light';
  onThemeChange: (theme: 'vs-dark' | 'light') => void;
}
