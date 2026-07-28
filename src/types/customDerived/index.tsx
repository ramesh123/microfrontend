export interface CustomFilter {
    id: string;
    useManualField?: boolean;
    field?: string;
    condition: string;
    useManualValue: boolean;
    value: string;
  }
  
  export interface CustomColumn {
    id: string;
    name: string;
    manualValue: string;
    filters: CustomFilter[];
  }
  