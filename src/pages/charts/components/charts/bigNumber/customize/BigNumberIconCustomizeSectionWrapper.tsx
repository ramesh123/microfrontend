import { BigNumberIconCustomizeSection } from './BigNumberIconLayoutCustomizeSections';
import {
  BigNumberCustomizeCollapsibleSection,
  useBigNumberCustomizeHandlers,
  type BigNumberCustomizeSectionProps,
} from './bigNumberCustomizeShared';

export function BigNumberIconCustomizeSectionWrapper({
  options,
  onOptionsChange,
  defaultOpen = false,
}: BigNumberCustomizeSectionProps & { defaultOpen?: boolean }) {
  const { applyOptions } = useBigNumberCustomizeHandlers(options, onOptionsChange);

  return (
    <BigNumberCustomizeCollapsibleSection
      title="Icon"
      description="Upload SVG or image, size, and colour"
      defaultOpen={defaultOpen}
    >
      <BigNumberIconCustomizeSection options={options} onOptionsChange={applyOptions} />
    </BigNumberCustomizeCollapsibleSection>
  );
}
