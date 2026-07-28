// import { create } from "zustand";
// import { cloneDeep } from "lodash";
// import { Node, Edge, NodeChange, EdgeChange, Viewport, applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
// import type { NodeData, EdgeType, FlowType, AllNodeType, SplitMode } from "@/types/flow";
// import { buildPositionDictionary, getNodeId } from "@/utils/reactflowUtils";
// import { track } from "@/customization/utils/analytics";
// import { FlowStoreType } from "@/types/zustand/flow";

// // // this is our useStore hook that we can use in our components to get parts of the store and call actions
// const useFlowStore = create<FlowStoreType>((set, get) => ({
//   nodes: [],
//   edges: [],
//   connectingData: [],
//   splitMode: 'open',

//   reactFlowInstance: null,
//   filterType: undefined,
//   setFilterType: (filterType) => {
//     set({ filterType });
//   },
//   autoSaveFlow: undefined,
//   handleDragging: undefined,
//   setHandleDragging: (handleDragging) => {
//     set({ handleDragging });
//   },
//   setReactFlowInstance: (newState) => {
//     set({ reactFlowInstance: newState });
//   },

//   setNodes: (nodes) => {
//     set({ nodes });
//     get().updateCurrentFlow(nodes, get().edges); // Use the passed nodes
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },

//   setEdges: (edges) => {
//     set({ edges });
//     get().updateCurrentFlow(get().nodes, edges); // Use the passed edges
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },

//   setConnectingData: (data) => {
//     set({ connectingData: data });
//   },

//   addEdge: (newEdge: EdgeType) => {
//     set((state) => ({
//       edges: addEdge(newEdge, state.edges),
//     }));
//     get().updateCurrentFlow(get().nodes, get().edges);
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },

//   setNode: (id: string, nodeData: AllNodeType) => {
//     // const node = get().nodes.find((node) => node.id === id);
//     // if (!node) {
//     //   return;
//     // }
//     // set((state) => ({
//     //   ...state,
//     //   edges: state.edges.map((e) => (e.source === id ? { ...e, source: nodeData.id } : e)),
//     //   nodes: state.nodes.map((n) => (n.id === id ? nodeData : n)),
//     // }));
//      set((state) => ({
//       ...state,
//       nodes: get().nodes,
//       edges: get().edges,
//     }));
//     get().updateCurrentFlow(get().nodes, get().edges);
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },

//   getFlow: () => {
//     return {
//       nodes: get().nodes,
//       edges: get().edges,
//       viewport: get().reactFlowInstance?.getViewport()!,
//     };
//   },

//   onNodesChange: (changes: NodeChange<AllNodeType>[]) => {
//     if (get().currentFlow?.data?.nodes) {
//       set({
//         nodes: applyNodeChanges(changes, get().nodes),
//       });
//     }
//     get().updateCurrentFlow(get().nodes, get().edges);
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },
//   onEdgesChange: (changes: EdgeChange<EdgeType>[]) => {
//     if (get().currentFlow?.data?.edges) {
//       set({
//         edges: applyEdgeChanges(changes, get().currentFlow?.data?.edges),
//       });
//     }
//     get().updateCurrentFlow(get().nodes, get().edges);
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },

//   positionDictionary: {},
//   setPositionDictionary: (positionDictionary) => {
//     set({ positionDictionary });
//   },

//   isPositionAvailable: (position: { x: number; y: number }) => {
//     if (
//       get().positionDictionary[position.x] &&
//       get().positionDictionary[position.x] === position.y
//     ) {
//       return false;
//     }
//     return true;
//   },
//   currentFlow: undefined,
//   setCurrentFlow: (flow) => {
//     set({ currentFlow: flow });
//     get().updateCurrentFlow(get().currentFlow?.data?.nodes, get().currentFlow?.data?.edges);
//     if (get().autoSaveFlow) {
//       get().autoSaveFlow!();
//     }
//   },
//   current_node_id: undefined,
//   setCurrentNodeId: (nodeId) => {
//     set({ current_node_id: nodeId });
//   },

//   updateCurrentFlow: (nodes: AllNodeType[], edges: EdgeType[], viewport?: Viewport) => {
//     set({
//       currentFlow: {
//         ...get().currentFlow!,
//         data: {
//           nodes: nodes ?? get().currentFlow?.data?.nodes ?? [],
//           edges: edges ?? get().currentFlow?.data?.edges ?? [],
//           viewport: viewport ?? get().currentFlow?.data?.viewport ?? {
//             x: 0,
//             y: 0,
//             zoom: 1,
//           },
//         },
//       },
//     });
//   },

//   // updateCurrentFlow: (nodes, edges) => {
//   //   const currentFlow = get().currentFlow;
//   //   if (currentFlow) {
//   //     // Only update if there are actual changes
//   //     if (JSON.stringify(currentFlow.data.nodes) !== JSON.stringify(nodes) ||
//   //         JSON.stringify(currentFlow.data.edges) !== JSON.stringify(edges)) {
//   //       set({
//   //         currentFlow: {
//   //           ...currentFlow,
//   //           data: {
//   //             ...currentFlow.data,
//   //             nodes,
//   //             edges
//   //           }
//   //         }
//   //       });
//   //     }
//   //   }
//   // },

//   deleteNode: (nodeId: any) => {
//     const { filteredNodes, deletedNode } = get().nodes.reduce<{
//       filteredNodes: AllNodeType[];
//       deletedNode: AllNodeType | null;
//     }>(
//       (acc, node) => {
//         const isMatch =
//           typeof nodeId === "string"
//             ? node.id === nodeId
//             : nodeId.includes(node.id);

//         if (isMatch) {
//           acc.deletedNode = node;
//         } else {
//           acc.filteredNodes.push(node);
//         }

//         return acc;
//       },
//       { filteredNodes: [], deletedNode: null },
//     );

//     get().setNodes(filteredNodes);

//     if (deletedNode) {
//       track("Component Deleted", { componentType: deletedNode.data.type });
//     }
//   },

//   deleteEdge: (edgeId: any) => {
//     get().setEdges(
//       get().edges.filter((edge) =>
//         typeof edgeId === "string"
//           ? edge.id !== edgeId
//           : !edgeId.includes(edge.id),
//       ),
//     );
//     track("Component Connection Deleted", { edgeId });
//   },

//   // deleteNode: (id: string) => {
//   //   set({
//   //     nodes: get().nodes.filter((node) => node.id !== id),
//   //     edges: get().edges.filter((edge) => edge.source !== id && edge.target !== id),
//   //   });
//   //   get().updateCurrentFlow({ nodes: get().nodes, edges: get().edges });
//   //   if (get().autoSaveFlow) {
//   //     get().autoSaveFlow!();
//   //   }
//   // },

//   getNode: (id: string) => {
//     return get().currentFlow?.data?.nodes.find(n => n.id === id);
//   },

//   getEdge: (id: string) => {
//     return get().currentFlow?.data?.edges.find(e => e.id === id);
//   },

//   getSelectedNode: () => {
//     return get().currentFlow?.data?.nodes.find(n => n.selected);
//   },

//   resetFlow: (flow: FlowType | undefined) => {
//     const nodes: any = flow?.data?.nodes ?? [];
//     const edges = flow?.data?.edges ?? [];
//     set({ nodes, edges });
//   },

//   paste: (selection, position) => {

//     let newNodes: AllNodeType[] = get().nodes;

//     let minimumX = Infinity;
//     let minimumY = Infinity;
//     const idsMap: Record<string, string> = {};
//     let newEdges = get().edges;
//     selection.nodes.forEach((node: Node) => {
//       if (node.position.y < minimumY) {
//         minimumY = node.position.y;
//       }
//       if (node.position.x < minimumX) {
//         minimumX = node.position.x;
//       }
//     });

//     const insidePosition = position.paneX
//       ? { x: position.paneX + position.x, y: position.paneY! + position.y }
//       : get().reactFlowInstance!.screenToFlowPosition({
//           x: position.x,
//           y: position.y,
//         });

//       let internalPostionDictionary = get().positionDictionary;
//       if (Object.keys(internalPostionDictionary).length === 0) {
//         internalPostionDictionary = buildPositionDictionary(get().nodes);
//       }
//       while (!get().isPositionAvailable(insidePosition)) {
//         insidePosition.x += 10;
//         insidePosition.y += 10;
//       }

//     // minimumX = Math.min(...selection.nodes.map((node) => node.position!.x));
//     // minimumY = Math.min(...selection.nodes.map((node) => node.position!.y));
//     selection.nodes.forEach((node: AllNodeType) => {
//       // Generate a unique node ID
//       let newId = getNodeId(node.data.type);
//       idsMap[node.id] = newId;

//       // Create a new node object with the correct type
//       const newNode = {
//         id: newId,
//         type: node.type as "genericNode" | "noteNode",
//         position: {
//           x: insidePosition.x + node.position!.x - minimumX,
//           y: insidePosition.y + node.position!.y - minimumY,
//         },
//         // @ts-ignore
//         name: node.data.name,
//         data: {
//           ...cloneDeep(node.data),
//           id: newId,
//         },
//       } as AllNodeType;

//       // updateGroupRecursion(
//       //   newNode,
//       //   selection.edges,
//       //   useGlobalVariablesStore.getState().unavailableFields,
//       //   useGlobalVariablesStore.getState().globalVariablesEntries,
//       // );

//       // Add the new node to the list of nodes in state
//       newNodes = newNodes
//         .map((node) => ({ ...node, selected: false }))
//         .concat({ ...newNode, selected: true });
//       get().setCurrentNodeId(newId);
//     });
//     get().setNodes(newNodes);

//     selection.edges.forEach((edge: EdgeType) => {
//       const newEdge = {
//         ...edge,
//         source: idsMap[edge.source],
//         target: idsMap[edge.target],
//       };
//       newEdges = newEdges.concat(newEdge);
//     });
//     get().setEdges(newEdges); 
//   },

//   setSplitMode: (mode: SplitMode) =>
//     set(() => ({
//       splitMode: mode,
//     }))
// }));



// // --- Auto-Save Logic ---

// // A simple debounce utility to prevent spamming the API
// const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
//   let timeout: number;
//   return (...args: Parameters<F>): void => {
//     clearTimeout(timeout);
//     timeout = window.setTimeout(() => func(...args), waitFor);
//   };
// };

// const saveWorkflowToApi = async (workflow: FlowType) => {
//   // useFlowStore.setState({ saveStatus: 'saving' });
//   console.log("Auto-saving workflow:", workflow);

//   try {
//     // IMPORTANT: Replace this with your actual API endpoint
//     const response = await fetch('/api/flow-builder/create-workflow', {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify(workflow),
//     });

//     if (!response.ok) {
//       // Mocking a failed response for demonstration
//       throw new Error(`API Error: ${response.statusText}`);
//     }

//     // useFlowStore.setState({ saveStatus: 'success' });
//   } catch (error) {
//     console.error("Failed to save workflow:", error);
//     // useFlowStore.setState({ saveStatus: 'error' });
//   } finally {
//     // After 2 seconds, reset the status back to 'idle'
//     // setTimeout(() => useFlowStore.setState({ saveStatus: 'idle' }), 2000);
//   }
// };

// const debouncedSave = debounce(saveWorkflowToApi, 2000); // 1-second debounce delay

// // Subscribe to changes in the workflow state

// useFlowStore.subscribe((state) => {
//   if (!state.currentFlow) return;
//   // console.log("Auto-saving workflow:", state.currentFlow);
//   // debouncedSave(state.currentFlow);
// });


// // useFlowStore.subscribe(
// //   (state) => state.currentFlow,
// //   (currentFlow) => {
// //     // A simple check to prevent saving on the very first render/initialization
// //     if (currentFlow?.data?.nodes.length === 0 && currentFlow?.data?.edges.length === 0) {
// //       return;
// //     }
// //     debouncedSave(currentFlow);
// //   }
// // );

// export default useFlowStore;
























import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as addEdgeUtility,
  Viewport,
  ReactFlowInstance,
  addEdge,
} from '@xyflow/react';
import { AlgoNodeData, Workflow, ConnectorTemplate } from '@/types/flow/index';
import { buildPositionDictionary, getNodeId } from '@/utils/reactflowUtils';
import { getNodeDetailsApi } from '@/controllers/API';
import { patchSapWorkflowNodeData } from '@/utils/sapNodeActions';
import { getDatasetById } from '@/controllers/API/datasetApi';
import { getInitialVirtualDbEnabled } from '@/utils/virtualDatasetPayload';
import api from "@/controllers/API/api";

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export type RFState = {
  currentWorkflow: Workflow | null; // This holds the live state of the canvas
  saveStatus: SaveStatus;
  /** When true, PageComponent should skip calling id/version API on next effect (workflow was set from get-version-by-id in versions dropdown) */
  skipIdApiFetchOnce: boolean;
  setSkipIdApiFetchOnce: (v: boolean) => void;
  /** When true, FlowPage should not open AI chat (set after save-as-draft to avoid opening chat and triggering compile) */
  skipOpenAiAfterSaveDraft: boolean;
  setSkipOpenAiAfterSaveDraft: (v: boolean) => void;
  /** When true, save-as-draft is in progress - AiChatDialog should not run compile effect */
  isSavingDraft: boolean;
  setIsSavingDraft: (v: boolean) => void;
  /** After loading a draft version from canvas, skip one AI chat conversations reload (mirrors in-component ref) */
  skipAiChatLoadConversationsOnce: boolean;
  setSkipAiChatLoadConversationsOnce: (v: boolean) => void;
  setCurrentWorkflow: (workflow: Workflow) => void; // Action to load a new/saved workflow
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  addNode: (template: ConnectorTemplate, screenPosition: { x: number; y: number }) => void;
  updateNodeData: (nodeId: string, data: Partial<AlgoNodeData>) => void;
  /**
   * Merges node data from API/config saves while preserving user-edited labels
   * (`display_name`/`name`) stored on the workflow node.
   */
  updateNodeDataPreserveLabel: (nodeId: string, data: Partial<AlgoNodeData>) => void;
  setViewport: (viewport: Viewport) => void;
  outputNode: Node<AlgoNodeData> | null;
  setOutputNode: (node: Node<AlgoNodeData> | null) => void;
  // --- Graph Selectors ---
  getNode: (id: string) => Node<AlgoNodeData> | undefined;
  getSelectedNode: () => Node<AlgoNodeData> | undefined;
  getUpstreamNodes: (nodeId: string) => Node<AlgoNodeData>[];
  /** All nodes reachable by walking incoming edges (transitive ancestors). */
  getAllUpstreamNodes: (nodeId: string) => Node<AlgoNodeData>[];
  getDownstreamNodes: (nodeId: string) => Node<AlgoNodeData>[];

  current_node_id: string | undefined;
  setCurrentNodeId: (nodeId: string | undefined) => void;

  reactFlowInstance: ReactFlowInstance | null;
  setReactFlowInstance: (newState: ReactFlowInstance | null) => void;
  positionDictionary: Record<string, { x: number; y: number }>;
  setPositionDictionary: (positionDictionary: Record<string, { x: number; y: number }>) => void;
};

const useFlowStore = create<RFState>((set, get) => ({
  currentWorkflow: null, // Start with null until a workflow is loaded
  saveStatus: 'idle',
  skipIdApiFetchOnce: false,
  setSkipIdApiFetchOnce: (v) => set({ skipIdApiFetchOnce: v }),
  skipOpenAiAfterSaveDraft: false,
  setSkipOpenAiAfterSaveDraft: (v) => set({ skipOpenAiAfterSaveDraft: v }),
  isSavingDraft: false,
  setIsSavingDraft: (v) => set({ isSavingDraft: v }),
  skipAiChatLoadConversationsOnce: false,
  setSkipAiChatLoadConversationsOnce: (v) => set({ skipAiChatLoadConversationsOnce: v }),
  current_node_id: undefined,
  reactFlowInstance: null,
  positionDictionary: {},
  outputNode: null,
  setOutputNode: (node) => set({ outputNode: node }),

  setPositionDictionary: (positionDictionary: Record<string, { x: number; y: number }>) => {
    set({ positionDictionary });
  },
  

  setReactFlowInstance: (newState) => {
    set({ reactFlowInstance: newState });
  },

  setCurrentNodeId: (nodeId) => {
    set({ current_node_id: nodeId });
  },

  setCurrentWorkflow: (workflow: Workflow) => {
    set({ currentWorkflow: workflow });
  },

  onNodesChange: (changes: NodeChange[]) => {
    set((state) => {
      if (!state.currentWorkflow) return {};

      
      const newNodes = applyNodeChanges(changes, state.currentWorkflow.data.nodes);  //Only update nodes if there are actual changes
      // Only create new workflow object if nodes actually changed
      if (newNodes === state.currentWorkflow.data.nodes) {   // Prevent unnecessary updates for position changes during drag
        return {};
      }

      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            nodes: newNodes,
          },
        },
      };
    });
  },

  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => {
      if (!state.currentWorkflow) return {};

      // Optimize: Only update edges if there are actual changes
      const newEdges = applyEdgeChanges(changes, state.currentWorkflow.data.edges);

      if (newEdges === state.currentWorkflow.data.edges) {
        return {};
      }

      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            edges: newEdges,
          },
        },
      };
    });
  },

  onConnect: (connection: Connection) => {
    const newEdge: Edge = {
      id: `edge_${connection.source ?? 'none'}_${connection.target ?? 'none'}`,
      ...connection,
      type: 'customEdge',
    };
    set((state) => {
      if (!state.currentWorkflow) return {};
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            edges: addEdge(newEdge, state.currentWorkflow.data.edges),
          },
        },
      };
    });
  },

  // This is the new, robust function for adding a node, with logic inside the store.
  addNode: async (template: ConnectorTemplate, screenPosition: { x: number; y: number }) => {
    console.log("template", template);
    const { reactFlowInstance, currentWorkflow } = get();
    let nodeData;
    if (!reactFlowInstance || !currentWorkflow) {
      console.warn("Cannot add node: React Flow instance or workflow not available.");
      return;
    }

    let position = reactFlowInstance.screenToFlowPosition(screenPosition);
    
    // Only check for exact position overlap (nodes stacked on same coordinates)
    const EXACT_POSITION_THRESHOLD = 5; // Only 5 pixels - almost exact same position
    const OFFSET_STEP = 30; // Small offset if exact overlap detected
    const existingNodes = currentWorkflow.data.nodes || [];
    
    let hasOverlap = true;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Only offset if dropping at EXACT same position as existing node
    while (hasOverlap && attempts < maxAttempts) {
      hasOverlap = existingNodes.some(node => {
        const dx = Math.abs(node.position.x - position.x);
        const dy = Math.abs(node.position.y - position.y);
        // Only consider it overlap if positions are nearly identical
        return dx < EXACT_POSITION_THRESHOLD && dy < EXACT_POSITION_THRESHOLD;
      });
      
      if (hasOverlap) {
        // Small offset to avoid exact overlap
        position = {
          x: position.x + OFFSET_STEP,
          y: position.y + OFFSET_STEP,
        };
        attempts++;
      }
    }
    
    console.log(`Creating new node at position: x=${position.x}, y=${position.y}, overlap adjustments=${attempts}`);
    
    if (template?.data?.isPipelineWorkflow) {
      // Pipeline/workflow reference from sidebar: node with pipeline icon; opening it navigates to full-page workflow
      const workflowId = String(template.data.workflowId ?? template.data.workflow_id ?? '');
      const displayName =
        template.data.display_name ?? template.data.name ?? (workflowId ? `Workflow ${workflowId}` : 'Pipeline');
      nodeData = {
        type: 'genericNode',
        node_id: 'pipeline_reference',
        display_name: displayName,
        name: displayName,
        icon: 'Workflow',
        pipeline_workflow_id: workflowId,
        node: { payload: { pipeline_workflow_id: workflowId } },
      };
    } else if (template?.data?.isDataset) {
      const payload = template?.data?.id;
      nodeData = await getDatasetById(payload);
    } else {
      const payload = { node_id: template?.data?.node_id };
      const res = await getNodeDetailsApi(payload);
      nodeData = patchSapWorkflowNodeData(res.data) ?? res.data;
    }

    const uniqueNodeId = getNodeId(nodeData.type ?? 'genericNode');
    const finalDisplayName =
      template?.data?.display_name ?? template?.data?.name ?? nodeData?.display_name ?? nodeData?.name ?? 'Node';
    const nodeDataForInit = {
      ...nodeData,
      isDataset: template?.data?.isDataset ?? nodeData?.isDataset,
      icon: template?.data?.icon ?? nodeData?.icon,
    };
    const newNode: Node<AlgoNodeData> = {
      id: uniqueNodeId,
      type: (template?.type as "genericNode" | "noteNode") ?? 'genericNode',
      position,
      data: {
        ...nodeData,
        icon: template?.data?.icon ?? nodeData?.icon,
        isDataset: template?.data?.isDataset,
        saved_node: true,
        isExpanded: false,
        status: 'idle',
        display_name: finalDisplayName,
        name: finalDisplayName,
        virtualDbEnabled: getInitialVirtualDbEnabled(nodeDataForInit, currentWorkflow),
      },
      // @ts-ignore - React Flow node label
      name: finalDisplayName,
    };
    
    console.log(`✅ Creating NEW node with unique ID: ${uniqueNodeId}`, newNode);
    console.log(`Total nodes before add: ${currentWorkflow.data.nodes.length}`);
    
    set({
      currentWorkflow: {
        ...currentWorkflow,
        data: {
          ...currentWorkflow.data,
          nodes: [...currentWorkflow.data.nodes, newNode],
        },
      },
    });
    
    console.log(`Total nodes after add: ${get().currentWorkflow?.data.nodes.length}`);
  },

  // A new, dedicated function for adding an edge.
  addEdge: (edge: Edge) => {
    set((state) => {
      if (!state.currentWorkflow) {
        console.warn("Cannot add edge: no workflow is currently loaded.");
        return {};
      }
      // Use the React Flow utility to prevent duplicate edges
      const newEdges = addEdgeUtility(edge, state.currentWorkflow.data.edges);
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            edges: newEdges,
          },
        },
      };
    });
  },

  updateNodeData: (nodeId: string, data: Partial<AlgoNodeData>) => {
    set((state) => {
      if (!state.currentWorkflow) return {};
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            nodes: state.currentWorkflow.data.nodes.map((node) => {
              if (node.id === nodeId) {
                return { ...node, data: { ...node.data, ...data } };
              }
              return node;
            }),
          },
        },
      };
    });
  },

  updateNodeDataPreserveLabel: (nodeId: string, data: Partial<AlgoNodeData>) => {
    set((state) => {
      if (!state.currentWorkflow) return {};
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            nodes: state.currentWorkflow.data.nodes.map((node) => {
              if (node.id !== nodeId) return node;
              return {
                ...node,
                data: {
                  ...node.data,
                  ...data,
                  display_name: node.data.display_name,
                  name: node.data.name,
                },
              };
            }),
          },
        },
      };
    });
  },

  setViewport: (viewport: Viewport) => {
    set((state) => {
      if (!state.currentWorkflow) return {};
      return {
        currentWorkflow: {
          ...state.currentWorkflow,
          data: {
            ...state.currentWorkflow.data,
            viewport: viewport,
          },
        },
      };
    });
  },

  // --- Selector Implementations ---
  getNode: (id: string) => {
    return get().currentWorkflow?.data?.nodes?.find((n) => n.id === id);
  },

  getSelectedNode: () => {
    return get().currentWorkflow?.data?.nodes?.find((n) => n.selected);
  },

  getUpstreamNodes: (nodeId: string) => {
    const workflow = get().currentWorkflow;
    if (!workflow?.data?.nodes || !workflow.data.edges) return [];
    const { edges, nodes } = workflow.data;
    const upstreamEdges = edges.filter((edge) => edge.target === nodeId);
    const upstreamNodeIds = new Set(upstreamEdges.map((edge) => edge.source));
    return nodes.filter((node) => upstreamNodeIds.has(node.id));
  },

  getAllUpstreamNodes: (nodeId: string) => {
    const workflow = get().currentWorkflow;
    if (!workflow?.data?.nodes || !workflow.data.edges) return [];
    const { edges, nodes } = workflow.data;
    const ancestorIds = new Set<string>();
    const stack: string[] = edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => edge.source);
    while (stack.length) {
      const id = stack.pop()!;
      if (ancestorIds.has(id)) continue;
      ancestorIds.add(id);
      const parents = edges
        .filter((edge) => edge.target === id)
        .map((edge) => edge.source);
      stack.push(...parents);
    }
    return nodes.filter((node) => ancestorIds.has(node.id));
  },

  getDownstreamNodes: (nodeId: string) => {
    const workflow = get().currentWorkflow;
    if (!workflow?.data?.nodes || !workflow.data.edges) return [];
    const { edges, nodes } = workflow.data;
    const downstreamEdges = edges.filter((edge) => edge.source === nodeId);
    const downstreamNodeIds = new Set(downstreamEdges.map((edge) => edge.target));
    return nodes.filter((node) => downstreamNodeIds.has(node.id));
  },
}));


// --- Auto-Save Logic ---
const debounce = <F extends (...args: any[]) => any>(func: F, waitFor: number) => {
  let timeout: number;
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), waitFor);
  };
};

const saveWorkflowToApi = async (workflow: Workflow) => {
  useFlowStore.setState({ saveStatus: 'saving' });
  console.log("Auto-saving workflow:", workflow);

  try {
    // Strip data from nodes with unique_ids before saving
    const { prepareWorkflowForSave } = await import('@/utils/workflowUtils');
    const workflowToSave = prepareWorkflowForSave(workflow);

    // Replace with your actual API endpoint
    const response = await api.post('/workflow/save', workflowToSave);
    if (!(response.status >= 200 && response.status <= 299)) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    useFlowStore.setState({ saveStatus: 'success' });
  } catch (error) {
    console.error("Failed to save workflow:", error);
    useFlowStore.setState({ saveStatus: 'error' });
  } finally {
    setTimeout(() => useFlowStore.setState({ saveStatus: 'idle' }), 2000);
  }
};

const debouncedSave = debounce(saveWorkflowToApi, 1000);

// Subscribe to changes in the currentWorkflow state
// useFlowStore.subscribe(
//   (state) => state.currentWorkflow,
//   (workflow, previousWorkflow) => {
//     if (!workflow || !previousWorkflow) return;
//     // Simple check to avoid saving an empty initial state
//     if (previousWorkflow.data.nodes.length === 0 && workflow.data.nodes.length === 0) {
//       return;
//     }
//     debouncedSave(workflow);
//   }
// );

export default useFlowStore;
