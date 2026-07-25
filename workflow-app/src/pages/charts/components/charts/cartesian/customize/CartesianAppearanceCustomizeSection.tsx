import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { colorSchemes, ColorSchemePreview } from '../../pie/customize/pieColorSchemes';
import {
  CartesianCustomizeCollapsibleSection,
  CartesianCustomizeFieldRow,
  useCartesianCustomizeHandlers,
  type CartesianCustomizeSectionProps,
} from './cartesianCustomizeShared';
import type { CartesianCustomizationOptions } from './cartesianCustomizeTypes';

type Props<T extends CartesianCustomizationOptions = CartesianCustomizationOptions> =
  CartesianCustomizeSectionProps<T> & { defaultOpen?: boolean };

export function CartesianAppearanceCustomizeSection<T extends CartesianCustomizationOptions>({
  options,
  onOptionsChange,
  defaultOpen = true,
}: Props<T>) {
  const { update } = useCartesianCustomizeHandlers(options, onOptionsChange);
  const selected = colorSchemes.find((cs) => cs.value === (options.colorScheme || 'agentic-base'));

  return (
    <CartesianCustomizeCollapsibleSection
      title="Colors"
      description="Series palette for the chart"
      defaultOpen={defaultOpen}
    >
      <CartesianCustomizeFieldRow label="Color scheme">
        <Select
          value={options.colorScheme || 'agentic-base'}
          onValueChange={(value) => update('colorScheme', value)}
        >
          <SelectTrigger className="w-full max-w-full !h-8 min-w-0 text-xs [&>span]:truncate">
            <div className="flex w-full min-w-0 items-center justify-between">
              <SelectValue />
              {selected ? <ColorSchemePreview colors={selected.colors} showOnlyFirst compact /> : null}
            </div>
          </SelectTrigger>
          <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
            {colorSchemes.map((scheme) => (
              <SelectItem key={scheme.value} value={scheme.value}>
                <div className="flex w-full min-w-0 items-center justify-between">
                  <span className="mr-2 truncate text-xs">{scheme.name}</span>
                  <ColorSchemePreview colors={scheme.colors} compact />
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CartesianCustomizeFieldRow>
    </CartesianCustomizeCollapsibleSection>
  );
}
