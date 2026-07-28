import { create } from 'zustand';
import { FormValue } from '@/types/form'; 

interface FormState {
  formValues: Record<string, FormValue>;
  setFormValue: (key: string, value: FormValue) => void;
  getFormValue: (key: string) => FormValue | undefined; // Can be any FormValue or undefined if not set
  resetForm: () => void;
}

export const useFormStore = create<FormState>((set, get) => ({
  formValues: {},
  setFormValue: (key, value) => {
    set((state) => ({
      formValues: {
        ...state.formValues,
        [key]: value,
      },
    }));
  },
  getFormValue: (key) => {
    return get().formValues[key];
  },
  resetForm: () => {
    set({ formValues: {} });
  },
}));