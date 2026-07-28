import { Node, Edge } from '@xyflow/react';
import { AlgoNodeData } from '@/types/flow/index';
import { getNodeId } from '@/utils/reactflowUtils';
import { getNodeDetailsApi } from '@/controllers/API';

/**
 * AI Flow Template Response Interface
 * This is the expected format from the AI backend
 */
export interface AIFlowTemplateNode {
  node_id: string; // The unique node_id from the system
  display_name?: string; // Optional custom display name
  id?: string; // Optional ID from AI response
  label?: string; // Optional label from AI response
  group?: string; // Optional group from AI response
  config?: any; // Optional config from AI response
}

export interface AIFlowTemplateConnection {
  from: number | string; // index of source node or node ID
  to: number | string; // index of target node or node ID
}

export interface AIFlowTemplateResponse {
  nodes: AIFlowTemplateNode[];
  connections?: AIFlowTemplateConnection[];
  edges?: Array<{ from: string; to: string }>; // Alternative format from API
}

/**
 * Auto-layout configuration
 */
const LAYOUT_CONFIG = {
  NODE_WIDTH: 210,
  NODE_HEIGHT: 100,
  HORIZONTAL_SPACING: 40, // Reduced from 150 to make edges shorter
  VERTICAL_SPACING:30,     // Reduced from 120 to make layout more compact
  START_X: 70,
  START_Y: 100,
};

/**
 * Calculate positions for nodes using a hierarchical layout algorithm
 * This creates a left-to-right flow with proper spacing
 */
function calculateNodePositions(
  nodes: AIFlowTemplateNode[],
  connections: AIFlowTemplateConnection[]
): Map<number, { x: number; y: number }> {
  const positions = new Map<number, { x: number; y: number }>();
  const nodeToLevel = new Map<number, number>();
  const levelToNodes = new Map<number, number[]>();

  // Build adjacency list for the graph
  const outgoingEdges = new Map<number, number[]>();
  const incomingEdges = new Map<number, number[]>();

  nodes.forEach((_, index) => {
    outgoingEdges.set(index, []);
    incomingEdges.set(index, []);
  });

  connections.forEach(({ from, to }) => {
    const fromIndex = typeof from === 'number' ? from : parseInt(from as string);
    const toIndex = typeof to === 'number' ? to : parseInt(to as string);
    outgoingEdges.get(fromIndex)?.push(toIndex);
    incomingEdges.get(toIndex)?.push(fromIndex);
  });

  // Find root nodes (nodes with no incoming edges)
  const rootNodes: number[] = [];
  nodes.forEach((_, index) => {
    if (incomingEdges.get(index)?.length === 0) {
      rootNodes.push(index);
    }
  });

  // Assign levels using BFS
  const queue: Array<{ nodeIndex: number; level: number }> = [];
  const visited = new Set<number>();

  rootNodes.forEach((nodeIndex) => {
    queue.push({ nodeIndex, level: 0 });
  });

  while (queue.length > 0) {
    const { nodeIndex, level } = queue.shift()!;

    if (visited.has(nodeIndex)) continue;
    visited.add(nodeIndex);

    nodeToLevel.set(nodeIndex, level);

    if (!levelToNodes.has(level)) {
      levelToNodes.set(level, []);
    }
    levelToNodes.get(level)?.push(nodeIndex);

    // Add children to queue
    const children = outgoingEdges.get(nodeIndex) || [];
    children.forEach((childIndex) => {
      if (!visited.has(childIndex)) {
        queue.push({ nodeIndex: childIndex, level: level + 1 });
      }
    });
  }

  // Handle disconnected nodes (nodes not visited in BFS)
  nodes.forEach((_, index) => {
    if (!visited.has(index)) {
      const maxLevel = Math.max(...Array.from(levelToNodes.keys()), -1);
      const level = maxLevel + 1;
      nodeToLevel.set(index, level);
      if (!levelToNodes.has(level)) {
        levelToNodes.set(level, []);
      }
      levelToNodes.get(level)?.push(index);
    }
  });

  // Calculate positions
  levelToNodes.forEach((nodesInLevel, level) => {
    const levelHeight = nodesInLevel.length * (LAYOUT_CONFIG.NODE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING);
    const startY = LAYOUT_CONFIG.START_Y + (levelHeight / 2) - (nodesInLevel.length - 1) * (LAYOUT_CONFIG.NODE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING) / 2;

    nodesInLevel.forEach((nodeIndex, indexInLevel) => {
      const x = LAYOUT_CONFIG.START_X + level * (LAYOUT_CONFIG.NODE_WIDTH + LAYOUT_CONFIG.HORIZONTAL_SPACING);
      const y = startY + indexInLevel * (LAYOUT_CONFIG.NODE_HEIGHT + LAYOUT_CONFIG.VERTICAL_SPACING);
      positions.set(nodeIndex, { x, y });
    });
  });

  return positions;
}

/**
 * Convert AI template response to React Flow nodes and edges
 * Fetches actual node data from API to get proper icons and configurations
 */
export async function convertAITemplateToFlow(
  aiResponse: AIFlowTemplateResponse
): Promise<{ nodes: Node<AlgoNodeData>[]; edges: Edge[] }> {
  const { nodes: aiNodes, connections, edges: apiEdges } = aiResponse;

  // Convert API edges format to connections format if needed
  let normalizedConnections: AIFlowTemplateConnection[] = [];

  if (apiEdges && apiEdges.length > 0) {
    // Create a map from node ID to index
    const nodeIdToIndex = new Map<string, number>();
    aiNodes.forEach((node, index) => {
      if (node.id) {
        nodeIdToIndex.set(node.id, index);
      }
    });

    // Convert edges to connections
    normalizedConnections = apiEdges.map(edge => ({
      from: nodeIdToIndex.get(edge.from) ?? 0,
      to: nodeIdToIndex.get(edge.to) ?? 0,
    }));
  } else if (connections) {
    normalizedConnections = connections as AIFlowTemplateConnection[];
  }

  // Calculate positions
  const positions = calculateNodePositions(aiNodes, normalizedConnections);

  // Fetch actual node data for each node using node_id
  const nodeDataPromises = aiNodes.map(async (aiNode) => {
    try {
      // Fetch full node details using node_id directly from AI response
      const response = await getNodeDetailsApi({ node_id: aiNode.node_id });
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch node data for node_id: ${aiNode.node_id}:`, error);
      // Return minimal data as fallback
      return {
        node_id: aiNode.node_id,
        display_name: aiNode.display_name || aiNode.label || 'Unknown Node',
        template: [],
        icon: '',
        icon_bg_color: '#6366f1',
        type: aiNode.group || 'Unknown',
      };
    }
  });

  const nodeDataList = await Promise.all(nodeDataPromises);

  // Create nodes with full data
  const nodes: Node<AlgoNodeData>[] = aiNodes.map((aiNode, index) => {
    const position = positions.get(index) || { x: 0, y: 0 };
    const nodeData = nodeDataList[index];
    const uniqueId = getNodeId(nodeData.type || 'Unknown');

    return {
      id: uniqueId,
      type: 'genericNode',
      position,
      data: {
        ...nodeData,
        display_name: aiNode.display_name || nodeData.display_name,
        saved_node: true,
        isExpanded: false,
        status: 'idle',
      } as AlgoNodeData,
      name: aiNode.display_name || nodeData.display_name,
    } as Node<AlgoNodeData>;
  });

  // Create a mapping from index to node ID
  const indexToNodeId = new Map<number, string>();
  nodes.forEach((node, index) => {
    indexToNodeId.set(index, node.id);
  });

  // Create edges
  const edges: Edge[] = normalizedConnections.map((connection, index) => {
    const fromIndex: number = typeof connection.from === 'number' ? connection.from : parseInt(connection.from as string);
    const toIndex: number = typeof connection.to === 'number' ? connection.to : parseInt(connection.to as string);

    const sourceId = indexToNodeId.get(fromIndex);
    const targetId = indexToNodeId.get(toIndex);

    if (!sourceId || !targetId) {
      console.warn(`Invalid connection: from ${connection.from} to ${connection.to}`);
      return null;
    }

    return {
      id: `edge_${sourceId}_${targetId}_${index}`,
      source: sourceId,
      target: targetId,
      type: 'customEdge',
    };
  }).filter(Boolean) as Edge[];

  return { nodes, edges };
}

/**
 * DUMMY TEMPLATE FOR TESTING
 * PostgreSQL → CSV → Merge → Filter → PostgreSQL
 *
 * NOTE: These are actual node_ids from the system's /api/nodes/list endpoint.
 * The actual node_ids will come from the AI backend.
 */
export function getDummyAITemplateResponse(): AIFlowTemplateResponse {
  return {
    nodes: [
      { node_id: 'postgres-sql', display_name: 'Source DB' },
      { node_id: 'csv', display_name: 'CSV Data' },
      { node_id: 'merge', display_name: 'Merge Data' },
      { node_id: 'filter_data', display_name: 'Filter Results' },
      { node_id: 'postgres-sql', display_name: 'Target DB' },
    ],
    connections: [
      { from: 0, to: 2 }, // PostgreSQL → Merge
      { from: 1, to: 2 }, // CSV → Merge
      { from: 2, to: 3 }, // Merge → Filter
      { from: 3, to: 4 }, // Filter → PostgreSQL
    ],
  };
}

/**
 * Simulate API call to AI backend
 * Replace this with actual API call when backend is ready
 */

export async function generateFlowFromPrompt(prompt: string): Promise<AIFlowTemplateResponse> {
  // TODO: Replace with actual API call
  console.log('Generating flow from prompt:', prompt);

  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // For now, return dummy data
  return getDummyAITemplateResponse();
}

