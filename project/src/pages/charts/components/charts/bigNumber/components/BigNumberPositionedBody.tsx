import { useRef, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import type { BigNumberCustomizationOptions } from '../customize/BigNumberCustmizechart';
import { BigNumberDraggableKpiIcon } from './BigNumberDraggableKpiIcon';
import { hasKpiIconSource, resolveKpiIconSizePx } from '../utils/bigNumberKpiIconUtils';
import { resolveFreeIconPosition } from '../utils/bigNumberFreeIconPosition';
import { scalePxNumber } from '../utils/bigNumberResponsiveScale';
import { useFreeIconHeaderInset } from './useFreeIconHeaderInset';
import {
  DEFAULT_HEADER_POSITION,
  DEFAULT_VALUE_POSITION,
  elementPositionAlignClass,
  elementPositionGridClass,
  normalizeElementPosition,
  shouldUsePositionGridLayout,
  type BigNumberElementPosition,
} from '../utils/bigNumberStreamLayout';

type PositionedBlock = {
  key: string;
  position: BigNumberElementPosition;
  node: ReactNode;
};

function groupBlocksByPosition(blocks: PositionedBlock[]): Map<BigNumberElementPosition, PositionedBlock[]> {
  const grouped = new Map<BigNumberElementPosition, PositionedBlock[]>();
  for (const block of blocks) {
    const list = grouped.get(block.position) ?? [];
    list.push(block);
    grouped.set(block.position, list);
  }
  return grouped;
}

export interface BigNumberPositionedBodyProps {
  label: ReactNode;
  formattedValue: ReactNode;
  options: BigNumberCustomizationOptions;
  labelColor: string;
  numberColor: string;
  subheaderFontPx: string;
  numberFontSize: string;
  headerFontWeight: 'normal' | 'bold';
  countFontWeight: 'normal' | 'bold';
  labelGap?: string;
  textAlign?: 'left' | 'center';
  uppercaseLabel?: boolean;
  trackingLabel?: boolean;
  containerScale?: number;
  /** KPI card: keep primary block compact so footer sits close underneath. */
  compact?: boolean;
  iconDraggable?: boolean;
  onIconPositionChange?: (x: number, y: number) => void;
  /** When true, free icon is rendered by a parent container (e.g. full KPI card). */
  suppressFreeIcon?: boolean;
  /** Parent card surface ref — used to align header inset with free icon positioning. */
  layoutMeasureRef?: RefObject<HTMLElement | null>;
}

export function BigNumberPositionedBody({
  label,
  formattedValue,
  options,
  labelColor,
  numberColor,
  subheaderFontPx,
  numberFontSize,
  headerFontWeight,
  countFontWeight,
  labelGap = '4px',
  textAlign = 'left',
  uppercaseLabel = false,
  trackingLabel = false,
  containerScale = 1,
  compact = false,
  iconDraggable = false,
  onIconPositionChange,
  suppressFreeIcon = false,
  layoutMeasureRef,
}: BigNumberPositionedBodyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = layoutMeasureRef ?? containerRef;
  const hasIcon = hasKpiIconSource(options.iconSvg);
  const useFreeIcon = hasIcon;
  const usePositionGrid = shouldUsePositionGridLayout(options, false);
  const iconSizePx = scalePxNumber(resolveKpiIconSizePx(options.iconSizePx), containerScale);
  const freeIconPosition = useFreeIcon ? resolveFreeIconPosition(options) : null;
  const freeIconHeaderInset = useFreeIconHeaderInset(
    options,
    measureRef,
    iconSizePx,
    suppressFreeIcon && useFreeIcon,
    containerRef,
  );

  const labelStyle = {
    color: labelColor,
    fontSize: subheaderFontPx,
    fontWeight: headerFontWeight,
    marginBottom: labelGap,
  };

  const valueStyle = {
    color: numberColor,
    fontSize: numberFontSize,
    fontWeight: countFontWeight,
    lineHeight: 1.1,
  };

  const headerBlock = (
    <div
      className={cn(
        'min-w-0 w-full line-clamp-2 break-words',
        textAlign === 'center' ? 'text-center' : 'text-left',
        uppercaseLabel && 'uppercase tracking-[0.08em]',
        trackingLabel && !uppercaseLabel && 'tracking-wide',
      )}
      style={labelStyle}
    >
      {label}
    </div>
  );

  const valueBlock = (
    <div
      className={cn(
        'max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap tabular-nums',
        textAlign === 'center' ? 'text-center' : 'text-left',
      )}
      style={valueStyle}
      title={typeof formattedValue === 'string' ? formattedValue : undefined}
    >
      {formattedValue}
    </div>
  );

  const renderFreeIcon = () => {
    if (suppressFreeIcon || !useFreeIcon || !freeIconPosition) return null;
    return (
      <BigNumberDraggableKpiIcon
        source={options.iconSvg!}
        color={options.iconSvgColor}
        sizePx={iconSizePx}
        x={freeIconPosition.x}
        y={freeIconPosition.y}
        draggable={iconDraggable}
        containerRef={containerRef}
        onPositionChange={onIconPositionChange}
      />
    );
  };

  let bodyContent: ReactNode;

  if (!usePositionGrid) {
    bodyContent = (
      <div className={cn('flex w-full min-w-0 flex-col', compact ? 'h-auto shrink-0' : 'h-full min-h-0')}>
        <div
          className="min-w-0 w-full"
          style={freeIconHeaderInset > 0 ? { paddingLeft: freeIconHeaderInset } : undefined}
        >
          {headerBlock}
        </div>
        {valueBlock}
      </div>
    );
  } else {
    const headerPosition = normalizeElementPosition(options.headerPosition, DEFAULT_HEADER_POSITION);
    const headerValueSamePosition = options.headerValueSamePosition === true;
    const valuePosition = headerValueSamePosition
      ? headerPosition
      : normalizeElementPosition(options.valuePosition, DEFAULT_VALUE_POSITION);

    const positionedBlocks: PositionedBlock[] = [];
    if (headerValueSamePosition) {
      positionedBlocks.push({
        key: 'header-value',
        position: headerPosition,
        node: (
          <div className="flex min-w-0 max-w-full flex-col items-stretch gap-1 overflow-hidden">
            {headerBlock}
            {valueBlock}
          </div>
        ),
      });
    } else {
      positionedBlocks.push({ key: 'header', position: headerPosition, node: headerBlock });
      positionedBlocks.push({ key: 'value', position: valuePosition, node: valueBlock });
    }

    const applyHeaderInset = (node: ReactNode, position: BigNumberElementPosition) => {
      if (freeIconHeaderInset <= 0 || position !== 'top-left') return node;
      return (
        <div className="min-w-0 w-full" style={{ paddingLeft: freeIconHeaderInset }}>
          {node}
        </div>
      );
    };

    const blocksByPosition = groupBlocksByPosition(positionedBlocks);

    bodyContent = (
      <div
        className={cn(
          'grid grid-cols-3 grid-rows-3 gap-1 overflow-hidden',
          compact ? 'h-auto max-h-full shrink-0' : 'h-full min-h-0 flex-1',
        )}
      >
        {Array.from(blocksByPosition.entries()).map(([position, blocks]) => (
          <div
            key={position}
            className={cn(
              'flex min-w-0 max-w-full gap-1 overflow-hidden',
              elementPositionGridClass(position),
              elementPositionAlignClass(position),
            )}
          >
            {blocks.map((block) => (
              <div key={block.key} className="min-w-0 max-w-full shrink overflow-hidden">
                {block.key === 'header' || block.key === 'header-value'
                  ? applyHeaderInset(block.node, block.key === 'header-value' ? headerPosition : headerPosition)
                  : block.node}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full min-w-0', compact ? 'h-auto shrink-0' : 'h-full min-h-0')}
    >
      {bodyContent}
      {renderFreeIcon()}
    </div>
  );
}
