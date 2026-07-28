import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { ColoredSvgIcon } from './ColoredSvgIcon';
import {
  isRasterImageSource,
  kpiIconSizeStyle,
  resolveKpiIconSizePx,
} from '../utils/bigNumberKpiIconUtils';

type BigNumberKpiIconProps = {
  source: string;
  color?: string;
  sizePx?: number;
  className?: string;
  alt?: string;
  style?: CSSProperties;
};

export function BigNumberKpiIcon({
  source,
  color,
  sizePx,
  className,
  alt,
  style,
}: BigNumberKpiIconProps) {
  const resolvedSizePx = resolveKpiIconSizePx(sizePx);
  const sizeStyle = kpiIconSizeStyle(resolvedSizePx);

  if (isRasterImageSource(source)) {
    return (
      <img
        src={source.trim()}
        alt={alt ?? ''}
        className={cn('shrink-0 object-contain', className)}
        style={{ ...sizeStyle, ...style }}
        aria-hidden={!alt}
      />
    );
  }

  return (
    <ColoredSvgIcon
      source={source}
      color={color}
      className={cn('shrink-0', className)}
      alt={alt}
      style={{ ...sizeStyle, ...style }}
    />
  );
}
