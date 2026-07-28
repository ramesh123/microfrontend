import { useMemo } from "react";
import cloneDeep from "lodash/cloneDeep";
import NodeForm from "@/components/common/node-form";

export interface FuzzyMatchProps {
  nodeDetailsData: any;
  onClose: () => void;
  mode?: "view" | "edit";
}

/**
 * Fuzzy Match / intelligent deduplication: API marks `is_multiple_form: true` but this node
 * is a single logical configuration (not multi-row rules). Force single-row NodeForm and
 * flatten `payload.survivor_rules` so template fields `survivor_column` / `survivor_strategy`
 * hydrate correctly.
 */
export default function FuzzyMatch({
  nodeDetailsData,
  onClose,
  mode = "edit",
}: FuzzyMatchProps) {
  const nodeFormData = useMemo(() => {
    const d = cloneDeep(nodeDetailsData);
    if (!d?.data?.node) return d;

    d.data.is_multiple_form = false;

    const payload = d.data.node.payload as Record<string, unknown> | undefined;
    if (payload && payload.survivor_rules != null && typeof payload.survivor_rules === "object") {
      const sr = payload.survivor_rules as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(payload, "survivor_column")) {
        payload.survivor_column = sr.column ?? "";
      }
      if (!Object.prototype.hasOwnProperty.call(payload, "survivor_strategy")) {
        payload.survivor_strategy = sr.strategy ?? "";
      }
    }

    return d;
  }, [nodeDetailsData]);

  const disabled = mode === "view";

  return (
    <div className="flex flex-col gap-4 bg-background pt-0">
      <NodeForm
        template={nodeFormData?.data?.node?.template}
        onClose={onClose}
        nodeData={nodeFormData}
        saveApiEndpoint={nodeDetailsData?.data?.node?.save_node}
        disabled={disabled}
      />
    </div>
  );
}
