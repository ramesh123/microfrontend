import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { MaskingRule } from "./maskingUtils";
import { formatAlgorithmLabel, formatRuleCell } from "./maskingUtils";

/** ~5 table body rows visible before vertical scroll (header stays sticky). */
const TABLE_SCROLL_MAX_ROWS = 5;
const TABLE_BODY_ROW_HEIGHT_PX = 49;
const TABLE_HEADER_HEIGHT_PX = 41;
const tableScrollMaxHeight =
  TABLE_HEADER_HEIGHT_PX + TABLE_BODY_ROW_HEIGHT_PX * TABLE_SCROLL_MAX_ROWS;

type MaskingRulesSummaryProps = {
  rules: MaskingRule[];
  disabled?: boolean;
  editingIndex: number | "new" | null;
  onAddRule: () => void;
  onEditRule: (index: number) => void;
  onDeleteRule: (index: number) => void;
};

export default function MaskingRulesSummary({
  rules,
  disabled = false,
  editingIndex,
  onAddRule,
  onEditRule,
  onDeleteRule,
}: MaskingRulesSummaryProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            Masking Rules Summary
          </h3>
          <Badge variant="secondary" className="font-normal">
            {rules.length} {rules.length === 1 ? "Rule" : "Rules"}
          </Badge>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={disabled || editingIndex === "new"}
          onClick={onAddRule}
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <div
        className={cn(
          "relative w-full overflow-x-auto",
          rules.length > TABLE_SCROLL_MAX_ROWS &&
            "overflow-y-auto border-t border-border/60"
        )}
        style={
          rules.length > TABLE_SCROLL_MAX_ROWS
            ? { maxHeight: tableScrollMaxHeight }
            : undefined
        }
        role={rules.length > TABLE_SCROLL_MAX_ROWS ? "region" : undefined}
        aria-label={
          rules.length > TABLE_SCROLL_MAX_ROWS ? "Masking rules table" : undefined
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="sticky top-0 z-10 w-12 bg-card">S.No</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card">Column</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card">
                Masking Algorithm
              </TableHead>
              <TableHead className="sticky top-0 z-10 bg-card">Masking Type</TableHead>
              <TableHead className="sticky top-0 z-10 bg-card">
                Masking Character
              </TableHead>
              <TableHead className="sticky top-0 z-10 w-28 bg-card text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {rules.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No masking rules yet. Click &quot;Add Rule&quot; to create one.
              </TableCell>
            </TableRow>
          ) : (
            rules.map((rule, index) => (
              <TableRow
                key={`masking-rule-${index}`}
                className={editingIndex === index ? "bg-muted/40" : undefined}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell>{formatRuleCell(rule.column)}</TableCell>
                <TableCell>
                  {formatAlgorithmLabel(
                    rule.masking_algorithm ?? rule.algorithm
                  )}
                </TableCell>
                <TableCell>{formatRuleCell(rule.masking_type)}</TableCell>
                <TableCell>{formatRuleCell(rule.masking_char)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={disabled}
                      onClick={() => onEditRule(index)}
                      title="Edit rule"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      disabled={disabled || rules.length <= 1}
                      onClick={() => onDeleteRule(index)}
                      title="Delete rule"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
