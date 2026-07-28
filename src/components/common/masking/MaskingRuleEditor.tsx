import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import DynamicFieldRenderer from "@/components/common/dynamic-field-render";
import type { FieldTemplate, FormSubmissionData, FormValue } from "@/types/form";
import type { MaskingRule } from "./maskingUtils";
import { buildMaskingRowTemplate } from "./maskingUtils";

type MaskingRuleEditorProps = {
  title: string;
  ruleFields: FieldTemplate[];
  initialRule: MaskingRule;
  topLevelValues?: Record<string, FormValue>;
  template: Record<string, unknown>;
  disabled?: boolean;
  onCancel: () => void;
  onSave: (rule: MaskingRule) => void;
};

export default function MaskingRuleEditor({
  title,
  ruleFields,
  initialRule,
  topLevelValues = {},
  template,
  disabled = false,
  onCancel,
  onSave,
}: MaskingRuleEditorProps) {
  const rowTemplate = useMemo(
    () => buildMaskingRowTemplate(template),
    [template]
  );

  const [rule, setRule] = useState<MaskingRule>(() => ({
    ...rowTemplate,
    ...initialRule,
  }));

  const allFormValues = useMemo(
    () => ({ ...topLevelValues, ...rule }) as FormSubmissionData,
    [topLevelValues, rule]
  );

  const handleChange = (key: string, value: FormValue) => {
    setRule((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="rounded-lg border border-border bg-muted/15 p-4 space-y-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {ruleFields.map((field) => (
          <DynamicFieldRenderer
            key={field.key}
            field={field}
            value={rule[field.key] ?? ""}
            onChange={handleChange}
            allFormValues={allFormValues}
            compact
          />
        ))}
      </div>
      <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onSave(rule)}
        >
          Apply rule
        </Button>
      </div>
    </div>
  );
}
