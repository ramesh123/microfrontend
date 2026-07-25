import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface ReportingColumn {
  name: string;
  displayColumn: string;
  datatype: string;
  fillNullValue: string;
  required: boolean;
  type: string;
}

interface ReportingState {
  // State
  availableColumns: ReportingColumn[];
  selectedColumns: ReportingColumn[];
  editingColumn: string | null;
  editFormData: {
    displayColumn: string;
    datatype: string;
    fillNullValue: string;
  };
  isLoading: boolean;
  
  // Actions
  setAvailableColumns: (columns: ReportingColumn[]) => void;
  updateColumn: (columnName: string, updates: Partial<ReportingColumn>) => void;
  setEditingColumn: (columnName: string | null) => void;
  setEditFormData: (data: { displayColumn: string; datatype: string; fillNullValue: string }) => void;
  setIsLoading: (loading: boolean) => void;
  resetStore: () => void;
  
  // Data retrieval
  getColumnByName: (name: string) => ReportingColumn | undefined;
  getColumnsByType: (type: string) => ReportingColumn[];
  getRequiredColumns: () => ReportingColumn[];
  getOptionalColumns: () => ReportingColumn[];
}

const initialState = {
  availableColumns: [],
  selectedColumns: [],
  editingColumn: null,
  editFormData: {
    displayColumn: '',
    datatype: '',
    fillNullValue: ''
  },
  isLoading: false,
};

export const useReportingStore = create<ReportingState>()(
  devtools(
    (set, get) => ({
      ...initialState,
      
      setAvailableColumns: (columns) => set({ availableColumns: columns }),
      
      updateColumn: (columnName, updates) => set((state) => ({
        availableColumns: state.availableColumns.map(col =>
          col.name === columnName ? { ...col, ...updates } : col
        )
      })),
      
      setEditingColumn: (columnName) => set({ editingColumn: columnName }),
      
      setEditFormData: (data) => set({ editFormData: data }),
      
      setIsLoading: (loading) => set({ isLoading: loading }),
      
      resetStore: () => set(initialState),
      
      // Data retrieval methods
      getColumnByName: (name) => {
        const state = get();
        return state.availableColumns.find(col => col.name === name);
      },
      
      getColumnsByType: (type) => {
        const state = get();
        return state.availableColumns.filter(col => col.datatype === type || col.type === type);
      },
      
      getRequiredColumns: () => {
        const state = get();
        return state.availableColumns.filter(col => col.required);
      },
      
      getOptionalColumns: () => {
        const state = get();
        return state.availableColumns.filter(col => !col.required);
      },
    }),
    {
      name: 'reporting-store',
    }
  )
);
