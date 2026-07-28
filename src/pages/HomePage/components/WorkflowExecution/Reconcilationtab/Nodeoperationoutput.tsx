"use client";

import React, { useState, useEffect } from "react";
import { GripVertical, Pencil, Check, X, ArrowLeft } from "lucide-react";
import useFlowStore from "@/stores/flowStore";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableRow({ col, index, onEdit, onSave, onCancel, isEditing, editData, setEditData }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: col.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="cursor-move">
      {/* drag */}
      <TableCell className="w-5">
        <GripVertical {...attributes} {...listeners} className="text-gray-400" />
      </TableCell>

      {/* Column name */}
      <TableCell>
        <Badge variant="outline">{col.name}</Badge>
      </TableCell>

      {/* Display column */}
      <TableCell>
        <Input
          value={isEditing ? editData.displayColumn : col.displayColumn}
          disabled={!isEditing}
          onChange={(e) => setEditData({ ...editData, displayColumn: e.target.value })}
          className="h-8"
        />
      </TableCell>

      {/* Data type */}
      <TableCell>
        {isEditing ? (
          <Select
            value={editData.datatype}
            onValueChange={(v) => setEditData({ ...editData, datatype: v })}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {["string", "number", "boolean", "date","integer","float","timestamp","date","text","boolean"].map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary">{col.datatype}</Badge>
        )}
      </TableCell>

      {/* required */}
      <TableCell className="text-left">
        <Checkbox
          checked={isEditing ? editData.required : col.required}
          onCheckedChange={(v) => setEditData({ ...editData, required: v })}
          disabled={!isEditing}
        />
      </TableCell>

      {/* null value */}
      <TableCell>
        <Input
          disabled={!isEditing}
          placeholder=" Enter Null Value"
          value={isEditing ? editData.fillNullValue : col.fillNullValue}
          onChange={(e) => setEditData({ ...editData, fillNullValue: e.target.value })}
          className="h-8"
        />
      </TableCell>

      {/* actions */}
      <TableCell className="flex gap-2">
        {isEditing ? (
          <>
            <Button onClick={onSave} size="icon" variant="outline">
              <Check className="text-green-600" />
            </Button>
            <Button onClick={onCancel} size="icon" variant="outline">
              <X className="text-red-600" />
            </Button>
          </>
        ) : (
          <Button onClick={() => onEdit(col)} size="icon" variant="outline">
            <Pencil />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

// ----------------------
// MAIN SCREEN COMPONENT
// ----------------------
export default function Nodeoperationoutput() {
  const outputNode = useFlowStore((s) => s.outputNode);
  const navigate = useNavigate();


  if (!outputNode) return <div className="flex items-center gap-2">
    <Button variant="outline" className="!h-5 !w-7 !p-0 !gap-0 !border-none" onClick={() => navigate(-1)}>
      {/* <ArrowLeft className="!h-5 !w-9 !text-black" /> */}
    </Button>
    No output node found</div>;
// Try columns array → fallback to keys of first row → fallback empty
const rawColumns =
outputNode?.data?.node?.output?.columns ||
(Array.isArray(outputNode?.data?.node?.output?.data) &&
outputNode.data.node.output.data.length > 0
  ? Object.keys(outputNode.data.node.output.data[0])
  : []);

 
  // Convert raw columns → uniform shape
  const [columns, setColumns] = useState([]);
  useEffect(() => {
    const formatted = rawColumns.map((col) => ({
      name: typeof col === "string" ? col : col.name,
      datatype: typeof col === "object" ? col.type : "string",
      displayColumn: col.displayColumn || col.name || col,
      required: col.required ?? false,
      fillNullValue: col.fillNullValue ?? "",
    }));
    setColumns(formatted);
  }, [outputNode]); 

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = columns.findIndex((c) => c.name === active.id);
    const newIndex = columns.findIndex((c) => c.name === over.id);

    const updated = [...columns];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved);

    setColumns(updated);
  };

  // Editing
  const [editing, setEditing] = useState<string | null>(null);
  const [editData, setEditData] = useState({});

  const startEdit = (col) => {
    setEditing(col.name);
    setEditData({ ...col });
  };

  const saveEdit = () => {
    setColumns((prev) =>
      prev.map((c) => (c.name === editing ? { ...c, ...editData } : c))
    );
    setEditing(null);
  };

  return (
    <div className="p-0 w-full">
     <div className="mb-2 flex items-center justify-between w-full mt-1">
        {/* Left Section */}
        <div className="flex items-center gap-0">
        <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Output Node Columns:</h2>
            <Badge>Total Columns: {columns.length}</Badge>
            </div>
        </div>

        {/* Right - Back Button */}
        
        </div>


      <div className="border rounded-lg overflow-hidden h-[80vh] overflow-y-auto">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map((c) => c.name)} strategy={verticalListSortingStrategy} >
            <Table >
              <TableHeader className="sticky top-0 z-10 bg-white font-bold text-black-500">
                <TableRow >
                  <TableHead></TableHead>
                  <TableHead>Column</TableHead>
                  <TableHead>Display</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead>Null Value</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {columns.map((col, index) => (
                  <SortableRow
                    key={col.name}
                    col={col}
                    index={index}
                    isEditing={editing === col.name}
                    editData={editData}
                    setEditData={setEditData}
                    onEdit={startEdit}
                    onSave={saveEdit}
                    onCancel={() => setEditing(null)}
                  />
                ))}
              </TableBody>
            </Table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
