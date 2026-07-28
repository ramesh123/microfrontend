export type BigNumberElementPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export const BIG_NUMBER_ELEMENT_POSITION_OPTIONS: Array<{
  value: BigNumberElementPosition;
  label: string;
}> = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top center' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center-left', label: 'Center left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom center' },
  { value: 'bottom-right', label: 'Bottom right' },
];

export const DEFAULT_ICON_POSITION: BigNumberElementPosition = 'top-left';
export const DEFAULT_HEADER_POSITION: BigNumberElementPosition = 'top-left';
export const DEFAULT_VALUE_POSITION: BigNumberElementPosition = 'center-left';

const POSITION_GRID_CLASS: Record<BigNumberElementPosition, string> = {
  'top-left': 'col-start-1 row-start-1',
  'top-center': 'col-start-2 row-start-1',
  'top-right': 'col-start-3 row-start-1',
  'center-left': 'col-start-1 row-start-2',
  center: 'col-start-2 row-start-2',
  'center-right': 'col-start-3 row-start-2',
  'bottom-left': 'col-start-1 row-start-3',
  'bottom-center': 'col-start-2 row-start-3',
  'bottom-right': 'col-start-3 row-start-3',
};

export function normalizeElementPosition(
  value: string | undefined,
  fallback: BigNumberElementPosition,
): BigNumberElementPosition {
  if (
    value &&
    BIG_NUMBER_ELEMENT_POSITION_OPTIONS.some((o) => o.value === value)
  ) {
    return value as BigNumberElementPosition;
  }
  return fallback;
}

export function elementPositionGridClass(position: BigNumberElementPosition): string {
  return POSITION_GRID_CLASS[position];
}

/** Flex + text alignment inside a grid cell for the given anchor. */
export function elementPositionAlignClass(position: BigNumberElementPosition): string {
  const parts = position.split('-');
  const vertical = parts[0] as 'top' | 'center' | 'bottom';
  const horizontal = (parts[1] || 'center') as 'left' | 'center' | 'right';

  const verticalAlign =
    vertical === 'top'
      ? 'items-start self-start'
      : vertical === 'center'
        ? 'items-center self-center'
        : 'items-end self-end';

  const horizontalAlign =
    horizontal === 'left'
      ? 'justify-start'
      : horizontal === 'center'
        ? 'justify-center'
        : 'justify-end';

  const textAlign =
    horizontal === 'left'
      ? 'text-left'
      : horizontal === 'center'
        ? 'text-center'
        : 'text-right';

  return `${verticalAlign} ${horizontalAlign} ${textAlign}`;
}

function isTopRowPosition(position: BigNumberElementPosition): boolean {
  return position === 'top-left' || position === 'top-center' || position === 'top-right';
}

/** Use grid layout whenever any layout setting deviates from classic KPI defaults. */
export function shouldUsePositionGridLayout(
  options: {
    iconPosition?: BigNumberElementPosition;
    headerPosition?: BigNumberElementPosition;
    valuePosition?: BigNumberElementPosition;
    headerValueSamePosition?: boolean;
  },
  hasIcon: boolean,
): boolean {
  return !shouldUseClassicKpiLayout(options, hasIcon);
}

/** @deprecated Use shouldUsePositionGridLayout — inverted. */
export function shouldUseClassicKpiLayout(
  options: {
    iconPosition?: BigNumberElementPosition;
    headerPosition?: BigNumberElementPosition;
    valuePosition?: BigNumberElementPosition;
    headerValueSamePosition?: boolean;
  },
  hasIcon: boolean,
): boolean {
  const iconPos = normalizeElementPosition(options.iconPosition, DEFAULT_ICON_POSITION);
  const headerPos = normalizeElementPosition(options.headerPosition, DEFAULT_HEADER_POSITION);
  const valuePos = normalizeElementPosition(options.valuePosition, DEFAULT_VALUE_POSITION);

  if (options.headerValueSamePosition) {
    return iconPos === 'top-left' && headerPos === 'top-left';
  }

  if (!hasIcon) {
    return headerPos === 'top-left' && (valuePos === 'top-left' || valuePos === 'center-left');
  }

  return (
    iconPos === 'top-left' &&
    headerPos === 'top-left' &&
    (valuePos === 'top-left' || valuePos === 'center-left')
  );
}
