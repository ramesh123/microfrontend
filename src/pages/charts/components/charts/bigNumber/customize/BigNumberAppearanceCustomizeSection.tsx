import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { hasExplicitBigNumberCardColor } from '../utils/bigNumberCardColors';
import { PaginatedCardSchemeGrid } from './PaginatedCardSchemeGrid';
import { BigNumberCardBackgroundImageSection } from './BigNumberCardBackgroundImageSection';
import {
  BigNumberCustomizeCollapsibleSection,
  BigNumberCustomizeFieldRow,
  useBigNumberCustomizeHandlers,
  type BigNumberCustomizeSectionProps,
} from './bigNumberCustomizeShared';
import type { BigNumberCustomizationOptions } from './BigNumberCustmizechart';

type Props = BigNumberCustomizeSectionProps & {
  defaultOpen?: boolean;
};

export function BigNumberAppearanceCustomizeSection({
  options,
  onOptionsChange,
  defaultOpen = false,
}: Props) {
  const { update, applyOptions } = useBigNumberCustomizeHandlers(options, onOptionsChange);
  const cardBackgroundStyle = options.cardBackgroundStyle || 'shine';
  const selectedScheme = options.cardColorScheme || 'theme';
  const showColorControls =
    hasExplicitBigNumberCardColor(options) || cardBackgroundStyle === 'glass';
  const opacity = options.backgroundOpacity ?? 100;

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Card appearance"
      description="Background style, colours, image, and opacity"
      defaultOpen={defaultOpen}
    >
      <BigNumberCustomizeFieldRow
        label="Background style"
        hint="Shine = solid gradient. Glass = frosted translucent cards."
      >
        <Select
          value={cardBackgroundStyle}
          onValueChange={(v) =>
            update('cardBackgroundStyle', v as BigNumberCustomizationOptions['cardBackgroundStyle'])
          }
        >
          <SelectTrigger className="w-full !h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shine">Shine gradient</SelectItem>
            <SelectItem value="glass">Glass gradient</SelectItem>
          </SelectContent>
        </Select>
      </BigNumberCustomizeFieldRow>

      <BigNumberCustomizeFieldRow
        label="Colour palette"
        hint={
          cardBackgroundStyle === 'glass'
            ? 'Frosted glass tints for KPI cards'
            : 'Shine gradients for KPI cards'
        }
      >
        <PaginatedCardSchemeGrid
          selectedScheme={selectedScheme}
          onSelectScheme={(value) => {
            if (value === 'theme') {
              applyOptions({
                cardColorScheme: 'theme',
                cardBackgroundColor: '',
                cardBackgroundImage: '',
                cardBackgroundStyle: 'shine',
              });
              return;
            }
            update('cardColorScheme', value);
          }}
          backgroundStyle={cardBackgroundStyle}
        />
      </BigNumberCustomizeFieldRow>

      <BigNumberCustomizeFieldRow
        label="Background image"
        hint="Optional photo or texture behind the colour gradient."
      >
        <BigNumberCardBackgroundImageSection options={options} onOptionsChange={applyOptions} />
      </BigNumberCustomizeFieldRow>

      {showColorControls ? (
        <BigNumberCustomizeFieldRow label="Background opacity">
          <div className="flex items-center gap-3">
            <Slider
              value={[opacity]}
              min={20}
              max={100}
              step={5}
              className="flex-1"
              onValueChange={([v]) => update('backgroundOpacity', v)}
            />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{opacity}%</span>
          </div>
        </BigNumberCustomizeFieldRow>
      ) : null}
    </BigNumberCustomizeCollapsibleSection>
  );
}
