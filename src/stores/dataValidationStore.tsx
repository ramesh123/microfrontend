import { create } from 'zustand';
import { ColumnMapping, KeyValidationPair } from '@/types/dataValidation';

interface DataValidationState {
  mappings: ColumnMapping[];
  keyValidationPairs: KeyValidationPair[];
  selectedSourceId: string | null;
  selectedTargetId: string | null;
  setMappings: (mappings: ColumnMapping[]) => void;
  setKeyValidationPairs: (pairs: KeyValidationPair[]) => void;
  setSelectedSourceId: (id: string | null) => void;
  setSelectedTargetId: (id: string | null) => void;
  reset: () => void;
}

const initialState = {
  mappings: [],
  keyValidationPairs: [],
  selectedSourceId: null,
  selectedTargetId: null,
};

const useDataValidationStore = create<DataValidationState>((set) => ({
  ...initialState,
  setMappings: (mappings) => set({ mappings }),
  setKeyValidationPairs: (keyValidationPairs) => set({ keyValidationPairs }),
  setSelectedSourceId: (id) => set({ selectedSourceId: id }),
  setSelectedTargetId: (id) => set({ selectedTargetId: id }),
  reset: () => set(initialState),
}));

export default useDataValidationStore;
