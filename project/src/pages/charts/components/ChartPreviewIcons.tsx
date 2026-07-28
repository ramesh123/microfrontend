import type { SVGProps } from 'react';

type ChartPreviewProps = SVGProps<SVGSVGElement> & {
  className?: string;
};

/** Nightingale / variable-radius rose chart — equal angles, radius encodes value. */
export const RadiusPiePreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <line x1="28" y1="28" x2="37" y2="12.41" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.12" />
      <line x1="28" y1="28" x2="46" y2="28" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.12" />
      <line x1="28" y1="28" x2="37" y2="43.59" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.12" />
      <line x1="28" y1="28" x2="19" y2="43.59" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.12" />
      <line x1="28" y1="28" x2="10" y2="28" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.12" />
      <line x1="28" y1="28" x2="19" y2="12.41" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.12" />
      <path d="M 28 28 L 37.01 13.58 A 17 17 0 0 1 44.99 27.41 Z" fill="currentColor" opacity="1" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 28 28 L 42.49 28.51 A 14.5 14.5 0 0 1 35.68 40.30 Z" fill="currentColor" opacity="0.75" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 28 28 L 33.63 38.60 A 12 12 0 0 1 22.37 38.60 Z" fill="currentColor" opacity="0.55" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 28 28 L 22.70 36.48 A 10 10 0 0 1 18.01 28.35 Z" fill="currentColor" opacity="0.4" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 28 28 L 20.00 27.72 A 8 8 0 0 1 23.76 21.22 Z" fill="currentColor" opacity="0.28" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 28 28 L 25.18 22.70 A 6 6 0 0 1 30.82 22.70 Z" fill="currentColor" opacity="0.16" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  </svg>
);

export const PiePreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <circle cx="28" cy="28" r="18" fill="currentColor" opacity="0.28" />
      <path d="M28 28 L46 28 A18 18 0 0 1 19 43.588 Z" fill="currentColor" opacity="1" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 28 L19 43.588 A18 18 0 0 1 19 12.412 Z" fill="currentColor" opacity="0.6" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 28 L19 12.412 A18 18 0 0 1 46 28 Z" fill="currentColor" opacity="0.28" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  </svg>
);

export const DonutPreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <circle cx="28" cy="28" r="18" fill="currentColor" opacity="0.28" />
      <path d="M28 28 L46 28 A18 18 0 0 1 19 43.588 Z" fill="currentColor" opacity="1" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 28 L19 43.588 A18 18 0 0 1 19 12.412 Z" fill="currentColor" opacity="0.6" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 28 L19 12.412 A18 18 0 0 1 46 28 Z" fill="currentColor" opacity="0.28" stroke="var(--background)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="28" cy="28" r="7" fill="var(--background)" />
    </g>
  </svg>
);

export const SunburstPreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <g transform="translate(0,0)">
        <circle cx="28" cy="28" r="18" fill="none" stroke="currentColor" strokeWidth="8" strokeOpacity="0.18" strokeLinecap="butt" strokeDasharray="40 20" strokeDashoffset="0" />
        <circle cx="28" cy="28" r="18" fill="none" stroke="currentColor" strokeWidth="8" strokeOpacity="0.9" strokeLinecap="butt" strokeDasharray="20 40" strokeDashoffset="14" />
      </g>
      <g>
        <circle cx="28" cy="28" r="11" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.6" strokeDasharray="28 18" strokeDashoffset="6" strokeLinecap="butt" />
        <circle cx="28" cy="28" r="11" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.3" strokeDasharray="18 28" strokeDashoffset="0" strokeLinecap="butt" />
      </g>
      <g>
        <circle cx="28" cy="28" r="6" fill="var(--background)" />
        <circle cx="28" cy="28" r="4" fill="currentColor" opacity="1" />
      </g>
    </g>
  </svg>
);

export const FunnelPreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <path d="M12 12 L44 12 L36 24 L20 24 Z" fill="currentColor" opacity="0.28" />
      <path d="M16 24 L40 24 L34 34 L22 34 Z" fill="currentColor" opacity="0.6" />
      <path d="M20 34 L36 34 L32 44 L24 44 Z" fill="currentColor" opacity="1" />
      <rect x="22" y="46" width="12" height="4" fill="currentColor" opacity="1" rx="1" />
    </g>
  </svg>
);

export const GaugePreview = ({ className = 'size-10 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <path d="M4 34 A24 24 0 0 1 52 34" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.18" strokeLinecap="round" />
      <path d="M10 34 A18 18 0 0 1 46 34" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="0.6" strokeLinecap="round" />
      <path d="M16 34 A12 12 0 0 1 40 34" fill="none" stroke="currentColor" strokeWidth="6" strokeOpacity="1" strokeLinecap="round" />
    </g>
  </svg>
);

export const AreaPreview = ({ className = 'size-10 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <path d="M6 42 L12 38 L20 40 L28 30 L36 34 L44 32 L50 36 L50 46 L6 46 Z" fill="currentColor" opacity="0.16" />
      <path d="M6 42 L12 38 L20 40 L28 30 L36 34 L44 32 L50 36 L50 46 L6 46 Z" fill="currentColor" opacity="0.36" transform="translate(0,-3)" />
      <path d="M6 42 L12 38 L20 40 L28 30 L36 34 L44 32 L50 36 L50 46 L6 46 Z" fill="currentColor" opacity="1" transform="translate(0,-6)" />
    </g>
  </svg>
);

export const LinePreview = ({ className = 'size-10 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <path d="M6 42 L14 40 L22 42 L30 34 L38 38 L46 36 L50 40" fill="none" stroke="currentColor" strokeWidth="4" strokeOpacity="0.12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 38 L14 36 L22 38 L30 30 L38 34 L46 32 L50 36" fill="none" stroke="currentColor" strokeWidth="3" strokeOpacity="0.36" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 34 L14 32 L22 34 L30 26 L38 30 L46 28 L50 32" fill="none" stroke="currentColor" strokeWidth="3" strokeOpacity="0.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 40 L14 38 L22 40 L30 32 L38 36 L46 34 L50 38" fill="none" stroke="currentColor" strokeWidth="4" strokeOpacity="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 44 L50 44" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.08" strokeLinecap="round" />
    </g>
  </svg>
);

export const BigNumberPreview = ({ className = 'size-10 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <text x="28" y="18" textAnchor="middle" fill="currentColor" opacity="0.6" fontSize="6" fontWeight={600} style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
        TOTAL
      </text>
      <text x="28" y="38" textAnchor="middle" fill="currentColor" fontSize="14" fontWeight={700} style={{ fontFamily: 'Inter, Arial, sans-serif' }}>
        12,345
      </text>
    </g>
  </svg>
);

export const TablePreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <rect x="8" y="10" width="40" height="6" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="8" y="20" width="40" height="6" rx="1" fill="currentColor" opacity="0.28" />
      <rect x="8" y="28" width="40" height="6" rx="1" fill="currentColor" opacity="0.16" />
    </g>
  </svg>
);

export const PivotTablePreview = ({ className = 'size-9 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <rect x="8" y="10" width="14" height="6" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="26" y="10" width="22" height="6" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="8" y="20" width="12" height="6" rx="1" fill="currentColor" opacity="0.36" />
      <rect x="8" y="28" width="12" height="6" rx="1" fill="currentColor" opacity="0.16" />
      <rect x="22" y="20" width="12" height="6" rx="1" fill="currentColor" opacity="1" />
      <rect x="36" y="20" width="12" height="6" rx="1" fill="currentColor" opacity="0.36" />
      <rect x="22" y="28" width="12" height="6" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="36" y="28" width="12" height="6" rx="1" fill="currentColor" opacity="0.16" />
    </g>
  </svg>
);

export const BarPreview = ({ className = 'size-10 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <rect x="8" y="34" width="8" height="12" rx="1" fill="currentColor" opacity="0.12" />
      <rect x="20" y="18" width="8" height="28" rx="1" fill="currentColor" opacity="0.12" />
      <rect x="32" y="26" width="8" height="20" rx="1" fill="currentColor" opacity="0.12" />
      <rect x="8" y="36" width="8" height="10" rx="1" fill="currentColor" opacity="1" />
      <rect x="20" y="20" width="8" height="26" rx="1" fill="currentColor" opacity="0.9" />
      <rect x="32" y="28" width="8" height="18" rx="1" fill="currentColor" opacity="0.7" />
    </g>
  </svg>
);

export const StackedBarPreview = ({ className = 'size-10 shrink-0', ...props }: ChartPreviewProps) => (
  <svg viewBox="0 0 56 56" preserveAspectRatio="xMidYMid meet" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
    <rect x="0.5" y="0.5" width="55" height="55" rx="2" fill="none" stroke="none" />
    <g>
      <rect x="8" y="30" width="8" height="8" rx="1" fill="currentColor" opacity="1" />
      <rect x="8" y="38" width="8" height="6" rx="1" fill="currentColor" opacity="0.36" />
      <rect x="20" y="22" width="8" height="14" rx="1" fill="currentColor" opacity="1" />
      <rect x="20" y="36" width="8" height="8" rx="1" fill="currentColor" opacity="0.36" />
      <rect x="32" y="26" width="8" height="12" rx="1" fill="currentColor" opacity="1" />
      <rect x="32" y="38" width="8" height="6" rx="1" fill="currentColor" opacity="0.36" />
    </g>
  </svg>
);

/**
 * Returns the appropriate chart preview SVG component for a given chart key/name.
 * Falls back to `null` if no match is found.
 */
export function getChartPreviewIcon(key: string, name?: string): React.ComponentType<ChartPreviewProps> | null {
  const k = (key || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (/sunburst/.test(k) || /sunburst/.test(n)) return SunburstPreview;
  if (/big_number_stream|big number stream/.test(k) || /big number stream/.test(n)) return BigNumberPreview;
  // Gauge before generic big/kpi/number — `gauge_big` contains "big" but is a gauge chart.
  if (/semi|gauge|semi-circle|gauge_big/.test(k) || /gauge/.test(n)) return GaugePreview;
  if (/big|kpi|number/.test(k) || /big|kpi|number/.test(n)) return BigNumberPreview;
  if (/pivot/.test(k) || /pivot/.test(n)) return PivotTablePreview;
  if (/table|grid/.test(k) || /table|grid/.test(n)) return TablePreview;
  if (/stack|stacked/.test(k) || /stacked/.test(n)) return StackedBarPreview;
  if (/bar|column/.test(k) || /bar/.test(n)) return BarPreview;
  if (/area/.test(k) || /area/.test(n)) return AreaPreview;
  if (/line/.test(k) || /line/.test(n)) return LinePreview;
  if (/funnel/.test(k) || /funnel/.test(n)) return FunnelPreview;
  if (/donut/.test(k) || /donut/.test(n)) return DonutPreview;
  if (/radius.*pie|rad_pie|radius_pie|radarpie|radar.*pie/.test(k) || /radius.*pie|radar.*pie/.test(n)) return RadiusPiePreview;
  if (/pie/.test(k) || /pie/.test(n)) return PiePreview;

  return null;
}
