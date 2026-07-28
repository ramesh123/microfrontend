import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import cloneDeep from "lodash/cloneDeep";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import NodeForm from "@/components/common/node-form";
import useFlowStore from "@/stores/flowStore";
import { saveNodeDetailsApi } from "@/controllers/API";
import {
  getUpstreamDisplayNameForPayload,
  shouldBuildKeyedDataframeForExcelWrite,
} from "@/utils/transformTemplate";
import type { FormValue } from "@/types/form";
import MaskingRulesSummary from "./MaskingRulesSummary";
import MaskingRuleEditor from "./MaskingRuleEditor";
import {
  getMaskingRuleFieldTemplates,
  getMaskingTopLevelFieldTemplates,
  normalizeMaskingRulesFromPayload,
  readMaskingTopLevelFromPayload,
  type MaskingRule,
} from "./maskingUtils";
import DynamicFieldRenderer from "@/components/common/dynamic-field-render";

export interface MaskingProps {
  nodeDetailsData: any;
  onClose: () => void;
  mode?: "view" | "edit";
}

function attachUpstreamDataframe(
  payload: Record<string, unknown>,
  nodeId: string | undefined,
  sourceNodes: unknown[]
) {
  if (!Object.prototype.hasOwnProperty.call(payload, "dataframe")) return;
  if (payload.dataframe === false) return;
  const upstream = Array.isArray(sourceNodes) ? sourceNodes : [];
  const modeVal = payload.mode;
  if (shouldBuildKeyedDataframeForExcelWrite(nodeId, modeVal, upstream.length)) {
    const keyed: Record<string, string> = {};
    for (const sn of upstream) {
      const label = getUpstreamDisplayNameForPayload(sn);
      const df = (sn as { data?: { node?: { output?: { data?: unknown } } } })?.data
        ?.node?.output?.data;
      keyed[label] = JSON.stringify(df ?? []);
    }
    payload.dataframe = keyed;
  } else {
    const dataframe = (
      upstream[0] as { data?: { node?: { output?: { data?: unknown } } } }
    )?.data?.node?.output?.data;
    payload.dataframe = JSON.stringify(dataframe ?? []);
  }
}

/**
 * Data Masking: first-time setup via NodeForm; after save/execute, summary table
 * with inline rule editor (like the design reference).
 */
export default function Masking({
  nodeDetailsData,
  onClose,
  mode = "edit",
}: MaskingProps) {
  const { id: routeFlowId } = useParams();
  const disabled = mode === "view";
  const selectedNode = useFlowStore((s) => s.getSelectedNode());

  const nodeFormData = useMemo(() => {
    const d = cloneDeep(nodeDetailsData);
    if (!d?.data) return d;
    d.data.is_multiple_form = false;
    return d;
  }, [nodeDetailsData]);

  const template = nodeFormData?.data?.node?.template as
    | Record<string, unknown>
    | undefined;
  const saveApiEndpoint = nodeDetailsData?.data?.node?.save_node;

  const ruleFields = useMemo(
    () => getMaskingRuleFieldTemplates(template),
    [template]
  );
  const topLevelFields = useMemo(
    () => getMaskingTopLevelFieldTemplates(template),
    [template]
  );

  const [rules, setRules] = useState<MaskingRule[]>([]);
  const [topLevel, setTopLevel] = useState<Record<string, FormValue>>({});
  const [editingIndex, setEditingIndex] = useState<number | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const migratedPayloadRef = useRef(false);

  const hydrateFromStore = useCallback(() => {
    const layer = selectedNode?.data ?? nodeDetailsData?.data;
    const payload = layer?.node?.payload as Record<string, unknown> | undefined;
    setRules(normalizeMaskingRulesFromPayload(payload, template));
    setTopLevel(readMaskingTopLevelFromPayload(payload, template));
  }, [selectedNode?.data, nodeDetailsData?.data, template]);

  useEffect(() => {
    hydrateFromStore();
  }, [hydrateFromStore, nodeDetailsData?.id, selectedNode?.id]);

  const savedNode = Boolean(
    nodeDetailsData?.data?.saved_node ?? selectedNode?.data?.saved_node
  );

  const hasExecutionOutput = useMemo(() => {
    const output = selectedNode?.data?.node?.output;
    if (!output) return false;
    if (Array.isArray(output.data) && output.data.length > 0) return true;
    if (output.data && typeof output.data === "object" && !Array.isArray(output.data)) {
      return Object.keys(output.data as object).length > 0;
    }
    return Boolean(output.columns?.length);
  }, [selectedNode?.data?.node?.output]);

  const showSummaryView = savedNode || hasExecutionOutput;

  const handleTopLevelChange = (key: string, value: FormValue) => {
    setTopLevel((prev) => ({ ...prev, [key]: value }));
  };

  const persistMaskingConfig = useCallback(async (nextRules: MaskingRule[]) => {
    if (disabled) return;
    if (!saveApiEndpoint) {
      toast.warning("Missing API endpoint for saving.");
      return;
    }
    if (nextRules.length === 0) {
      toast.info("Add at least one masking rule before saving.");
      return;
    }

    const liveSelected = useFlowStore.getState().getSelectedNode();
    const updated = cloneDeep(liveSelected ?? { data: nodeDetailsData?.data });
    if (!updated?.data?.node) {
      toast.error("No node selected.");
      return;
    }

    const payload = {
      ...(updated.data.node.payload as Record<string, unknown>),
    };

    for (const f of ruleFields) {
      delete payload[f.key];
    }

    payload.masking_rules = nextRules;
    payload.key = payload.key ?? "on-submit";
    payload.actions = payload.actions ?? "masking";
    if (!payload.response_type) payload.response_type = "json";

    for (const f of topLevelFields) {
      if (topLevel[f.key] !== undefined) {
        payload[f.key] = topLevel[f.key];
      }
    }

    const sourceNodes = liveSelected?.id
      ? useFlowStore.getState().getUpstreamNodes(liveSelected.id)
      : [];
    attachUpstreamDataframe(
      payload,
      updated.data.node_id as string | undefined,
      sourceNodes
    );

    updated.data.node.payload = payload;

    const body = {
      ...updated.data,
      flow_id: useFlowStore.getState().currentWorkflow?.flow_id || routeFlowId,
      current_node_id: liveSelected?.id,
      node: updated.data.node,
    };

    setSaving(true);
    try {
      const response = await saveNodeDetailsApi(saveApiEndpoint, body);
      const merged = {
        ...response,
        node: {
          ...response.node,
          payload,
          template: updated.data.node.template,
        },
        saved_node: true,
      };
      useFlowStore.getState().updateNodeData(liveSelected!.id, merged);
      setRules(nextRules);
      toast.success("Masking configuration saved.");
    } catch {
      toast.error("Failed to save masking configuration.");
    } finally {
      setSaving(false);
    }
  }, [
    disabled,
    saveApiEndpoint,
    nodeDetailsData?.data,
    ruleFields,
    topLevelFields,
    topLevel,
    routeFlowId,
  ]);

  useEffect(() => {
    if (!showSummaryView || migratedPayloadRef.current || disabled) return;
    const layer = selectedNode?.data ?? nodeDetailsData?.data;
    const payload = layer?.node?.payload as Record<string, unknown> | undefined;
    const existing = payload?.masking_rules;
    const hasPersistedRules =
      Array.isArray(existing) &&
      existing.length > 0 &&
      existing.some(
        (r) =>
          r &&
          typeof r === "object" &&
          Object.values(r as Record<string, unknown>).some(
            (v) => v !== "" && v != null && !/^{{[\s\S]+}}$/.test(String(v).trim())
          )
      );
    if (hasPersistedRules) return;

    const migrated = normalizeMaskingRulesFromPayload(payload, template);
    if (migrated.length === 0) return;
    migratedPayloadRef.current = true;
    setRules(migrated);
    void persistMaskingConfig(migrated);
  }, [
    showSummaryView,
    disabled,
    selectedNode?.id,
    nodeDetailsData?.id,
    template,
    persistMaskingConfig,
    selectedNode?.data,
    nodeDetailsData?.data,
  ]);

  const handleApplyRule = (rule: MaskingRule) => {
    let next: MaskingRule[];
    if (editingIndex === "new") {
      next = [...rules, rule];
    } else if (typeof editingIndex === "number") {
      next = rules.map((r, i) => (i === editingIndex ? rule : r));
    } else {
      return;
    }
    setEditingIndex(null);
    void persistMaskingConfig(next);
  };

  const handleDeleteRule = (index: number) => {
    const next = rules.filter((_, i) => i !== index);
    setEditingIndex(null);
    void persistMaskingConfig(next);
  };

  if (!showSummaryView) {
    return (
      <div className="flex flex-col gap-4 bg-background pt-0">
        <NodeForm
          template={nodeFormData?.data?.node?.template}
          onClose={onClose}
          nodeData={nodeFormData}
          saveApiEndpoint={saveApiEndpoint}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 bg-background pt-0 pb-4">
      {topLevelFields.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {topLevelFields.map((field) => (
            <DynamicFieldRenderer
              key={field.key}
              field={field}
              value={topLevel[field.key] ?? ""}
              onChange={handleTopLevelChange}
              allFormValues={topLevel}
              compact
            />
          ))}
        </div>
      )}

      <MaskingRulesSummary
        rules={rules}
        disabled={disabled || saving}
        editingIndex={editingIndex}
        onAddRule={() => setEditingIndex("new")}
        onEditRule={(index) => setEditingIndex(index)}
        onDeleteRule={handleDeleteRule}
      />

      {editingIndex !== null && (
        <MaskingRuleEditor
          title={
            editingIndex === "new"
              ? "New masking rule"
              : `Edit masking rule ${editingIndex + 1}`
          }
          ruleFields={ruleFields}
          initialRule={
            editingIndex === "new" ? {} : (rules[editingIndex] ?? {})
          }
          topLevelValues={topLevel}
          template={template ?? {}}
          disabled={disabled || saving}
          onCancel={() => setEditingIndex(null)}
          onSave={handleApplyRule}
        />
      )}

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || saving || editingIndex !== null}
          onClick={() => void persistMaskingConfig(rules)}
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
