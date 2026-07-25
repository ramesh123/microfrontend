import { useState, useCallback, useEffect } from 'react';
import { Source, Connection, AggregationRule } from '@/types';

// The hook now accepts the transformed sources as an argument
export const useDataValidation = (nodeData: any, sources: Source[]) => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [aggregationRules, setAggregationRules] = useState<AggregationRule[]>([]);

  // The useEffect now depends on the sources prop
  useEffect(() => {
    const payload = nodeData?.data?.node?.payload;
    const hasSavedNode = payload?.saved_node === true;

    if (hasSavedNode && payload && payload.column_mappings && sources.length > 0) {
        const newConnections: Connection[] = payload.column_mappings.map((mapping: { sourceColumnId: string, targetColumnId: string }) => {
        const [sourceNodeId, sColId] = mapping.sourceColumnId.split('-');
        const [targetNodeId, tColId] = mapping.targetColumnId.split('-');
        
        const sourceObj = sources.find(s => s.id === sourceNodeId);
        const targetObj = sources.find(s => s.id === targetNodeId);

        if (sourceObj && targetObj) {
          return {
            id: `${mapping.sourceColumnId}-${mapping.targetColumnId}`,
            sourceId: sourceNodeId,
            targetId: targetNodeId,
            sourceColumnId: sColId,
            targetColumnId: tColId,
            sourceTag: sourceObj.tag,
            targetTag: targetObj.tag,
          };
        }
        return null;
      }).filter((c: Connection | null): c is Connection => c !== null);

      setConnections(newConnections);
      setAggregationRules(newConnections.map(c => ({
          connectionId: c.id,
          sourceColumnAggregation: 'sum',
          targetColumnAggregation: 'sum',
      })));
    } else {
      setConnections([]);
      setAggregationRules([]);
    }
  }, [nodeData, sources]);

  const addConnection = useCallback((connection: Connection) => {
    setConnections(prev => {
      if (prev.some(c => c.id === connection.id)) {
        return prev;
      }
      setAggregationRules(prevRules => [
        ...prevRules,
        {
          connectionId: connection.id,
          sourceColumnAggregation: 'sum',
          targetColumnAggregation: 'sum',
        }
      ]);
      return [...prev, connection];
    });
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(c => c.id !== connectionId));
    setAggregationRules(prevRules => prevRules.filter(r => r.connectionId !== connectionId));
  }, []);

  const updateAggregationRule = useCallback((ruleUpdate: Partial<AggregationRule> & { connectionId: string }) => {
    setAggregationRules(prevRules => {
      const ruleIndex = prevRules.findIndex(r => r.connectionId === ruleUpdate.connectionId);
      if (ruleIndex === -1) return prevRules;
      const newRules = [...prevRules];
      newRules[ruleIndex] = { ...newRules[ruleIndex], ...ruleUpdate };
      return newRules;
    });
  }, []);

  return {
    connections,
    aggregationRules,
    updateAggregationRule,
    addConnection,
    removeConnection,
  };
};
