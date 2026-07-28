import { create } from "zustand";

interface ExecutionResult {
  id: string;
  columns: string[];
  data: any[];
  execution_time: string;
  message: string;
  status: boolean;
}

interface ExecutionResultState {
  result: ExecutionResult;
  setResult: (result: ExecutionResult) => void;
  resetResult: () => void;
}

const defaultResult: ExecutionResult = {
  id: "",
  columns: [],
  data: [],
  execution_time: "",
  message: "",
  status: true,
};

const useExecutionResultStore = create<ExecutionResultState>((set) => ({
  result: defaultResult,
  setResult: (result) => set({ result }),
  resetResult: () => set({ result: defaultResult }),
}));

export default useExecutionResultStore;
