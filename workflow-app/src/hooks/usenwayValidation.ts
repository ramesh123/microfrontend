import { useState, useCallback, useEffect, useMemo } from 'react';
import { Connection, Source, AggregationRule, AggregationType } from '@/types';

export const useNWayDataValidation = (nodeData: any, sources: Source[]) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [aggregationRules, setAggregationRules] = useState<AggregationRule[]>([]);

  const sourceNameMap = useMemo(() => {
    const map = new Map<string, Source>();
    sources.forEach(s => map.set(s.name, s));
    return map;
  }, [sources]);

  useEffect(() => {
    const payload = nodeData?.data?.node?.payload;
    if (payload?.saved_node && payload?.column_mappings) {
      const restoredConnections: Connection[] = payload.column_mappings
        .map((mapping: any) => {
          const [sourceId, ...sourceColumnParts] = mapping.sourceColumnId.split('-');
          const sourceColumn = sourceColumnParts.join('-');
          const [targetId, ...targetColumnParts] = mapping.targetColumnId.split('-');
          const targetColumn = targetColumnParts.join('-');
          
          const sourceObj = sources.find(s => s.id === sourceId);
          const targetObj = sources.find(s => s.id === targetId);
          
          if (!sourceObj || !targetObj) return null;

          return {
            id: `${mapping.sourceColumnId}-${mapping.targetColumnId}`,
            sourceId,
            targetId,
            sourceColumn,
            targetColumn,
            sourceTag: sourceObj?.tag || '',
            targetTag: targetObj?.tag || '',
          };
        })
        .filter((c: Connection | null): c is Connection => c !== null);
      
      setConnections(restoredConnections);
      
      const restoredRules: AggregationRule[] = [];
      if (payload.aggregation_cols) {
        Object.entries(payload.aggregation_cols).forEach(([pairKey, pairData]: [string, any]) => {
          Object.entries(pairData).forEach(([sourceName, columnRules]: [string, any]) => {
            const sourceObj = sourceNameMap.get(sourceName);
            if (!sourceObj) return;

            Object.entries(columnRules).forEach(([columnName, aggType]: [string, any]) => {
              const columnObj = sourceObj.columns.find(c => c.name === columnName);
              if (!columnObj) return;

              const conn = restoredConnections.find(c => 
                (c.sourceId === sourceObj.id && c.sourceColumn === columnObj.id) ||
                (c.targetId === sourceObj.id && c.targetColumn === columnObj.id)
              );

              if (conn) {
                const existingRule = restoredRules.find(r => r.connectionId === conn.id);
                if (existingRule) {
                  if (conn.sourceId === sourceObj.id) {
                    existingRule.sourceColumnAggregation = aggType;
                  } else {
                    existingRule.targetColumnAggregation = aggType;
                  }
                } else {
                  restoredRules.push({
                    connectionId: conn.id,
                    sourceColumnAggregation: conn.sourceId === sourceObj.id ? (aggType as AggregationType) : 'sum',
                    targetColumnAggregation: conn.targetId === sourceObj.id ? (aggType as AggregationType) : 'sum',
                  });
                }
              }
            });
          });
        });
      }
      setAggregationRules(restoredRules);

    } else {
      setConnections([]);
      setAggregationRules([]);
    }
  }, [nodeData, sources, sourceNameMap]);

  const addConnection = useCallback((connection: Connection) => {
    setConnections(prev => [...prev, connection]);
    
    setAggregationRules((prev: any[]) => [
      ...prev,
      {
        connectionId: connection.id,
        sourceColumnAggregation: 'sum',
        targetColumnAggregation: 'sum',
      },
    ]);
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    setAggregationRules(prev => prev.filter(rule => rule.connectionId !== connectionId));
  }, []);

  const updateAggregationRule = useCallback((updatedRule: Partial<AggregationRule> & { connectionId: string }) => {
    setAggregationRules(prev => 
      prev.map(rule => 
        rule.connectionId === updatedRule.connectionId
          ? { ...rule, ...updatedRule }
          : rule
      )
    );
  }, []);

  return {
    connections,
    aggregationRules,
    addConnection,
    removeConnection,
    updateAggregationRule,
  };
};
