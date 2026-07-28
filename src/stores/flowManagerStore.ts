import useFlowStore from "./flowStore";
import { create } from "zustand";
import { cloneDeep } from "lodash";
import { FlowsManagerStoreType, UseUndoRedoOptions } from "@/types/flowsManager";


const defaultOptions: UseUndoRedoOptions = {
  maxHistorySize: 100,
  enableShortcuts: true,
};

const past = {};
const future = {};

interface FlowsManagerStore {
  takeSnapshot: () => void; 
  flowId: string | null;
  flowName: string | null;
  deploymentName: string | null;
  setFlowDetails: (details: { flowId: string; flowName: string; deploymentName: string }) => void;
}


export const useFlowsManagerStore = create<FlowsManagerStoreType>((set, get) => ({

  currentFlowId: "",
  setCurrentFlowId: (currentFlowId: string) => set({ currentFlowId }),

  flows: [],
  setFlows: (flows: any[]) => set({ flows }),

  saveLoading: false,
  setSaveLoading: (saveLoading: boolean) => set({ saveLoading }),

  isLoading: false,
  setIsLoading: (isLoading: boolean) => set({ isLoading }),

  currentFlow: undefined,
  setCurrentFlow: (flow: any | undefined) => { 
    set({
      currentFlow: flow,
      currentFlowId: flow?.workflow_id ?? "",
    });
    // useFlowStore.getState().resetFlow(flow);
  },

  undo: () => {
    const currentFlowId = get().currentFlowId;
    const pastLength = past[currentFlowId]?.length ?? 0;
    if (pastLength === 0) return;
    const lastState = past[currentFlowId][pastLength - 1];
    past[currentFlowId] = past[currentFlowId].slice(0, pastLength - 1);
    future[currentFlowId].push(lastState);
    const flowStore = useFlowStore.getState();
    // flowStore.setNodes(lastState.nodes);
    // flowStore.setEdges(lastState.edges);
  },

  redo: () => {
    const currentFlowId = get().currentFlowId;
    const futureLength = future[currentFlowId]?.length ?? 0;
    if (futureLength === 0) return;
    const lastState = future[currentFlowId][futureLength - 1];
    future[currentFlowId] = future[currentFlowId].slice(0, futureLength - 1);
    past[currentFlowId].push(lastState);
    const flowStore = useFlowStore.getState();
    // flowStore.setNodes(lastState.nodes);
    // flowStore.setEdges(lastState.edges);
  },

  takeSnapshot: () => {
    const currentFlowId = get().currentFlowId;
    // push the current graph to the past state
    const flowStore = useFlowStore.getState();
    const newState = {
      // nodes: cloneDeep(flowStore.nodes),
      // edges: cloneDeep(flowStore.edges),
    };
    const pastLength = past[currentFlowId]?.length ?? 0;
    if (
      pastLength > 0 &&
      JSON.stringify(past[currentFlowId][pastLength - 1]) ===
      JSON.stringify(newState)
    )
      return;
    if (pastLength > 0) {
      past[currentFlowId] = past[currentFlowId].slice(
        pastLength - defaultOptions.maxHistorySize + 1,
        pastLength,
      );

      past[currentFlowId].push(newState);
    } else {
      past[currentFlowId] = [newState];
    }

    future[currentFlowId] = [];
  },
  flowId: null,
  flowName: null,
  deploymentName: null,
  
  // Add the new action to update the state
  setFlowDetails: (details) => set({
    flowId: details.flowId,
    flowName: details.flowName,
    deploymentName: details.deploymentName,
  }),

  executedNodeData: null,
  setExecutedNodeData: (data: any | null) => set({ executedNodeData: data }),
}));