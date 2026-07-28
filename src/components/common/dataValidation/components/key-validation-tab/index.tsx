import React, { useMemo, useState, useCallback } from 'react';
import { Column, KeyValidationPair, InputConnection } from '@/types/dataValidation';
import useSourceNodes from '@/hooks/use-source-nodes';
import { MAPPING_COLORS } from '@/constants/constants';
import KeyValidationPairing from './components/key-validation-pairing';
import MappedKeys from './components/mapped-keys';

interface KeyValidationTabProps {
  pairs: KeyValidationPair[];
  onSetPairs: (pairs: KeyValidationPair[]) => void;
  selectedSourceId: string | null;
  selectedTargetId: string | null;
  isReadOnly?: boolean;
}

const KeyValidationTab: React.FC<KeyValidationTabProps> = ({
  pairs,
  onSetPairs,
  selectedSourceId,
  selectedTargetId,
  isReadOnly = false,
}) => {
  const { sourceNodes } = useSourceNodes();

  const [isEditing, setIsEditing] = useState(false);

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
      type: 'VARCHAR',
    }));
  };

  const availableConnections: InputConnection[] = useMemo(
    () =>
      sourceNodes.map((node) => ({
        id: node.id,
        name: getNodeLabel(node),
        columns: getColumnsFromNode(node),
      })),
    [sourceNodes],
  );

  const keyColumns = useMemo(() => {
    if (!selectedSourceId) return [];
    return availableConnections.find((c) => c.id === selectedSourceId)?.columns ?? [];
  }, [selectedSourceId, availableConnections]);

  const validationColumns = useMemo(() => {
    if (!selectedTargetId) return [];
    return availableConnections.find((c) => c.id === selectedTargetId)?.columns ?? [];
  }, [selectedTargetId, availableConnections]);

  const allColumns = useMemo(() => [...keyColumns, ...validationColumns], [keyColumns, validationColumns]);

  const initialKeyIds = useMemo(() => pairs.map((p) => p.keyColumn.id), [pairs]);
  const initialValidationIds = useMemo(() => pairs.map((p) => p.validationColumn.id), [pairs]);

  const hasConnections = Boolean(selectedSourceId && selectedTargetId);
  const pairingVisible = !isReadOnly && hasConnections && (pairs.length === 0 || isEditing);

  const handlePair = useCallback(
    (keyOrder: string[], validationOrder: string[]) => {
      const newPairs: KeyValidationPair[] = keyOrder.map((keyId, i) => {
        const keyCol = keyColumns.find((c) => c.id === keyId)!;
        const valCol = validationColumns.find((c) => c.id === validationOrder[i])!;
        return {
          id: `kv-${keyId}-${validationOrder[i]}`,
          keyColumn: keyCol,
          validationColumn: valCol,
          colorIndex: i % MAPPING_COLORS.length,
        };
      });
      onSetPairs(newPairs);
      setIsEditing(false);
    },
    [keyColumns, validationColumns, onSetPairs],
  );

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden scroll-py-2 [-webkit-overflow-scrolling:touch]">
        <div className="flex flex-col gap-3 pb-1 pt-0.5">
          {!hasConnections && (
            <p className="px-0.5 text-center text-sm text-muted-foreground">
              Select a source node and a target node above to choose key columns (source) and validation
              columns (target).
            </p>
          )}

          {pairingVisible && (
            <KeyValidationPairing
              allColumns={allColumns}
              keyColumnOptions={keyColumns}
              validationColumnOptions={validationColumns}
              initialKeyIds={isEditing ? initialKeyIds : []}
              initialValidationIds={isEditing ? initialValidationIds : []}
              onPair={handlePair}
              isEditing={isEditing}
            />
          )}

          <MappedKeys
            pairs={pairs}
            onRemovePair={(id) => onSetPairs(pairs.filter((p) => p.id !== id))}
            onEdit={() => setIsEditing(true)}
            isEditing={isEditing}
            pairingMode="key-validation"
            suppressEmptyState={pairingVisible}
            readOnly={isReadOnly}
          />
        </div>
      </div>
    </div>
  );
};

export default KeyValidationTab;
