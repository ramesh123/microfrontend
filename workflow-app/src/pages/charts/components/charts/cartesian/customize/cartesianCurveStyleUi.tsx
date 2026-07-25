import { cn } from '@/lib/utils';
import { isThemeDarkAppearance, useTheme } from '@/context/theme';
import {
  CartesianCustomizeFieldRow,
  type CartesianCustomizeSectionProps,
} from './cartesianCustomizeShared';
import type { CartesianCustomizationOptions } from './cartesianCustomizeTypes';

export type CartesianCurveStyle = 'smooth' | 'linear';

const CURVE_OPTIONS: Array<{
  value: CartesianCurveStyle;
  title: string;
  description: string;
}> = [
  {
    value: 'smooth',
    title: 'Smooth curve',
    description: 'Rounded spline through points.',
  },
  {
    value: 'linear',
    title: 'Point-to-point curve',
    description: 'Straight segments between values.',
  },
];

export function resolveCartesianCurveStyle(
  options: {
    areaCurveStyle?: CartesianCurveStyle;
    lineCurveStyle?: CartesianCurveStyle;
    areaFillStyle?: 'gradient' | 'columnar';
  },
  styleKey: 'areaCurveStyle' | 'lineCurveStyle',
): CartesianCurveStyle {
  const explicit = options[styleKey];
  if (explicit === 'smooth' || explicit === 'linear') return explicit;
  if (styleKey === 'areaCurveStyle' && options.areaFillStyle === 'columnar') return 'linear';
  return 'smooth';
}

function CurveStylePreview({
  style,
  variant,
}: {
  style: CartesianCurveStyle;
  variant: 'area' | 'line';
}) {
  const { theme } = useTheme();
  const isDark = isThemeDarkAppearance(theme);
  const linePath =
    style === 'linear'
      ? 'M4 28 L16 22 L28 24 L40 16 L52 20 L64 14 L76 18'
      : 'M4 28 C16 20, 24 24, 36 16 S54 22, 76 14';

  const palette = isDark
    ? {
        canvasClass: 'border-border/50 bg-muted/70',
        accent: '#4ade80',
        accentStroke: '#22c55e',
        fillTop: 0.42,
        fillBottom: 0.08,
        crosshair: '#94a3b8',
        markerStroke: '#18181b',
      }
    : {
        canvasClass: 'border-border/40 bg-emerald-50/90',
        accent: '#22c55e',
        accentStroke: '#16a34a',
        fillTop: 0.45,
        fillBottom: 0.06,
        crosshair: '#94a3b8',
        markerStroke: '#ffffff',
      };

  const gradientId = `cartesian-curve-preview-${variant}-${style}-${isDark ? 'dark' : 'light'}`;

  return (
    <div className={cn('overflow-hidden rounded-md border', palette.canvasClass)}>
      <svg viewBox="0 0 80 40" className="h-10 w-full" aria-hidden>
        {variant === 'area' ? (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.accent} stopOpacity={palette.fillTop} />
              <stop offset="100%" stopColor={palette.accent} stopOpacity={palette.fillBottom} />
            </linearGradient>
          </defs>
        ) : null}
        {variant === 'area' ? (
          <path d={`${linePath} L76 36 L4 36 Z`} fill={`url(#${gradientId})`} />
        ) : null}
        <path d={linePath} fill="none" stroke={palette.accentStroke} strokeWidth="2" />
        <line
          x1="42"
          y1="4"
          x2="42"
          y2="36"
          stroke={palette.crosshair}
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <circle
          cx="42"
          cy="16"
          r="3"
          fill={palette.accentStroke}
          stroke={palette.markerStroke}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}

type CurveStyleFieldProps<T extends CartesianCustomizationOptions> = CartesianCustomizeSectionProps<T> & {
  styleKey: 'areaCurveStyle' | 'lineCurveStyle';
  variant: 'area' | 'line';
  onSelect: (value: CartesianCurveStyle) => void;
  value: CartesianCurveStyle;
};

export function CartesianCurveStyleCustomizeField<T extends CartesianCustomizationOptions>({
  styleKey,
  variant,
  value,
  onSelect,
}: CurveStyleFieldProps<T>) {
  return (
    <CartesianCustomizeFieldRow label="Curve style">
      <div className="grid grid-cols-2 gap-2">
        {CURVE_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={`${styleKey}-${option.value}`}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                'rounded-md border px-2 py-2 text-left transition-colors',
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border bg-muted/30 hover:border-border/80 hover:bg-muted/50',
              )}
            >
              <CurveStylePreview style={option.value} variant={variant} />
              <div className="mt-1.5 text-xs font-semibold text-foreground">{option.title}</div>
              <div className="text-[10px] leading-snug text-muted-foreground">{option.description}</div>
            </button>
          );
        })}
      </div>
    </CartesianCustomizeFieldRow>
  );
}
