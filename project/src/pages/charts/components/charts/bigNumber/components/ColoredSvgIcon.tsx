import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { getSvgDisplayUrl, getSvgMaskUrl, normalizeIconColor } from '../utils/svgIconColorUtils';

type ColoredSvgIconProps = {
  source: string;
  color?: string;
  className?: string;
  alt?: string;
  style?: CSSProperties;
};

/** Renders an SVG icon with optional tint via CSS mask (overrides embedded fills). */
export function ColoredSvgIcon({ source, color, className, alt = '', style }: ColoredSvgIconProps) {
  const displayUrl = useMemo(() => getSvgDisplayUrl(source), [source]);
  const tint = useMemo(() => normalizeIconColor(color), [color]);
  const maskUrl = useMemo(
    () => (tint ? getSvgMaskUrl(source) : displayUrl),
    [source, tint, displayUrl],
  );

  if (!displayUrl) return null;

  if (!tint) {
    return (
      <img
        src={displayUrl}
        alt={alt}
        className={cn(className)}
        style={style}
        aria-hidden={!alt}
      />
    );
  }

  const maskImage = `url("${(maskUrl || displayUrl).replace(/"/g, '\\"')}")`;

  return (
    <div
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt ? true : undefined}
      className={cn(className)}
      style={{
        backgroundColor: tint,
        maskImage,
        WebkitMaskImage: maskImage,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
        ...style,
      }}
    />
  );
}
