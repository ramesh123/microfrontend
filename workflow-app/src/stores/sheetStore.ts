import { create } from 'zustand'

/** Wired by Data Validation so Cancel/Save render in the sheet header next to Execute. */
export interface DataValidationHeaderActions {
  onSave: () => void | Promise<void>
  onCancel: () => void
  isSaving: boolean
  saveDisabled: boolean
}

interface SheetStore {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  size: number
  setSize: (size: number) => void
  dataValidationHeaderActions: DataValidationHeaderActions | null
  setDataValidationHeaderActions: (actions: DataValidationHeaderActions | null) => void
}

export const useSheetStore = create<SheetStore>((set) => ({
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  size: 0,
  setSize: (size) => set({ size: size }),
  dataValidationHeaderActions: null,
  setDataValidationHeaderActions: (actions) => set({ dataValidationHeaderActions: actions }),
}))
