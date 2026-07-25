
import { FlowNode } from '@/types/form';
import { Source } from '@/types';

export default class ValidationHelperBase {
  getSources(sourceNodes: FlowNode[]): Source[] {
    if (!sourceNodes || sourceNodes.length === 0) return [];

    // const datasets = currentNode?.data?.node?.payload?.datasets;

    return sourceNodes.map((node: FlowNode, index: number) => ({
      id: node.id,
      name: node.data.node?.payload?.table || node.data.display_name || node.id,
      tag: node.data.node?.payload?.tag || `tag${index + 1}`,
      selected: true,
      data: node.data.node?.output?.data || [],
      columns: (node.data.node?.output?.columns || []).map((colName: string, colIndex: number) => ({
        id: `col${colIndex}`,
        name: colName,
        type: 'string',
        sourceId: node.id,
      })),
    }));
  }

}
