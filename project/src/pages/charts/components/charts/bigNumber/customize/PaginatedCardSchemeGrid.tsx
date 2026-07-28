import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  bigNumberCardColorSchemes,
  buildGlassGradientCss,
  buildShineGradientCss,
  BIG_NUMBER_GLASS_NEUTRAL_GRADIENT,
  type BigNumberCardBackgroundStyle,
  type BigNumberCardColorScheme,
} from '../utils/bigNumberCardColors';

const SCHEMES_PER_PAGE = 8;

function CardSchemeSwatch({
  baseColor,
  selected,
  onClick,
  title,
  backgroundStyle,
}: {
  baseColor: string | null;
  selected: boolean;
  onClick: () => void;
  title: string;
  backgroundStyle: BigNumberCardBackgroundStyle;
}) {
  const style: React.CSSProperties =
    backgroundStyle === 'glass'
      ? baseColor
        ? {
            background: buildGlassGradientCss(baseColor, 135),
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
          }
        : {
            background: BIG_NUMBER_GLASS_NEUTRAL_GRADIENT,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.45)',
          }
      : baseColor
        ? { background: buildShineGradientCss(baseColor, 135) }
        : { background: '#ffffff', border: '1px solid var(--border)' };

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'h-9 w-full rounded-md border-2 transition-shadow',
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50',
      )}
      style={style}
    />
  );
}

export function PaginatedCardSchemeGrid({
  selectedScheme,
  onSelectScheme,
  schemes = bigNumberCardColorSchemes,
  backgroundStyle = 'shine',
}: {
  selectedScheme: string;
  onSelectScheme: (value: string) => void;
  schemes?: BigNumberCardColorScheme[];
  backgroundStyle?: BigNumberCardBackgroundStyle;
}) {
  const totalPages = Math.max(1, Math.ceil(schemes.length / SCHEMES_PER_PAGE));
  const [page, setPage] = React.useState(0);

  React.useEffect(() => {
    const idx = schemes.findIndex((s) => s.value === selectedScheme);
    if (idx >= 0) {
      setPage(Math.floor(idx / SCHEMES_PER_PAGE));
    }
  }, [selectedScheme, schemes]);

  const safePage = Math.min(page, totalPages - 1);
  const pageSchemes = schemes.slice(
    safePage * SCHEMES_PER_PAGE,
    safePage * SCHEMES_PER_PAGE + SCHEMES_PER_PAGE,
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {pageSchemes.map((scheme) => (
          <div key={scheme.value} className="flex flex-col gap-1">
            <CardSchemeSwatch
              baseColor={scheme.baseColor}
              selected={selectedScheme === scheme.value}
              onClick={() => onSelectScheme(scheme.value)}
              title={scheme.name}
              backgroundStyle={backgroundStyle}
            />
            <span className="text-[10px] text-center text-muted-foreground leading-tight truncate px-0.5">
              {scheme.name}
            </span>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7 px-2"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {safePage + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="!h-7 px-2"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
