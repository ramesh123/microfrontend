import { memo } from 'react';

import { DEFAULT_DIVIDER_PARAMS } from '../staticDashboardBlocks';

interface DividerBlockViewProps {
  params?: {
    divider_orientation?: 'horizontal' | 'vertical';
    divider_thickness?: number;
    divider_color?: string;
  };
}

export const DividerBlockView = memo(function DividerBlockView({ params }: DividerBlockViewProps) {
  const isVertical = params?.divider_orientation === 'vertical';
  const thickness = Math.max(
    1,
    Math.min(12, Number(params?.divider_thickness) || DEFAULT_DIVIDER_PARAMS.divider_thickness),
  );
  const color = params?.divider_color || DEFAULT_DIVIDER_PARAMS.divider_color;

  return (
    <div
      className={`h-full w-full flex select-none p-0 ${
        isVertical ? 'flex-row items-stretch justify-center' : 'flex-col items-stretch justify-center'
      }`}
    >
      <div
        style={
          isVertical
            ? { width: thickness, height: '100%', minHeight: '100%', backgroundColor: color }
            : { height: thickness, width: '100%', minWidth: '100%', backgroundColor: color }
        }
      />
    </div>
  );
});
