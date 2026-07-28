import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  BigNumberCustomizeToggleRow,
  useBigNumberCustomizeHandlers,
  type BigNumberCustomizeSectionProps,
} from './bigNumberCustomizeShared';
import {
  parseTypographyPx,
  resolveBigNumberSubheaderFontPx,
  resolveBigNumberValueFontPx,
} from '../utils/bigNumberUnitOptions';

type Props = BigNumberCustomizeSectionProps & {
  showFooterControls?: boolean;
  defaultOpen?: boolean;
};

export function BigNumberTypographyCustomizeSection({
  options,
  onOptionsChange,
  showFooterControls = false,
  defaultOpen = false,
}: Props) {
  const { update } = useBigNumberCustomizeHandlers(options, onOptionsChange);

  const valueFontPx =
    options.bigNumberFontSizePx ??
    parseTypographyPx(resolveBigNumberValueFontPx(options, 'single'));
  const titleFontPx =
    options.subheaderFontSizePx ??
    parseTypographyPx(resolveBigNumberSubheaderFontPx(options, 'default'));

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Typography"
      description="Title and value font sizes stay fixed when the widget is resized"
      defaultOpen={defaultOpen}
    >
      <div className="grid grid-cols-2 gap-1.5">
        <BigNumberCustomizeFieldRow label="Value preset">
          <Select
            value={options.bigNumberFontSize || 'normal'}
            onValueChange={(v) =>
              onOptionsChange({
                ...options,
                bigNumberFontSize: v as typeof options.bigNumberFontSize,
                bigNumberFontSizePx: undefined,
              })
            }
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </BigNumberCustomizeFieldRow>

        <BigNumberCustomizeFieldRow label="Title preset">
          <Select
            value={options.subheaderFontSize || 'large'}
            onValueChange={(v) =>
              onOptionsChange({
                ...options,
                subheaderFontSize: v as typeof options.subheaderFontSize,
                subheaderFontSizePx: undefined,
              })
            }
          >
            <SelectTrigger className="w-full !h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </BigNumberCustomizeFieldRow>
      </div>

      <BigNumberCustomizeFieldRow
        label="Value font size"
        hint="Pixels; does not shrink when the card is resized smaller"
      >
        <div>
          <Slider
            value={[valueFontPx]}
            onValueChange={(next) => update('bigNumberFontSizePx', next[0])}
            min={12}
            max={72}
            step={1}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>12px</span>
            <span>{Math.round(valueFontPx)}px</span>
            <span>72px</span>
          </div>
        </div>
      </BigNumberCustomizeFieldRow>

      <BigNumberCustomizeFieldRow
        label="Title font size"
        hint="Pixels; does not shrink when the card is resized smaller"
      >
        <div>
          <Slider
            value={[titleFontPx]}
            onValueChange={(next) => update('subheaderFontSizePx', next[0])}
            min={9}
            max={32}
            step={1}
            className="w-full"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>9px</span>
            <span>{Math.round(titleFontPx)}px</span>
            <span>32px</span>
          </div>
        </div>
      </BigNumberCustomizeFieldRow>

      <div className="grid grid-cols-2 gap-1.5">
        <BigNumberCustomizeToggleRow
          label="Bold title"
          checked={options.subheaderBold === true}
          onCheckedChange={(v) => update('subheaderBold', v)}
        />
        <BigNumberCustomizeToggleRow
          label="Bold value"
          checked={options.bigNumberBold !== false}
          onCheckedChange={(v) => update('bigNumberBold', v)}
        />
      </div>

      <div className="space-y-1">
        <BigNumberCustomizeToggleRow
          label="Auto-scale value font"
          hint="Shrink only when the formatted number is very long (not on widget resize)."
          checked={options.autoScaleValueFontSize === true}
          onCheckedChange={(v) => update('autoScaleValueFontSize', v)}
        />
        {showFooterControls ? (
          <BigNumberCustomizeToggleRow
            label="Step down footer fonts"
            hint="Footer metrics use smaller sizes left to right."
            checked={options.footerStepDownFontSize === true}
            onCheckedChange={(v) => update('footerStepDownFontSize', v)}
          />
        ) : null}
      </div>
    </BigNumberCustomizeCollapsibleSection>
  );
}
