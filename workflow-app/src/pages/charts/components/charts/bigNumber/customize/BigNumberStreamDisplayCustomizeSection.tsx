import * as React from 'react';
import { Input } from '@/components/ui/input';
import { ColorPickerPopover } from '@/pages/WidgetsLibrary/ColorPickerPopover';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  BigNumberCustomizeToggleRow,
  useBigNumberCustomizeHandlers,
} from './bigNumberCustomizeShared';
import type { BigNumberStreamCustomizationOptions } from './BigNumberStreamCustomizePanel';

export function BigNumberStreamDisplayCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: {
  options: BigNumberStreamCustomizationOptions;
  onOptionsChange: (next: BigNumberStreamCustomizationOptions) => void;
  defaultOpen?: boolean;
}) {
  const { update } = useBigNumberCustomizeHandlers(options, onOptionsChange);
  const [isSparklineColorOpen, setIsSparklineColorOpen] = React.useState(false);
  const sparklineColor = options.sparklineColor?.trim() || '#3B82F6';

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Stream display"
      description="Title, sparkline, trend, and live animations"
      defaultOpen={defaultOpen}
    >
      <BigNumberCustomizeFieldRow
        label="Display title"
        hint="Overrides the metric name on the KPI card."
      >
        <Input
          className="!h-7 text-xs"
          placeholder="KPI title"
          value={options.titleLabel ?? ''}
          onChange={(e) => update('titleLabel', e.target.value)}
        />
      </BigNumberCustomizeFieldRow>

      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        <BigNumberCustomizeToggleRow
          label="Sparkline"
          hint="Mini trend chart under the value."
          checked={options.showSparkline !== false}
          onCheckedChange={(v) => update('showSparkline', v)}
        />
        <BigNumberCustomizeToggleRow
          label="Trend delta"
          hint="Show change vs previous value."
          checked={options.showTrendDelta !== false}
          onCheckedChange={(v) => update('showTrendDelta', v)}
        />
      </div>

      <BigNumberCustomizeToggleRow
        label="Animate updates"
        hint="Pulse and animate when values refresh."
        checked={options.animateValueUpdates !== false}
        onCheckedChange={(v) => update('animateValueUpdates', v)}
      />

      <BigNumberCustomizeFieldRow label="Sparkline colour">
        <ColorPickerPopover
          isOpen={isSparklineColorOpen}
          onOpenChange={setIsSparklineColorOpen}
          color={sparklineColor}
          setColor={(nextColor) => update('sparklineColor', nextColor)}
          previewText="Sparkline"
          label="Sparkline colour"
          popoverSide="left"
          popoverAlign="end"
        >
          <button
            type="button"
            className="flex h-7 items-center gap-1.5 rounded border border-border px-1.5 hover:bg-muted/40"
            aria-label="Pick sparkline colour"
          >
            <span
              className="h-4 w-4 shrink-0 rounded border border-border"
              style={{ backgroundColor: sparklineColor }}
            />
            <span className="text-[10px] font-mono text-muted-foreground">
              {options.sparklineColor?.trim() ? sparklineColor : 'Auto'}
            </span>
          </button>
        </ColorPickerPopover>
      </BigNumberCustomizeFieldRow>
    </BigNumberCustomizeCollapsibleSection>
  );
}
