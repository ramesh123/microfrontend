

export type FlowsManagerStoreType = {
  currentFlowId: string;
  setCurrentFlowId: (currentFlowId: string) => void;
  flows: Array<any> | undefined;
  setFlows: (flows: any[]) => void;
  currentFlow: any | undefined;
  setCurrentFlow: (flow: any | undefined) => void; 
  saveLoading: boolean;
  setSaveLoading: (saveLoading: boolean) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  undo: () => void;
  redo: () => void;
  takeSnapshot: () => void;
  flowId: string | null;
  flowName: string | null;
  deploymentName: string | null;
  setFlowDetails: (details: { flowId: string; flowName: string; deploymentName: string }) => void;

  executedNodeData: any | null;
  setExecutedNodeData: (data: any | null) => void;
}

export type UseUndoRedoOptions = {
  maxHistorySize: number;
  enableShortcuts: boolean;
};