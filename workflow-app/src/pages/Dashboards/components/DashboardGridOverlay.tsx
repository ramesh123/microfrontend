import { memo, useMemo } from 'react';
import { getDashboardGridOverlayStyle } from '../utils/dashboardGridOverlay';

interface DashboardGridOverlayProps {
  containerWidth: number;
  highlighted?: boolean;
  /** Stretch grid lines to fill the canvas content area. */
  fillParent?: boolean;
}

export const DashboardGridOverlay = memo(function DashboardGridOverlay({
  containerWidth,
  highlighted = false,
  fillParent = true,
}: DashboardGridOverlayProps) {
  const style = useMemo(
    () =>
      getDashboardGridOverlayStyle(containerWidth, {
        highlighted,
        minHeight: '100%',
      }),
    [containerWidth, highlighted],
  );

  if (containerWidth <= 0) return null;

  return (
    <div
      className={`dashboard-grid-overlay pointer-events-none absolute z-0 transition-[opacity,filter] duration-200 ${
        fillParent ? 'inset-0 h-full w-full' : 'top-0 left-0'
      }`}
      style={{
        ...style,
        width: '100%',
        height: '100%',
        minHeight: '100%',
      }}
      aria-hidden
    />
  );
});
