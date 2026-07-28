import { memo, useCallback, useMemo, type CSSProperties, type MouseEvent } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  RULE_CHAIN_EDGE_LABEL_MIN_ZOOM,
  RULE_CHAIN_EDGE_SELECTED_STROKE,
  RULE_CHAIN_EDGE_STROKE,
  ruleChainEdgeBezierCurvature,
} from "../rule-node/ruleChainCanvasLogic";
import { combineRelationLabels } from "../rule-node/ruleChainRelationLabels";
import { useRuleChainEdgeActions } from "./RuleChainEdgeActionsContext";

/** Offset edit/delete controls below the on-wire label when the edge is selected. */
const RULE_CHAIN_EDGE_ACTIONS_OFFSET_Y = 28;

/**
 * ThingsBoard-like edge: relation label chip at the path midpoint; delete control offset below when selected.
 */
function RuleChainDeletableEdgeComponent(props: EdgeProps) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style: initialStyle = {},
    selected,
    data,
  } = props;
  const zoom = useStore((s) => s.transform[2]);
  const showRelationLabel = zoom >= RULE_CHAIN_EDGE_LABEL_MIN_ZOOM;

  const curvature = useStore(
    useCallback(
      (s) => {
        const fromSource = [...s.edgeLookup.values()]
          .filter((e) => e.source === source)
          .map((e) => ({ id: e.id, target: e.target }));
        const samePair = fromSource.filter((e) => e.target === target);
        const fanGroup = samePair.length > 1 ? samePair : fromSource;
        return ruleChainEdgeBezierCurvature(source, id, fanGroup);
      },
      [id, source, target],
    ),
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });

  /** Keep pill on the visible wire (horizontal links: centerline, not bezier apex). */
  const labelOnWire = useMemo(() => {
    const dy = Math.abs(sourceY - targetY);
    const y = dy < 14 ? (sourceY + targetY) / 2 : labelY;
    return { x: labelX, y };
  }, [labelX, labelY, sourceY, targetY]);
  const { relationLabel, showCombinedLabel } = useStore(
    useCallback(
      (s) => {
        const samePair = [...s.edgeLookup.values()].filter((e) => e.source === source && e.target === target);
        const sorted = [...samePair].sort((a, b) => a.id.localeCompare(b.id));
        const isPrimary = sorted[0]?.id === id;
        const labels = samePair
          .map((e) => (e.data as { relationType?: string } | undefined)?.relationType)
          .filter((x): x is string => typeof x === "string" && Boolean(x.trim()));
        const combined = combineRelationLabels(labels);
        const single = (data as { relationType?: string } | undefined)?.relationType?.trim() ?? "";
        return {
          showCombinedLabel: isPrimary,
          relationLabel: samePair.length > 1 ? combined : combineRelationLabels(single ? [single] : []),
        };
      },
      [data, id, source, target],
    ),
  );
  const { setEdges } = useReactFlow();
  const edgeActions = useRuleChainEdgeActions();

  const baseStrokeColor = useMemo(() => {
    const st = initialStyle.stroke;
    if (typeof st === "string" && st.trim()) return st;
    return RULE_CHAIN_EDGE_STROKE;
  }, [initialStyle.stroke]);

  const strokeColor = selected ? RULE_CHAIN_EDGE_SELECTED_STROKE : baseStrokeColor;

  const resolvedMarkerEnd = useMemo((): EdgeProps["markerEnd"] => {
    if (markerEnd == null) return undefined;
    if (typeof markerEnd === "string") return markerEnd;
    if (typeof markerEnd === "object" && !Array.isArray(markerEnd) && "type" in markerEnd) {
      return { ...(markerEnd as object), color: strokeColor } as unknown as EdgeProps["markerEnd"];
    }
    return markerEnd as EdgeProps["markerEnd"];
  }, [markerEnd, strokeColor]);

  const onRemove = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      setEdges((eds) => eds.filter((edge) => edge.id !== id));
    },
    [id, setEdges],
  );

  const onEdit = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      edgeActions?.onEditEdge(id);
    },
    [edgeActions, id],
  );

  const edgeStyle = useMemo(() => {
    const w = initialStyle.strokeWidth;
    const numeric = typeof w === "number" ? w : typeof w === "string" ? Number.parseFloat(w) : Number.NaN;
    const baseW = Number.isFinite(numeric) ? numeric : 1.5;
    const base: CSSProperties = {
      ...initialStyle,
      stroke: strokeColor,
      strokeWidth: selected ? Math.max(2.5, baseW) : baseW,
      transition: "stroke 0.15s ease, stroke-width 0.15s ease, filter 0.15s ease",
    };
    if (selected) {
      return {
        ...base,
        filter: "drop-shadow(0 0 5px rgba(229, 57, 53, 0.45))",
      };
    }
    return base;
  }, [initialStyle, selected, strokeColor]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={resolvedMarkerEnd}
        style={edgeStyle}
        interactionWidth={24}
        className={selected ? "rule-chain-edge-selected" : undefined}
      />
      <EdgeLabelRenderer>
        {showRelationLabel && showCombinedLabel ? (
          <div
            className="nodrag nopan pointer-events-none rule-chain-edge-label-wrap"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${labelOnWire.x}px, ${labelOnWire.y}px) translate(-50%, -50%)`,
            }}
          >
            <span className="rule-chain-edge-relation-badge" title={relationLabel}>
              {relationLabel}
            </span>
          </div>
        ) : null}
        <div
          className="rule-chain-edge-actions nodrag nopan flex flex-row items-center justify-center gap-1.5"
          style={{
            position: "absolute",
            transform: `translate(${labelOnWire.x}px, ${labelOnWire.y + (selected ? RULE_CHAIN_EDGE_ACTIONS_OFFSET_Y : 0)}px) translate(-50%, -50%)`,
            pointerEvents: selected ? "all" : "none",
          }}
        >
          {selected ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rule-chain-edge-action-btn h-7 w-7 rounded-full border-0 bg-[#e53935] text-white shadow-md hover:bg-[#c62828] hover:text-white"
                title="Edit link type"
                onClick={onEdit}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Pencil className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rule-chain-edge-action-btn h-7 w-7 rounded-full border-0 bg-[#e53935] text-white shadow-md hover:bg-[#c62828] hover:text-white"
                title="Remove connection"
                onClick={onRemove}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3.5 w-3.5 text-white" strokeWidth={2.25} aria-hidden />
              </Button>
            </>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RuleChainDeletableEdge = memo(RuleChainDeletableEdgeComponent);
