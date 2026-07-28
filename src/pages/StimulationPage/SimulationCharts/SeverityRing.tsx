import { formatSimulationNumber, SEVERITY_COLORS } from '../simulationTrackDashboardUtils';

const RING_SIZE_DEFAULT = 52;
const RING_SIZE_COMPACT = 30;
const STROKE_DEFAULT = 5;
const STROKE_COMPACT = 3;

type SeverityRingProps = {
  label: string;
  value: number;
  total: number;
  color: string;
  subtitle?: string;
  compact?: boolean;
};

function RingSvg({
  size,
  strokeWidth,
  value,
  color,
  visiblePct,
  dashOffset,
  circumference,
  radius,
}: {
  size: number;
  strokeWidth: number;
  value: number;
  color: string;
  visiblePct: number;
  dashOffset: number;
  circumference: number;
  radius: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
      />
      {value > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      ) : null}
    </svg>
  );
}

export function SeverityRing({ label, value, total, color, subtitle, compact }: SeverityRingProps) {
  const ringSize = compact ? RING_SIZE_COMPACT : RING_SIZE_DEFAULT;
  const strokeWidth = compact ? STROKE_COMPACT : STROKE_DEFAULT;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeTotal = total > 0 ? total : 1;
  const pct = Math.min(100, Math.max(0, (value / safeTotal) * 100));
  const visiblePct = value > 0 ? Math.max(pct, 6) : 0;
  const dashOffset = circumference - (visiblePct / 100) * circumference;

  const defaultSubtitle =
    total > 0 ? `${pct.toFixed(pct >= 10 || pct === 0 ? 0 : 1)}%` : '—';

  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
      <span
        className={
          compact
            ? 'text-xs font-semibold leading-none'
            : 'text-xs font-semibold leading-none'
        }
        style={{ color }}
      >
        {label}
      </span>
      <div
        className="relative rounded-full bg-muted/20 p-px shadow-inner"
        style={{ width: ringSize + 2, height: ringSize + 2 }}
      >
        <RingSvg
          size={ringSize}
          strokeWidth={strokeWidth}
          value={value}
          color={color}
          visiblePct={visiblePct}
          dashOffset={dashOffset}
          circumference={circumference}
          radius={radius}
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            className={
              compact
                ? 'text-[11px] font-bold tabular-nums leading-none text-[#0031a3] dark:text-foreground'
                : 'text-[11px] font-bold tabular-nums leading-none text-[#0031a3] dark:text-foreground'
            }
          >
            {formatSimulationNumber(value)}
          </span>
        </div>
      </div>
      <span
        className={
          compact
            ? 'max-w-[3.5rem] truncate text-[11px] leading-none text-muted-foreground'
            : 'text-[11px] leading-none text-muted-foreground'
        }
      >
        {subtitle ?? defaultSubtitle}
      </span>
    </div>
  );
}

type SeverityRingsRowProps = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  compact?: boolean;
};

const RING_CONFIG = [
  { label: 'Critical', key: 'critical' as const, colorKey: 'critical' as const },
  { label: 'High', key: 'high' as const, colorKey: 'high' as const },
  { label: 'Medium', key: 'medium' as const, colorKey: 'medium' as const },
  { label: 'Low', key: 'low' as const, colorKey: 'low' as const },
] as const;

export function SeverityRingsRow({ critical, high, medium, low, total, compact }: SeverityRingsRowProps) {
  const values = { critical, high, medium, low };

  return (
    <div className="grid grid-cols-4 gap-0.5">
      {RING_CONFIG.map(({ label, key, colorKey }) => (
        <SeverityRing
          key={key}
          label={label}
          value={values[key]}
          total={total}
          color={SEVERITY_COLORS[colorKey]}
          compact={compact}
        />
      ))}
    </div>
  );
}
