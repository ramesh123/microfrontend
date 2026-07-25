import ValidationHelperBase from "@/components/common/sheet-component/ValidationHelperBase";
import useFlowStore from "@/stores/flowStore";
import { FlowNode } from '@/types/form';
import { ValidationHelper } from '@/types/dataValidation';
import { Column, Source } from '@/types';
import useDataValidationStore, { mergeSourceOrderWithSources } from '@/stores/nwayvalidationstore';

export default class MultiSourceValidationHelper extends ValidationHelperBase implements ValidationHelper {

  buildSavePayload(nodeData: FlowNode) {
    const { getUpstreamNodes, currentWorkflow } = useFlowStore.getState()
    const urlParams = new URLSearchParams(window.location.search);
    const flowId = urlParams.get('id');
    const sources: Source[] = this.getSources(getUpstreamNodes(nodeData?.id) as FlowNode[])
    const findColumnDetails = (sourceId: string, columnId: string): { source: Source; column: Column } | undefined => {
      const source = sources.find(s => s.id === sourceId);
      if (!source) return undefined;
      const column = source.columns.find(c => c.id === columnId);
      return source && column ? { source, column } : undefined;
    };

    const { connections, connectionTypes, aggregationRules, selectedSourceIds, sourceOrder } = useDataValidationStore.getState()
    const orderedIds = mergeSourceOrderWithSources(sourceOrder, sources);
    const datasets: { [key: string]: string } = {};
    sources.forEach(source => {
      datasets[source.name] = JSON.stringify(source.data || []);
    });

    const key_cols: { [key: string]: [string, string][] } = {};
    const validation_cols: { [key: string]: [string, string][] } = {};
    const aggregation_cols: { [key: string]: { [key: string]: { [key: string]: string } } } = {};

    connections.forEach(conn => {
      const type = connectionTypes.get(conn.id);
      if (!type) return;

      const sourceDetails = findColumnDetails(conn.sourceId, conn.sourceColumn);
      const targetDetails = findColumnDetails(conn.targetId, conn.targetColumn);

      if (sourceDetails && targetDetails) {
        const pairKey = `('${sourceDetails.source.name}', '${targetDetails.source.name}')`;
        const pair: [string, string] = [sourceDetails.column.name, targetDetails.column.name];

        if (type === 'key') {
          if (!key_cols[pairKey]) key_cols[pairKey] = [];
          key_cols[pairKey].push(pair);
        } else if (type === 'validation' || type === 'aggregation') {
          if (!validation_cols[pairKey]) validation_cols[pairKey] = [];
          validation_cols[pairKey].push(pair);
        }

        if (type === 'aggregation') {
          const rule = aggregationRules.find(r => r.connectionId === conn.id);
          if (rule) {
            if (!aggregation_cols[pairKey]) aggregation_cols[pairKey] = {};
            if (rule.sourceColumnAggregation) {
              if (!aggregation_cols[pairKey][sourceDetails.source.name]) aggregation_cols[pairKey][sourceDetails.source.name] = {};
              aggregation_cols[pairKey][sourceDetails.source.name][sourceDetails.column.name] = rule.sourceColumnAggregation;
            }
            if (rule.targetColumnAggregation) {
              if (!aggregation_cols[pairKey][targetDetails.source.name]) aggregation_cols[pairKey][targetDetails.source.name] = {};
              aggregation_cols[pairKey][targetDetails.source.name][targetDetails.column.name] = rule.targetColumnAggregation;
            }
          }
        }
      }
    });

    const validationPayload = {
      ...nodeData?.data?.node?.payload,
      datasets,
      key_cols,
      validation_cols,
      aggregation_cols,
      saved_node: true,
      source_order: orderedIds,
      selected_sources: orderedIds
        .filter(id => selectedSourceIds.includes(id))
        .map(id => sources.find(s => s.id === id)!.name),
      column_mappings: connections.map(c => ({
        sourceColumnId: `${c.sourceId}-${c.sourceColumn}`,
        targetColumnId: `${c.targetId}-${c.targetColumn}`,
      })),
    };

    const finalData = JSON.parse(JSON.stringify(nodeData.data));
    finalData.node.payload = validationPayload;
    finalData.current_node_id = nodeData.id;
    finalData.flow_id = currentWorkflow?.flow_id || flowId || nodeData.data.flow_id;
    return finalData;
  }
}
