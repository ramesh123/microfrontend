import { useEffect, useState, type RefObject } from 'react';
import type { BigNumberCustomizationOptions } from '../customize/BigNumberCustmizechart';
import {
  resolveFreeIconHeaderInsetPx,
  shouldPlaceHeaderBesideFreeIcon,
} from '../utils/bigNumberFreeIconPosition';

/** Reserve horizontal space so the header sits beside a free-drag icon on the left. */
export function useFreeIconHeaderInset(
  options: Pick<
    BigNumberCustomizationOptions,
    'iconSvg' | 'iconPosition' | 'iconPositionX' | 'iconPositionY'
  >,
  surfaceRef: RefObject<HTMLElement | null>,
  iconSizePx: number,
  enabled: boolean,
  contentRef?: RefObject<HTMLElement | null>,
): number {
  const [insetPx, setInsetPx] = useState(0);

  useEffect(() => {
    if (!enabled || !shouldPlaceHeaderBesideFreeIcon(options)) {
      setInsetPx(0);
      return;
    }

    const surface = surfaceRef.current;
    if (!surface || typeof ResizeObserver === 'undefined') {
      setInsetPx(0);
      return;
    }

    const measure = () => {
      const surfaceWidth = surface.getBoundingClientRect().width;
      const contentEl = contentRef?.current;
      const paddingLeft = contentEl
        ? Math.max(0, contentEl.getBoundingClientRect().left - surface.getBoundingClientRect().left)
        : 0;
      setInsetPx(resolveFreeIconHeaderInsetPx(options, surfaceWidth, iconSizePx, paddingLeft));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(surface);
    if (contentRef?.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [
    enabled,
    options.iconSvg,
    options.iconPosition,
    options.iconPositionX,
    options.iconPositionY,
    iconSizePx,
    surfaceRef,
    contentRef,
  ]);

  return insetPx;
}
