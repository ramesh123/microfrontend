import ValidationHelperBase from "@/components/common/sheet-component/ValidationHelperBase";
import { toast } from "sonner";
import useFlowStore from "@/stores/flowStore";
import { FlowNode } from '@/types/form';
import { ValidationHelper } from '@/types/dataValidation';
import { Column, Source } from '@/types';
import useDataValidationStore, { mergeSourceOrderWithSources } from '@/stores/nwayvalidationstore';



export default class NWayValidationHelper extends ValidationHelperBase implements ValidationHelper {

  buildSavePayload(nodeData: FlowNode) {
    const saveEndpointConfig = nodeData?.data?.node?.save_node || { module: null, klass: null };
    if (!saveEndpointConfig?.module || !saveEndpointConfig?.klass) {
      toast.error('Save API endpoint is not configured for this node.');
      return;
    }
    const findColumnDetails = (sourceId: string, columnId: string): { source: Source; column: Column } | undefined => {
      const source = sources.find(s => s.id === sourceId);
      if (!source) return undefined;
      const column = source.columns.find(c => c.id === columnId);
      return source && column ? { source, column } : undefined;
    };

    const { getUpstreamNodes, currentWorkflow } = useFlowStore.getState()
    const sources: Source[] = this.getSources(getUpstreamNodes(nodeData?.id) as FlowNode[])
    const { connections, connectionTypes, aggregationRules, selectedSourceIds, sourceOrder } = useDataValidationStore.getState()
    if (connections.length === 0) {
      toast.warning("Please create at least one connection to save.");
      return;
    }
    const datasets: { [key: string]: string } = {};
    const orderedIds = mergeSourceOrderWithSources(sourceOrder, sources);
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
    //flow_id from currentWorkflow 
    finalData.flow_id = currentWorkflow?.flow_id || nodeData.data.flow_id;

    return finalData;
  }
}
