import { useCallback, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

/** Best-effort CSS hex for legend dots when color comes from amCharts. */
export function am5ColorToCssHex(fill: unknown, fallback = '#888888'): string {
  try {
    if (typeof fill === 'string' && fill.trim()) {
      const t = fill.trim();
      if (t.startsWith('#')) return t;
    }
    const c = am5.color(fill as any) as unknown as { rgb?: number };
    if (typeof c.rgb !== 'number') return fallback;
    return `#${(c.rgb & 0xffffff).toString(16).padStart(6, '0')}`;
  } catch {
    return fallback;
  }
}

export type ChartDomScrollLegendItem = {
  id: string | number;
  line: string;
  color: string;
  /** Category / slice name (side-detailed layout). */
  label?: string;
  /** Value and percentage line, e.g. "1,842 (74.1%)". */
  valueLine?: string;
};

type ChartDomScrollLegendProps = {
  items: ChartDomScrollLegendItem[];
  visible: boolean;
  orientation?: 'left' | 'right' | 'top' | 'bottom';
  /** Side-detailed: dot + label + value line (pie/donut). */
  variant?: 'default' | 'side-detailed';
};

/**
 * Legend strip with Previous/Next paging (for horizontal top/bottom) or vertical list (for left/right).
 * Use when the in-chart amCharts legend is hidden to avoid clipping long rows.
 */
export function ChartDomScrollLegend({
  items,
  visible,
  orientation = 'bottom',
  variant = 'default',
}: ChartDomScrollLegendProps) {
  const legendScrollRef = useRef<HTMLDivElement>(null);

  const scrollPrev = useCallback(() => {
    try {
      const el = legendScrollRef.current;
      if (!el) return;
      const w = el.clientWidth;
      el.scrollBy({ left: -Math.max(120, Math.floor(w * 0.88)), behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  }, []);

  const scrollNext = useCallback(() => {
    try {
      const el = legendScrollRef.current;
      if (!el) return;
      const w = el.clientWidth;
      el.scrollBy({ left: Math.max(120, Math.floor(w * 0.88)), behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  }, []);

  const scrollUp = useCallback(() => {
    try {
      const el = legendScrollRef.current;
      if (!el) return;
      const h = el.clientHeight;
      el.scrollBy({ top: -Math.max(120, Math.floor(h * 0.88)), behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  }, []);

  const scrollDown = useCallback(() => {
    try {
      const el = legendScrollRef.current;
      if (!el) return;
      const h = el.clientHeight;
      el.scrollBy({ top: Math.max(120, Math.floor(h * 0.88)), behavior: 'smooth' });
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible || !items.length) return null;

  const isVertical = orientation === 'left' || orientation === 'right';
  const useSideDetailed = variant === 'side-detailed' && isVertical;

  if (useSideDetailed) {
    return (
      <div
        className="flex shrink-0 min-h-0 w-[min(11rem,34%)] max-w-[11rem] flex-col justify-center gap-4 overflow-y-auto px-3 py-2"
      >
        {items.map((row) => (
          <div key={row.id} className="flex min-w-0 items-start gap-2.5" title={row.line}>
            <span
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/40"
              style={{ backgroundColor: row.color }}
            />
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="truncate text-xs font-normal text-foreground leading-tight">
                {row.label ?? row.line}
              </span>
              {row.valueLine ? (
                <span className="text-xs text-muted-foreground leading-tight">{row.valueLine}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isVertical) {
    return (
      <div
        className={`flex flex-col shrink-0 min-h-0 items-center gap-2 bg-card/80 py-3 ${orientation === 'left' ? 'border-r border-border/60' : 'border-l border-border/60'
          }`}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Legend scroll up"
          onClick={scrollUp}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <div
          ref={legendScrollRef}
          className="flex flex-col items-center gap-y-6 overflow-y-auto overflow-x-hidden w-8 flex-1 min-h-0 scroll-smooth py-2 [scrollbar-width:none]"
        >
          {items.map((row) => (
            <div
              key={row.id}
              className="flex flex-col items-center gap-2 min-w-0"
              title={row.line}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/40"
                style={{ backgroundColor: row.color }}
              />
              <span
                className="text-[11px] text-foreground font-medium whitespace-nowrap"
                style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                {row.line}
              </span>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Legend scroll down"
          onClick={scrollDown}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex w-full max-w-full shrink-0 items-center gap-2 bg-card/80 px-2 pt-0 pb-0 ${orientation === 'top' ? 'border-b border-border/60' : 'border-t border-border/60'
      }`}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-6 w-6 shrink-0"
        aria-label="Legend previous"
        onClick={scrollPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div
        ref={legendScrollRef}
        className="flex min-h-7 mt-1 min-w-0 flex-1 items-center gap-x-4 gap-y-1 overflow-x-auto overflow-y-hidden scroll-smooth px-1 py-0.5 [scrollbar-width:thin]"
      >
        {items.map((row) => (
          <div
            key={row.id}
            className="inline-flex max-w-[min(100%,22rem)] shrink-0 items-center gap-2 whitespace-nowrap"
            title={row.line}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/40"
              style={{ backgroundColor: row.color }}
            />
            <span className="truncate text-xs text-foreground">{row.line}</span>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-6 w-6 shrink-0"
        aria-label="Legend next"
        onClick={scrollNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
