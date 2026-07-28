import React, { useState, useCallback } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Plus, Minus, GripVertical, Play } from "lucide-react";
import { cn } from '@/lib/utils';
import ShadTooltip from '@/components/common/shadTooltipComponent';
import { Info } from "lucide-react";
import useFlowStore from '@/stores/flowStore';
import { useNodeStore } from '@/stores/nodeStore';
import { saveNodeDetailsApi } from '@/controllers/API';
import useSourceNodes from '@/hooks/use-source-nodes';
import { toast } from 'sonner';
import useExecutionResultStore from '@/stores/executionResultStore';

interface FilterRow { 
  id: string;
  value: string;
  index: number;
}

interface ActionsButtons {
  add: boolean;
  delete: boolean;
  execute?: boolean;
}

interface InputFilterFormProps {
  name: string;
  displayName: string;
  placeholder?: string;
  required?: boolean;
  info?: string;
  value?: FilterRow[];
  position?: number;
  onChange: (filters: FilterRow[]) => void;
  className?: string;
  actionsButtons?: ActionsButtons;
}

const DRAG_TYPE = 'FILTER_ROW';

interface DraggableRowProps { 
  row: FilterRow;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, value: string) => void;
  onExecute: (index: number) => void;
  moveRow: (dragIndex: number, hoverIndex: number) => void;
  showDeleteButton?: boolean;
  showExecuteButton?: boolean
}

const DraggableRow: React.FC<DraggableRowProps> = ({
  row,
  index,
  onRemove,
  onUpdate,
  onExecute,
  moveRow,
  showDeleteButton = true,
  showExecuteButton = true
}) => {
  const [, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: DRAG_TYPE,
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveRow(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  const attachRef = (el: HTMLDivElement | null) => {
    if (el) {
      preview(drop(el));
    }
  };

  const attachDragRef = (el: HTMLDivElement | null) => {
    if (el) {
      drag(el);
    }
  };

  return ( 
    <div
      ref={attachRef}
      className="flex items-center gap-2 p-2 border border-gray-200 rounded-md bg-muted shadow-sm"
    >
      <div
        ref={attachDragRef}
        className="cursor-move text-muted-foreground hover:text-primary"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      
      <span className="text-sm font-medium text-muted-foreground">
        {index + 1}
      </span>
      
      <Input
        type="text"
        value={row.value}
        onChange={(e) => onUpdate(row.id, e.target.value)}
        placeholder="Enter filter"
        className="flex-1 p-2 rounded-sm text-sm outline-none bg-muted text-muted-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[1px]"
      />
      
      {/* {showDeleteButton && ( */}
        <Button
          type="button"
          variant="outline"
          size="iconMd"
          onClick={() => onRemove(row.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Minus className="h-4 w-4" />
        </Button>
      {/* )} */}

      {
        showExecuteButton && (
          <Button
          type="button"
          variant="outline"
          size="iconMd"
          onClick={() => onExecute(row.index)}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Play className="h-4 w-4" />
        </Button>
        )
      }
    </div>
  );
};

const InputFilterForm: React.FC<InputFilterFormProps> = ({
  name,
  displayName,
  placeholder = "Enter filter value",
  required = false,
  info,
  value,
  position,
  onChange,
  className,
  actionsButtons = { add: true, delete: true, execute: true }
}) => {


  console.log('-----------value-------->', value);
  let selectedNode = useNodeStore((state) => state.selectedNode);
  const {sourceNodes}: any = useSourceNodes();
  const setResult = useExecutionResultStore((state) => state.setResult);

  const [rows, setRows] = useState<FilterRow[]>(() => {
    return Array.isArray(value) ? value : [];
  });

  React.useEffect(() => {
    if (Array.isArray(value)) {
      setRows(value);
    }
  }, [value]);

  const generateId = () => `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addRow = useCallback(() => {
    const newRow: FilterRow = {
      id: generateId(),
      value: '',
      index: rows.length
    };
    const updatedRows = [...rows, newRow];
    setRows(updatedRows);
    onChange(updatedRows);
  }, [rows, onChange]);

  const removeRow = useCallback((id: string) => {
    const updatedRows = rows.filter(row => row.id !== id).map((row, index) => ({
      ...row,
      index
    }));
    setRows(updatedRows);
    onChange(updatedRows);
  }, [rows, onChange]);

  const updateRow = useCallback((id: string, newValue: string) => {
    const updatedRows = rows.map(row =>
      row.id === id ? { ...row, value: newValue } : row
    );
    setRows(updatedRows);
    onChange(updatedRows);
  }, [rows, onChange]);

  const moveRow = useCallback((dragIndex: number, hoverIndex: number) => {
    const draggedRow = rows[dragIndex];
    const updatedRows = [...rows];
    updatedRows.splice(dragIndex, 1);
    updatedRows.splice(hoverIndex, 0, draggedRow);

    const reindexedRows = updatedRows.map((row, index) => ({
      ...row,
      index
    }));
    
    setRows(reindexedRows);
    onChange(reindexedRows);
  }, [rows, onChange]);

  async function executeRow(index: number): Promise<void> {
    const row = rows[index];
    console.log('row', row);
    const nodes = useFlowStore.getState().currentWorkflow?.data?.nodes;
    const currentWorkflow = useFlowStore.getState().currentWorkflow;
    const currentNode: any = nodes.find((node: any) => node.id === selectedNode?.id);
    console.log('currentNode', currentNode);

    let payload = currentNode?.data?.node?.payload || {};
    payload = {
      ...payload,
      manual_filter: "",
      filter_conditions: [row.value],
      dataframe: JSON.stringify(sourceNodes[0]?.data?.node?.output?.data),
      current_node_id: currentNode?.id,
      flow_id: currentWorkflow?.flow_id || currentNode?.data?.flow_id,
      response_type: "json",
    };
    console.log('selectedNode', selectedNode);
    const response = await saveNodeDetailsApi(currentNode?.data?.node?.execute_node, {"payload": payload});
    if(response?.status){
      toast.success("Filter executed successfully");
      setResult({
        id: currentNode?.id,
        columns: response?.columns,
        data: response?.data,
        execution_time: response?.execution_time,
        message: response?.message,
        status: response?.status,
      });
    } else {
      toast.error("Filter execution failed");
    }
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className={cn("space-y-4", className)}>
        <div className="flex gap-3">
          <div className="flex items-center gap-1">
            <Label 
              htmlFor={name} 
              className="text-sm font-medium text-gray-700 inline-flex items-center gap-1"
            >
              {displayName} {required && <span className="text-red-600">*</span>}
            </Label>
            {info && (
              <ShadTooltip content={info}>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </ShadTooltip>
            )}
          </div>
          
          {actionsButtons.add && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRow}
              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <DraggableRow
                key={row.index}
                row={row}
                index={index}
                onRemove={removeRow}
                onUpdate={updateRow}
                onExecute={() => executeRow(row.index)}
                moveRow={moveRow}
                showDeleteButton={actionsButtons.delete}
                showExecuteButton={actionsButtons.execute}
              />
            ))}
          </div>
        )}

        {rows.length === 0 && actionsButtons.add && (
          <div className="text-sm text-gray-500 italic">
            Click the "+" button to add filter values
          </div>
        )}

        {rows.length === 0 && !actionsButtons.add && (
          <div className="text-sm text-gray-500 italic">
            No filter values configured
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default InputFilterForm;