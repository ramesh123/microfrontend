import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BigNumberContentLayoutCustomizeSection } from './BigNumberIconLayoutCustomizeSections';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  useBigNumberCustomizeHandlers,
  type BigNumberCustomizeSectionProps,
} from './bigNumberCustomizeShared';
import type { BigNumberCustomizationOptions } from './BigNumberCustmizechart';

type Props = BigNumberCustomizeSectionProps & {
  metricLabels: string[];
  defaultOpen?: boolean;
};

export function BigNumberLayoutMetricsCustomizeSection({
  options,
  onOptionsChange,
  metricLabels,
  defaultOpen = false,
}: Props) {
  const { update, applyOptions } = useBigNumberCustomizeHandlers(options, onOptionsChange);
  const layoutMode = options.layoutMode || 'auto';
  const showKpiControls =
    metricLabels.length >= 2 && (layoutMode === 'kpi' || layoutMode === 'auto');
  const primaryIndex = Math.max(
    0,
    Math.min(options.primaryMetricIndex ?? 0, Math.max(metricLabels.length - 1, 0)),
  );

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Layout & metrics"
      description="KPI structure and element positions on the card"
      defaultOpen={defaultOpen}
    >
      <BigNumberCustomizeFieldRow
        label="Metric layout"
        hint="KPI card shows one main value with footer metrics; columns show all side by side."
      >
        <Select
          value={layoutMode}
          onValueChange={(v) => update('layoutMode', v as BigNumberCustomizationOptions['layoutMode'])}
        >
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto (KPI when 2+ metrics)</SelectItem>
            <SelectItem value="kpi">KPI card (main + footer row)</SelectItem>
            <SelectItem value="columns">Columns (all side by side)</SelectItem>
          </SelectContent>
        </Select>
      </BigNumberCustomizeFieldRow>

      {showKpiControls ? (
        <BigNumberCustomizeFieldRow
          label="Primary metric"
          hint={`Footer shows the other ${Math.max(metricLabels.length - 1, 0)} metric(s) below.`}
        >
          <Select
            value={String(primaryIndex)}
            onValueChange={(v) => update('primaryMetricIndex', Number(v))}
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {metricLabels.map((label, index) => (
                <SelectItem key={`${label}-${index}`} value={String(index)}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </BigNumberCustomizeFieldRow>
      ) : null}

      <BigNumberCustomizeFieldRow
        label="Element positions"
        hint="Place the icon, title, and value anywhere on the KPI card."
      >
        <BigNumberContentLayoutCustomizeSection options={options} onOptionsChange={applyOptions} />
      </BigNumberCustomizeFieldRow>
    </BigNumberCustomizeCollapsibleSection>
  );
}
