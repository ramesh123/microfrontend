import type { ReactNode } from "react";

export type ChartCategoryId = "charts" | "kpi_gauges" | "tables" | "ot_process";

export interface ChartCategory {
  id: ChartCategoryId;
  label: string;
}

export interface ChartTypeOption {
  id: string;
  title: string;
  description: string;
  category: ChartCategoryId;
}

export const CHART_CATEGORIES: ChartCategory[] = [
  { id: "charts", label: "Charts" },
  { id: "kpi_gauges", label: "KPI & Gauges" },
  { id: "tables", label: "Tables" },
  { id: "ot_process", label: "OT / Process" },
];

export const CHART_TYPE_OPTIONS: ChartTypeOption[] = [
  { id: "bar", title: "Bar chart", description: "Compare values across categories", category: "charts" },
  { id: "horizontal_bar", title: "Horiz. bar", description: "Horizontal category comparison", category: "charts" },
  { id: "stacked_bar", title: "Stacked bar", description: "Part-to-whole across categories", category: "charts" },
  { id: "line", title: "Line chart", description: "Trends over time or sequence", category: "charts" },
  { id: "area", title: "Area chart", description: "Volume trends over time", category: "charts" },
  { id: "combo", title: "Combo", description: "Mix bars and lines together", category: "charts" },
  { id: "scatter", title: "Scatter", description: "Relationship between two measures", category: "charts" },
  { id: "pie", title: "Pie chart", description: "Share of a whole", category: "charts" },
  { id: "donut", title: "Donut", description: "Part-to-whole with center space", category: "charts" },
  { id: "heatmap", title: "Heatmap", description: "Intensity across two dimensions", category: "charts" },
  { id: "treemap", title: "Treemap", description: "Hierarchical part-to-whole", category: "charts" },
  { id: "waterfall", title: "Waterfall", description: "Cumulative effect of values", category: "charts" },
  { id: "funnel", title: "Funnel", description: "Stage drop-off through a process", category: "charts" },
  { id: "bullet", title: "Bullet", description: "Progress against a target", category: "charts" },
  { id: "sunburst", title: "Sunburst", description: "Hierarchical radial breakdown", category: "charts" },
  { id: "radius_pie", title: "Radius pie", description: "Equal angles, radius encodes value", category: "charts" },
  { id: "big_number", title: "Big number", description: "Highlight a single KPI", category: "kpi_gauges" },
  { id: "big_number_stream", title: "Big # stream", description: "KPI with sparkline trend", category: "kpi_gauges" },
  { id: "gauge", title: "Gauge", description: "Value within a defined range", category: "kpi_gauges" },
  { id: "table", title: "Table", description: "Detailed row-level data view", category: "tables" },
  { id: "pivot_table", title: "Pivot table", description: "Summarize data by rows and columns", category: "tables" },
  { id: "timeseries", title: "Time series", description: "Process values over time", category: "ot_process" },
  { id: "gantt", title: "Gantt", description: "Schedule tasks on a timeline", category: "ot_process" },
  { id: "control_chart", title: "Control chart", description: "Monitor process stability", category: "ot_process" },
  { id: "pareto", title: "Pareto", description: "Identify the vital few factors", category: "ot_process" },
];

export function getCategoryCount(categoryId: ChartCategoryId): number {
  return CHART_TYPE_OPTIONS.filter((option) => option.category === categoryId).length;
}

export function getChartTypeById(id: string | undefined): ChartTypeOption | undefined {
  return CHART_TYPE_OPTIONS.find((option) => option.id === id);
}

export function getCategoryLabel(categoryId: ChartCategoryId): string {
  return CHART_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}

export type ChartPreviewRenderer = (props: { selected?: boolean }) => ReactNode;

const previewColors = {
  primary: "#2563eb",
  secondary: "#60a5fa",
  muted: "#93c5fd",
  accent: "#1d4ed8",
};

function MiniBars({ horizontal = false }: { horizontal?: boolean }) {
  const bars = [28, 18, 24, 14, 20];
  return (
    <div className={`flex ${horizontal ? "flex-col" : "flex-row items-end"} gap-1`}>
      {bars.map((height, index) => (
        <div
          key={index}
          className="rounded-sm bg-blue-500"
          style={
            horizontal
              ? { height: 6, width: `${height + 20}px`, opacity: 0.45 + index * 0.1 }
              : { width: 6, height: `${height}px`, opacity: 0.45 + index * 0.1 }
          }
        />
      ))}
    </div>
  );
}

function MiniLine() {
  return (
    <svg viewBox="0 0 48 28" className="h-7 w-12" aria-hidden>
      <polyline
        fill="none"
        stroke={previewColors.primary}
        strokeWidth="2"
        points="2,22 12,16 20,18 28,8 38,12 46,6"
      />
    </svg>
  );
}

function MiniArea() {
  return (
    <svg viewBox="0 0 48 28" className="h-7 w-12" aria-hidden>
      <path
        d="M2,22 L12,16 L20,18 L28,8 L38,12 L46,6 L46,26 L2,26 Z"
        fill={previewColors.muted}
        opacity="0.55"
      />
      <polyline
        fill="none"
        stroke={previewColors.primary}
        strokeWidth="2"
        points="2,22 12,16 20,18 28,8 38,12 46,6"
      />
    </svg>
  );
}

function MiniPie({ donut = false }: { donut?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
      <circle cx="20" cy="20" r="16" fill={previewColors.muted} />
      <path d="M20 20 L36 20 A16 16 0 0 1 12 33 Z" fill={previewColors.primary} />
      <path d="M20 20 L12 33 A16 16 0 0 1 12 7 Z" fill={previewColors.secondary} />
      {donut ? <circle cx="20" cy="20" r="7" fill="white" /> : null}
    </svg>
  );
}

function MiniGauge() {
  return (
    <svg viewBox="0 0 48 28" className="h-7 w-12" aria-hidden>
      <path d="M6 24 A18 18 0 0 1 42 24" fill="none" stroke={previewColors.muted} strokeWidth="4" />
      <path d="M10 24 A14 14 0 0 1 38 24" fill="none" stroke={previewColors.secondary} strokeWidth="4" />
      <path d="M14 24 A10 10 0 0 1 34 24" fill="none" stroke={previewColors.primary} strokeWidth="4" />
    </svg>
  );
}

function MiniNumber() {
  return <div className="text-lg font-bold text-blue-600">128</div>;
}

function MiniTable() {
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="h-2 w-3 rounded-[1px] bg-blue-200" />
      ))}
    </div>
  );
}

function MiniHeatmap() {
  return (
    <div className="grid grid-cols-4 gap-0.5">
      {[0.3, 0.5, 0.8, 0.4, 0.6, 0.9, 0.5, 0.7].map((opacity, index) => (
        <div key={index} className="h-2.5 w-2.5 rounded-[1px] bg-blue-500" style={{ opacity }} />
      ))}
    </div>
  );
}

function MiniFunnel() {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="h-2 w-10 rounded-sm bg-blue-200" />
      <div className="h-2 w-8 rounded-sm bg-blue-400" />
      <div className="h-2 w-6 rounded-sm bg-blue-600" />
    </div>
  );
}

function MiniTreemap() {
  return (
    <div className="grid h-8 w-10 grid-cols-2 grid-rows-2 gap-0.5">
      <div className="rounded-sm bg-blue-600" />
      <div className="rounded-sm bg-blue-400" />
      <div className="col-span-2 rounded-sm bg-blue-300" />
    </div>
  );
}

function MiniScatter() {
  return (
    <svg viewBox="0 0 48 28" className="h-7 w-12" aria-hidden>
      {[
        [8, 18],
        [14, 12],
        [20, 16],
        [28, 8],
        [34, 14],
        [40, 10],
      ].map(([cx, cy], index) => (
        <circle key={index} cx={cx} cy={cy} r="2.5" fill={previewColors.primary} opacity={0.45 + index * 0.1} />
      ))}
    </svg>
  );
}

function MiniSunburst() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
      <circle cx="20" cy="20" r="16" fill="none" stroke={previewColors.muted} strokeWidth="8" />
      <circle cx="20" cy="20" r="10" fill="none" stroke={previewColors.secondary} strokeWidth="6" />
      <circle cx="20" cy="20" r="4" fill={previewColors.primary} />
    </svg>
  );
}

function MiniCombo() {
  return (
    <div className="flex items-end gap-1">
      <MiniBars />
      <MiniLine />
    </div>
  );
}

function MiniWaterfall() {
  return (
    <div className="flex items-end gap-0.5">
      {[16, 22, 14, 24, 18].map((height, index) => (
        <div
          key={index}
          className="w-1.5 rounded-sm bg-blue-500"
          style={{ height: `${height}px`, opacity: index % 2 === 0 ? 1 : 0.55 }}
        />
      ))}
    </div>
  );
}

function MiniBullet() {
  return (
    <div className="flex h-3 w-12 flex-col justify-center gap-0.5">
      <div className="h-1 rounded-full bg-blue-200" />
      <div className="h-1.5 w-8 rounded-full bg-blue-600" />
    </div>
  );
}

function MiniGantt() {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-10 rounded-full bg-blue-600" />
      <div className="h-1.5 w-7 rounded-full bg-blue-400" />
      <div className="h-1.5 w-9 rounded-full bg-blue-500" />
    </div>
  );
}

export const CHART_TYPE_PREVIEWS: Record<string, ChartPreviewRenderer> = {
  bar: () => <MiniBars />,
  horizontal_bar: () => <MiniBars horizontal />,
  stacked_bar: () => <MiniBars />,
  line: () => <MiniLine />,
  area: () => <MiniArea />,
  combo: () => <MiniCombo />,
  scatter: () => <MiniScatter />,
  pie: () => <MiniPie />,
  donut: () => <MiniPie donut />,
  heatmap: () => <MiniHeatmap />,
  treemap: () => <MiniTreemap />,
  waterfall: () => <MiniWaterfall />,
  funnel: () => <MiniFunnel />,
  bullet: () => <MiniBullet />,
  sunburst: () => <MiniSunburst />,
  radius_pie: () => <MiniPie />,
  big_number: () => <MiniNumber />,
  big_number_stream: () => (
    <div className="flex flex-col items-center gap-0.5">
      <MiniNumber />
      <MiniLine />
    </div>
  ),
  gauge: () => <MiniGauge />,
  table: () => <MiniTable />,
  pivot_table: () => <MiniTable />,
  timeseries: () => <MiniLine />,
  gantt: () => <MiniGantt />,
  control_chart: () => <MiniLine />,
  pareto: () => <MiniBars horizontal />,
};
