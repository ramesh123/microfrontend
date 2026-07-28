// stores/textSelectionStore.ts
import { create } from "zustand";

type TextSelection = {
  column: string;
  fullValue: string;
  selectedText: string;
  charRange: string;
};

type TextSelectionStore = {
  selection: TextSelection | null;
  setSelection: (selection: TextSelection) => void;
  resetSelection: () => void;
};

export const useTextSelectionStore = create<TextSelectionStore>((set) => ({
  selection: null,
  setSelection: (selection) => set({ selection }),
  resetSelection: () => set({ selection: null }),
}));
