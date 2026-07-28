export interface Column {
  name: string;
  type: string;
  selected: boolean;
}

export interface Table {
  name: string;
  columns: Column[];
  selected: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'sqlite' | 'mongodb';
  connected: boolean;
  tables: Table[];
}

export interface Join {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  joinType: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
  sourceApplication: string;
  targetApplication: string;
}

export interface ColumnMapping {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  validationStatus: 'passed' | 'failed' | 'warning';
  validationMessage: string;
  sourceApplication: string;
  targetApplication: string;
}

export interface ValidationResult {
  passed: number;
  failed: number;
  warnings: number;
}

export interface SelectedColumn {
  application: string;
  table: string;
  columns: string[];
}
