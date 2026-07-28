import { createElement, useCallback, useState, type ReactNode } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import type { Field } from "@/pages/charts/components/ChartConfigurator";
import { extractColumnName } from "@/pages/charts/ChartFormulator/utils";
import ChartFormDragPreview from "./ChartFormDragPreview";

interface UseChartFormDragDropOptions {
  chartFormData?: { parameters?: Array<{ key: string; type?: string; label?: string }> } | null;
  fields: Field[];
}

export interface UseChartFormDragDropResult {
  activeId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  getActiveDraggable: () => ReactNode;
}

export function useChartFormDragDrop({
  chartFormData,
  fields,
}: UseChartFormDragDropOptions): UseChartFormDragDropResult {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    if (typeof window !== "undefined") {
      (window as unknown as { ___dndActiveField?: unknown }).___dndActiveField =
        event.active.data?.current?.field || event.active.data?.current;
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      if (typeof window !== "undefined") {
        (window as unknown as { ___dndActiveField?: unknown }).___dndActiveField = undefined;
      }

      const { active, over } = event;
      if (!over || !chartFormData?.parameters || active.data.current?.type !== "field") {
        return;
      }

      const fieldData = active.data.current.field as unknown;
      let fieldName: string;
      let fieldType: string;

      if (typeof fieldData === "string") {
        fieldName = fieldData;
        fieldType = "string";
      } else if (fieldData && typeof fieldData === "object") {
        const obj = fieldData as Record<string, unknown>;
        fieldName = String(obj.name || obj.field || obj.columns || fieldData);
        fieldType = String(obj.type || "string");
      } else {
        fieldName = String(fieldData);
        fieldType = "string";
      }

      const field: Field = { name: fieldName, type: fieldType };
      const dropZoneId = over.id.toString();
      const params = chartFormData.parameters;
      const normalizedId = dropZoneId.toLowerCase();
      const baseKey = dropZoneId.replace(/_\d+$/, "");
      const normalizedBase = baseKey.toLowerCase();

      let targetKey: string | null = params.find((p) => p.key === dropZoneId)?.key || null;
      if (!targetKey) targetKey = params.find((p) => p.key === baseKey)?.key || null;
      if (!targetKey) {
        const byLabel = params.find(
          (p) =>
            (p.label || "").toLowerCase().includes(normalizedId) ||
            (p.label || "").toLowerCase().includes(normalizedBase),
        );
        if (byLabel?.key) targetKey = byLabel.key;
      }
      if (!targetKey) {
        const preferred = ["dimensions", "metrics", "filters", "x-axis"];
        const found = preferred.find((k) => params.some((p) => p.key.toLowerCase() === k));
        if (found) targetKey = params.find((p) => p.key.toLowerCase() === found)!.key;
      }
      if (!targetKey) {
        const multi = params.find((p) => String(p.type).includes("drag_and_drop_or_select_multiple"));
        if (multi?.key) targetKey = multi.key;
      }

      if (!targetKey) return;

      const existingValues =
        (window as unknown as { __chartFormValues?: Record<string, unknown> }).__chartFormValues || {};
      const droppedColumnName = extractColumnName(fieldData);
      const normDropped = (droppedColumnName || "").toString().toLowerCase();
      const isTargetXAxis =
        (targetKey || "").toLowerCase().includes("x-axis") ||
        (targetKey || "").toLowerCase() === "xaxis" ||
        (targetKey || "").toLowerCase() === "x";
      const isTargetDimensions =
        (targetKey || "").toLowerCase().includes("dimension") ||
        (targetKey || "").toLowerCase() === "dimensions";

      const dims = existingValues.dimensions || existingValues.dimension || [];
      const dimsArr = Array.isArray(dims) ? dims : dims ? [dims] : [];
      const dimsNormalized = dimsArr.map((d) => String(extractColumnName(d) || "").toLowerCase());
      const xAxisVal = existingValues["x-axis"] || existingValues["X-axis"] || existingValues.x || null;
      const xAxisName = extractColumnName(Array.isArray(xAxisVal) ? xAxisVal[0] : xAxisVal);

      if (isTargetXAxis && normDropped && dimsNormalized.includes(normDropped)) {
        toast.info("This column is already used as a dimension.");
        return;
      }
      if (isTargetDimensions && normDropped && xAxisName && String(xAxisName).toLowerCase() === normDropped) {
        toast.info("This column is already used as the X-axis.");
        return;
      }

      const updater = (window as unknown as { __chartFormUpdate?: (key: string, value: Field) => void })
        .__chartFormUpdate;
      if (updater) {
        updater(targetKey, field);
      }
    },
    [chartFormData],
  );

  const getActiveDraggable = useCallback((): ReactNode => {
    if (!activeId?.toString().startsWith("field-")) {
      return null;
    }

    const payloadField = (window as unknown as { ___dndActiveField?: Field }).___dndActiveField;
    const idRest = activeId.toString().slice("field-".length);
    const parts = idRest.split("-");
    const fieldName = parts.length > 1 ? parts[parts.length - 1] : idRest;
    const field = payloadField || fields.find((f) => f.name === fieldName);
    if (!field) return null;

    return createElement(ChartFormDragPreview, { field });
  }, [activeId, fields]);

  return {
    activeId,
    handleDragStart,
    handleDragEnd,
    getActiveDraggable,
  };
}
