import { useEffect, useState, type RefObject } from 'react';
import {
  computeBigNumberResponsiveScale,
  type BigNumberResponsiveLayoutMode,
} from '../utils/bigNumberResponsiveScale';

export function useBigNumberContainerScale(
  containerRef: RefObject<HTMLElement | null>,
  mode: BigNumberResponsiveLayoutMode,
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setScale(computeBigNumberResponsiveScale(width, height, mode));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, mode]);

  return scale;
}
