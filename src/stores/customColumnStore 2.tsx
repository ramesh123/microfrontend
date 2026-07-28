import { create } from 'zustand';

// Define types
type CustomFilter = {
  operation: string;
  text_sf_box?: boolean;
  text_slf_box: boolean;
  selected_field?: string;
  selected_last_field: string;
};

type DerivedColumnItem = {
  new_custom_column: string;
  custom_filter_list: CustomFilter[];
};

type DeriveColumnStoreType = {
  data: DerivedColumnItem[];
  setData: (data: DerivedColumnItem[]) => void;
  addItem: (item: DerivedColumnItem) => void;
  reset: () => void;
};

// Zustand store
export const useCustomColumnStore = create<DeriveColumnStoreType>((set) => ({
  data: [],

  setData: (newData) => set({ data: newData }),

  addItem: (item) =>
    set((state) => ({
      data: [...state.data, item],
    })),

  reset: () => set({ data: [] }),
}));
