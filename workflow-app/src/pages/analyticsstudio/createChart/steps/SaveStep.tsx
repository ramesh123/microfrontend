import { Globe, Save, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { ChartVisibility } from "../types";

interface SaveStepProps {
  chartName: string;
  chartVisibility: ChartVisibility;
  selectedChartName?: string;
  selectedSourceName?: string;
  dimensions: string[];
  metrics: string[];
  enableDrilldown?: boolean;
  drilldownColumns?: string[];
  onChartNameChange: (value: string) => void;
  onChartVisibilityChange: (value: ChartVisibility) => void;
  isViewOnly?: boolean;
  mode?: "create" | "edit" | "view";
}

const VISIBILITY_OPTIONS: Array<{
  value: ChartVisibility;
  label: string;
  description: string;
  icon: typeof User;
}> = [
  {
    value: "personal",
    label: "Personal",
    description: "Only you can view and edit this chart.",
    icon: User,
  },
  {
    value: "team",
    label: "Team",
    description: "Shared with everyone on your team.",
    icon: Users,
  },
  {
    value: "public",
    label: "Public",
    description: "Available to all users in the organization.",
    icon: Globe,
  },
];

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-tight text-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-xs font-normal text-foreground">{value}</dd>
    </div>
  );
}

export default function SaveStep({
  chartName,
  chartVisibility,
  selectedChartName,
  selectedSourceName,
  dimensions,
  metrics,
  enableDrilldown,
  drilldownColumns = [],
  onChartNameChange,
  onChartVisibilityChange,
  isViewOnly = false,
  mode = "create",
}: SaveStepProps) {
  const title =
    mode === "view" ? "Chart details" : mode === "edit" ? "Update chart" : "Save chart";
  const subtitle =
    mode === "view"
      ? "Review chart name and visibility settings."
      : mode === "edit"
        ? "Update chart name and choose who can access it."
        : "Name your chart and choose who can access it.";

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-muted/50 p-1">
      <div className="mx-auto grid w-full max-w-9xl gap-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-xl border bg-background shadow-sm">
          <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Save className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-foreground tracking-tight">{title}</p>
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <div>
              <Label htmlFor="chart-name" className="text-xs font-bold uppercase text-foreground tracking-tight">
                Chart name
              </Label>
              <Input
                id="chart-name"
                value={chartName}
                onChange={(event) => onChartNameChange(event.target.value)}
                placeholder="Enter a chart name"
                className="mt-1.5 h-8 text-xs"
                disabled={isViewOnly}
                readOnly={isViewOnly}
              />
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-foreground tracking-tight">Visibility</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Control who can find and open this chart.
              </p>
              <RadioGroup
                value={chartVisibility}
                onValueChange={(value) => onChartVisibilityChange(value as ChartVisibility)}
                className="mt-2 grid gap-2"
              >
                {VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = chartVisibility === option.value;
                  return (
                    <div key={option.value}>
                      <RadioGroupItem
                        value={option.value}
                        id={`visibility-${option.value}`}
                        className="sr-only"
                        disabled={isViewOnly}
                      />
                      <Label
                        htmlFor={`visibility-${option.value}`}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors",
                          isViewOnly ? "cursor-default" : "cursor-pointer",
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary/15"
                            : "border-border bg-background hover:bg-muted/30",
                        )}
                        onClick={(event) => {
                          if (isViewOnly) event.preventDefault();
                        }}
                      >
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md",
                            selected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold">{option.label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {option.description}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "size-3.5 shrink-0 rounded-full border-2",
                            selected ? "border-primary bg-primary" : "border-muted-foreground/30",
                          )}
                        />
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-background shadow-sm">
          <div className="border-b px-4 py-2.5">
            <p className="text-xs font-bold uppercase text-foreground tracking-tight">Configuration summary</p>
            <p className="text-[11px] text-muted-foreground">Review before saving.</p>
          </div>

          <dl className="grid gap-3 p-4 sm:grid-cols-2">
            <SummaryField label="Chart type" value={selectedChartName ?? "Not selected"} />
            <SummaryField label="Source" value={selectedSourceName ?? "Not selected"} />
            <SummaryField
              label="Dimensions"
              value={dimensions.length > 0 ? dimensions.join(", ") : "None selected"}
            />
            <SummaryField
              label="Metrics"
              value={metrics.length > 0 ? metrics.join(", ") : "None selected"}
            />
            <SummaryField
              label="Visibility"
              value={VISIBILITY_OPTIONS.find((option) => option.value === chartVisibility)?.label ?? "Personal"}
            />
            {enableDrilldown && drilldownColumns.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="text-xs font-bold uppercase tracking-tight text-foreground">
                  Drilldown path
                </dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {drilldownColumns.map((column, index) => (
                    <span
                      key={`${column}-${index}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium"
                    >
                      <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      {column}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>
    </div>
  );
}
