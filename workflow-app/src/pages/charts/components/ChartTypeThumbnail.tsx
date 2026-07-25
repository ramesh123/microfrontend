import { cn } from '@/lib/utils';
import { getChartTypeImage, getChartTypeImageAlt } from '@/pages/Dashboards/utils/chartTypeAssets';

export type ChartTypeThumbnailSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<ChartTypeThumbnailSize, string> = {
  xs: 'h-4 w-4',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-[3.25rem] w-[3.25rem]',
};

type ChartTypeThumbnailProps = {
  vizName?: string | null;
  size?: ChartTypeThumbnailSize;
  className?: string;
  faded?: boolean;
  alt?: string;
};

/** PNG chart-type thumbnail matching the dashboard add-chart picker. */
export function ChartTypeThumbnail({
  vizName,
  size,
  className,
  faded,
  alt,
}: ChartTypeThumbnailProps) {
  const pngSrc = getChartTypeImage(vizName);
  if (!pngSrc) return null;

  return (
    <img
      src={pngSrc}
      alt={alt ?? getChartTypeImageAlt(vizName)}
      className={cn(
        size ? SIZE_CLASSES[size] : 'h-10 w-10',
        'shrink-0 object-contain object-center bg-transparent contrast-[1.1] saturate-[1.2]',
        faded && 'opacity-55',
        className,
      )}
      draggable={false}
    />
  );
}

export function hasChartTypeThumbnail(vizName?: string | null): boolean {
  return getChartTypeImage(vizName) != null;
}
