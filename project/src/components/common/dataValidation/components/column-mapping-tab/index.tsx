import React, { useMemo } from 'react';
import { Column, ColumnMapping } from '@/types/dataValidation';
import useSourceNodes from '@/hooks/use-source-nodes';
import MappingView from './MappingView';

interface InputConnection {
  id: string;
  name: string;
  columns: Column[];
}

interface ColumnMappingTabProps {
  mappings: ColumnMapping[];
  onSetMappings: (mappings: ColumnMapping[]) => void;
  selectedSourceId: string | null;
  selectedTargetId: string | null;
  isReadOnly?: boolean;
}

const ColumnMappingTab: React.FC<ColumnMappingTabProps> = ({
  mappings,
  onSetMappings,
  selectedSourceId,
  selectedTargetId,
  isReadOnly = false,
}) => {
  const { sourceNodes } = useSourceNodes();

  const getNodeLabel = (node: any) =>
    node?.data?.display_name ||
    node?.data?.node?.title ||
    node?.data?.name ||
    node?.id ||
    'Unnamed Node';

  const getColumnsFromNode = (node: any): Column[] => {
    const columnNames = node.data?.node?.output?.columns || node.data?.columns || [];
    return columnNames.map((col: string, index: number) => ({
      id: `${node.id}_col_${index}`,
      name: col,
      type: 'VARCHAR'
    }));
  };

  const availableConnections: InputConnection[] = useMemo(() => sourceNodes.map(node => ({
    id: node.id,
    name: getNodeLabel(node),
    columns: getColumnsFromNode(node)
  })), [sourceNodes]);

  const dataSources = useMemo(() => {
    const sources = [];
    if (selectedSourceId) {
      const sourceConn = availableConnections.find(c => c.id === selectedSourceId);
      if (sourceConn) sources.push({ ...sourceConn, name: `Source: ${sourceConn.name}` });
    }
    if (selectedTargetId) {
      const targetConn = availableConnections.find(c => c.id === selectedTargetId);
      if (targetConn) sources.push({ ...targetConn, name: `Target: ${targetConn.name}` });
    }
    return sources;
  }, [selectedSourceId, selectedTargetId, availableConnections]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <MappingView
        dataSources={dataSources}
        mappings={mappings}
        onSetMappings={onSetMappings}
        viewType="column-mapping"
        isReadOnly={isReadOnly}
      />
    </div>
  );
};

export default ColumnMappingTab;
