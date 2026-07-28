import { create } from "zustand";
import { getNodeList } from "@/controllers/API";
import { TypesStore } from "@/types/zustand/types";

export const useTypesStore = create<TypesStore>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,

  // Fetch nodes and cache them
  fetchNodes: async () => {
    const currentState = get();
    
    // If already loading, don't make another request
    if (currentState.isLoading) return;
    
    // Return cached data if it exists
    if (currentState.data) {
      return currentState.data;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await getNodeList();
      set({
        data: response,
        isLoading: false
      });
      return response;
    } catch (error) {
      set({
        error: error instanceof Error ? error : new Error('Failed to fetch nodes'),
        isLoading: false
      });
    }
  },

  setTypesData: (response) => set({ data: response }),

  getTypes: () => {
    return get().data?.data || null;
  },

  clearTypes: () => set({ data: null }),
}));