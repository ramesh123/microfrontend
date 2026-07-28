import type { Edge as FlowEdge, Node } from "@xyflow/react";
import type { AllNodeType, EdgeType, FlowType, NodeData, NodeDataType, SplitMode } from "@/types/flow/_index";
import type { OnEdgesChange, OnNodesChange, ReactFlowInstance, Viewport } from "@xyflow/react";

export type FlowStoreType = {
  addEdge(newEdge: FlowEdge): void;
  setEdges(newEdges: EdgeType[]): void;
  setNodes(newNodes: Node<NodeData, "genericNode">[]): void;
  connectingData: Array<{ data: string[] }>;
  setConnectingData(data: Array<{ data: string[] }>): void;
  setReactFlowInstance: (instance: ReactFlowInstance<any, any> | null) => void;
  paste: (
    selection: { nodes: any; edges: any },
    position: { x: number; y: number; paneX?: number; paneY?: number },
  ) => void;
  onNodesChange: OnNodesChange<AllNodeType | NodeDataType>;
  onEdgesChange: OnEdgesChange<EdgeType>;
  positionDictionary: { [key: number]: number };
  isPositionAvailable: (position: { x: number; y: number }) => boolean;
  setPositionDictionary: (positionDictionary: {
    [key: number]: number;
  }) => void;
  setNode: (id: string, nodeData: AllNodeType) => void;
  resetFlow: (flow: FlowType | undefined) => void;
  reactFlowInstance: ReactFlowInstance<AllNodeType, EdgeType> | null;
  nodes: AllNodeType[];
  edges: EdgeType[];
  autoSaveFlow: (() => void) | undefined;
  currentFlow: FlowType | undefined;
  setCurrentFlow: (flow: FlowType | undefined) => void;
  current_node_id: string | undefined;
  setCurrentNodeId: (nodeId: string | undefined) => void;
  splitMode: SplitMode;
  setSplitMode: (mode: SplitMode) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateCurrentFlow: (nodes: AllNodeType[], edges: EdgeType[], viewport?: Viewport) => void;
  filterType: 
  | {
      source: string | undefined;
      sourceHandle: string | undefined;
      target: string | undefined;
      targetHandle: string | undefined;
      type: string;
      color: string;
    }
  | undefined;
  setFilterType: (
    data:
      | {
          source: string | undefined;
          sourceHandle: string | undefined;
          target: string | undefined;
          targetHandle: string | undefined;
          type: string;
          color: string;
        }
      | undefined,
  ) => void;

  handleDragging:
    | {
        source: string | undefined;
        sourceHandle: string | undefined;
        target: string | undefined;
        targetHandle: string | undefined;
        type: string;
        color: string;
      }
    | undefined;
  setHandleDragging: (
    data:
      | {
          source: string | undefined;
          sourceHandle: string | undefined;
          target: string | undefined;
          targetHandle: string | undefined;
          type: string;
          color: string;
        }
      | undefined,
  ) => void;
};
