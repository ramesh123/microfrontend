import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type Aggregation,
  type Cardinality,
  type ChartDefault,
  type ColumnSemanticMapping,
  type DatasetSemanticMappings,
  type DateGrain,
  type SemanticRole,
  AGGREGATION_OPTIONS,
  CHART_DEFAULT_OPTIONS,
  GRAIN_OPTIONS,
  ROLE_OPTIONS,
  inferSemanticMappings,
  normalizeSemanticMappings,
} from "./semanticMapping";

interface Step5ChartColumnsProps {
  propertiesData: any[];
  initialData: DatasetSemanticMappings | null;
  onSemanticMappingsChange: (data: DatasetSemanticMappings) => void;
  onBack: () => void;
  onSave?: () => Promise<void>;
  onAddToTable?: (config: Record<string, any>, properties?: any[], nodeDetails?: any) => void;
  configurationData?: Record<string, any>;
  nodeDetails?: any;
  isVirtualEditMode?: boolean;
  isEditing: boolean;
}

function formatTypeLabel(type: string) {
  const labels: Record<string, string> = {
    str: "String",
    int: "Integer",
    float: "Float",
    datetime: "Datetime",
    date: "Date",
    timestamp: "Timestamp",
    bool: "Boolean",
    jsonb: "JSON",
    object: "Object",
    array: "Array",
  };
  return labels[type] || type;
}

const SELECT_VALUE_TRIGGER_CLASS = "!h-7 w-full bg-background text-xs font-medium [&_span]:font-medium";

function updateMapping(
  mappings: ColumnSemanticMapping[],
  column: string,
  patch: Partial<ColumnSemanticMapping>,
): ColumnSemanticMapping[] {
  return mappings.map((mapping) =>
    mapping.column === column
      ? {
          ...mapping,
          ...patch,
        }
      : mapping,
  );
}

export default function Step5ChartColumns({
  propertiesData,
  initialData,
  onSemanticMappingsChange,
  onBack,
  onSave,
  onAddToTable,
  configurationData,
  nodeDetails,
  isVirtualEditMode = false,
  isEditing,
}: Step5ChartColumnsProps) {
  const location = useLocation();
  const isVirtualDb = /virtual[- ]?db/i.test(location.pathname);
  const [isSaving, setIsSaving] = useState(false);

  const availableProperties = useMemo(
    () => (propertiesData || []).filter((property) => property.isSelected !== false && property.name),
    [propertiesData],
  );

  const [mappings, setMappings] = useState<ColumnSemanticMapping[]>(() => {
    if (initialData?.columns?.length) {
      return normalizeSemanticMappings(initialData, availableProperties);
    }
    return inferSemanticMappings(availableProperties);
  });

  const onSemanticMappingsChangeRef = useRef(onSemanticMappingsChange);
  onSemanticMappingsChangeRef.current = onSemanticMappingsChange;

  useEffect(() => {
    onSemanticMappingsChangeRef.current({ columns: mappings });
  }, [mappings]);

  const handleRoleChange = (column: string, role: SemanticRole) => {
    setMappings((current) =>
      updateMapping(current, column, {
        role,
        grain: role === "date_time" ? "month" : undefined,
        primary: role === "date_time" ? false : undefined,
        cardinality: role === "dimension" ? "medium" : undefined,
        aggregation: role === "measure" ? "sum" : undefined,
        chartDefault:
          role === "identifier"
            ? "not_used"
            : role === "measure"
              ? "y_axis"
              : role === "date_time"
                ? "x_axis"
                : "group_by",
      }),
    );
  };

  const handleReset = () => {
    setMappings(inferSemanticMappings(availableProperties));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isVirtualDb && onAddToTable) {
        onAddToTable(
          {
            ...(configurationData || {}),
            semantic_mappings: { columns: mappings },
          },
          propertiesData || [],
          nodeDetails,
        );
        toast.success(isVirtualEditMode ? "Data updated successfully" : "Data added to table successfully");
        return;
      }

      if (onSave) await onSave();
    } catch (error) {
      console.error("Save operation failed:", error);
      setIsSaving(false);
    }
  };

  const renderConfigCell = (mapping: ColumnSemanticMapping) => {
    if (mapping.role === "date_time") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium">Grain</span>
            <Select
              value={mapping.grain || "month"}
              onValueChange={(value: DateGrain) =>
                setMappings((current) => updateMapping(current, mapping.column, { grain: value }))
              }
            >
              <SelectTrigger className="!h-7 w-[110px] bg-background text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRAIN_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-1.5 text-xs font-medium">
            <Checkbox
              checked={Boolean(mapping.primary)}
              onCheckedChange={(checked) => {
                const isPrimary = checked === true;
                setMappings((current) =>
                  current.map((item) => ({
                    ...item,
                    primary: item.column === mapping.column ? isPrimary : isPrimary ? false : item.primary,
                    chartDefault:
                      item.column === mapping.column && isPrimary
                        ? "x_axis"
                        : item.role === "date_time" && item.column !== mapping.column && isPrimary
                          ? item.chartDefault
                          : item.chartDefault,
                  })),
                );
              }}
            />
            Primary
          </label>
        </div>
      );
    }

    if (mapping.role === "dimension") {
      return (
        <Select
          value={mapping.cardinality || "medium"}
          onValueChange={(value: Cardinality) =>
            setMappings((current) => updateMapping(current, mapping.column, { cardinality: value }))
          }
        >
          <SelectTrigger className="!h-7 w-full max-w-[180px] bg-background text-xs font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low" className="text-xs font-medium">Low cardinality</SelectItem>
            <SelectItem value="medium" className="text-xs font-medium">Medium cardinality</SelectItem>
            <SelectItem value="high" className="text-xs font-medium">High cardinality</SelectItem>
          </SelectContent>
        </Select>
      );
    }

    if (mapping.role === "measure") {
      return (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">Aggregation</span>
          <Select
            value={mapping.aggregation || "sum"}
            onValueChange={(value: Aggregation) =>
              setMappings((current) => updateMapping(current, mapping.column, { aggregation: value }))
            }
          >
            <SelectTrigger className="!h-7 w-[130px] bg-background text-xs font-medium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AGGREGATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return <span className="text-xs font-medium">Excluded from chart suggestions</span>;
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/10",
        isVirtualDb ? "h-[55vh]" : "h-full",
      )}
    >
      <div className="shrink-0 border-b bg-muted/10 px-4 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-sm font-semibold">Assign column roles</h2>
            <span className="text-xs font-medium">({mappings.length}) columns</span>
          </div>
          <Button type="button" variant="outline" size="sm" className="!h-7 gap-1.5 text-xs" onClick={handleReset}>
            <RotateCcw className="size-3.5" />
            Reset to auto-detected
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 px-4 py-2">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/30">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 w-[24%] px-2 py-1 font-bold text-xs uppercase">Column</TableHead>
              <TableHead className="h-8 w-[12%] px-2 py-1 font-bold text-xs uppercase tracking-wide">Type</TableHead>
              <TableHead className="h-8 w-[20%] px-2 py-1 font-bold text-xs uppercase tracking-wide">Role</TableHead>
              <TableHead className="h-8 w-[26%] px-2 py-1 pl-8 font-bold text-xs uppercase tracking-wide">Config</TableHead>
              <TableHead className="h-8 w-[22%] px-2 py-1 font-bold text-xs uppercase tracking-wide">Chart default</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={mapping.column} className="hover:bg-muted/30">
                <TableCell className="px-2 py-1.5">
                  <p className="truncate text-sm font-medium">{mapping.displayName}</p>
                </TableCell>
                <TableCell className="px-2 py-1.5">
                  <span className="text-xs font-medium">{formatTypeLabel(mapping.type)}</span>
                </TableCell>
                <TableCell className="px-2 py-1.5 !pr-10">
                  <Select
                    value={mapping.role}
                    onValueChange={(value: SemanticRole) => handleRoleChange(mapping.column, value)}
                  >
                    <SelectTrigger className={SELECT_VALUE_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="px-2 py-1.5 !pl-10">{renderConfigCell(mapping)}</TableCell>
                <TableCell className="px-2 py-1.5">
                  <Select
                    value={mapping.chartDefault}
                    onValueChange={(value: ChartDefault) =>
                      setMappings((current) => updateMapping(current, mapping.column, { chartDefault: value }))
                    }
                  >
                    <SelectTrigger className={SELECT_VALUE_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHART_DEFAULT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs font-medium">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t bg-muted px-4 py-2">
        <Button variant="outline" onClick={onBack} disabled={isSaving} size="sm">
          Back
        </Button>
        <Button variant="default" onClick={handleSave} disabled={isSaving} size="sm">
          {isSaving
            ? "Saving..."
            : isVirtualDb
              ? isVirtualEditMode
                ? "Update Data"
                : "Add to Table"
              : isEditing
                ? "Update Dataset"
                : "Save Dataset"}
        </Button>
      </footer>
    </div>
  );
}
