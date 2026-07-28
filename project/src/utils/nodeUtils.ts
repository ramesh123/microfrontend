/**
 * Gets nodes that have no incoming connections (source nodes)
 * These nodes typically fetch data from external sources
 * @param edges - Array of edges in the workflow
 * @returns Array of node IDs that have no inputs
 */
export function getNodesWithoutInputs(edges: any[]) {
  if (!edges || edges.length === 0) return [];

  // Create sets for all source and target nodes
  const sourceNodes = new Set(edges.map(edge => edge.source));
  const targetNodes = new Set(edges.map(edge => edge.target));

  // Nodes that are in source but not in target => no incoming edges
  const nodesWithoutInputs = [...sourceNodes].filter(node => !targetNodes.has(node));

  return nodesWithoutInputs;
}

/**
 * Checks if a node is a source node (no incoming connections)
 * @param nodeId - The node ID to check
 * @param edges - Array of edges in the workflow
 * @returns True if the node has no incoming connections
 */
export function isSourceNode(nodeId: string, edges: any[]): boolean {
  if (!edges || edges.length === 0) return true;
  
  // Check if this node is a target of any edge
  return !edges.some(edge => edge.target === nodeId);
}

