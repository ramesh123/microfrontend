import { useState } from 'react';
import { Palette } from 'lucide-react';
import { ColorPickerPopover } from '@/pages/WidgetsLibrary/ColorPickerPopover';
import { normalizeHex } from '@/pages/WidgetsLibrary/colorPickerUtils';
import { cn } from '@/lib/utils';
import {
  DATE_PRESET_COLOR_OPTIONS,
  resolveDatePickerColor,
} from '../../lib/date/form-date.utils';

interface DatePickerColorPaletteProps {
  value?: string;
  onChange: (color: string) => void;
}

interface GlossyColorTileProps {
  color: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}

function GlossyColorTile({ color, label, selected, onClick }: GlossyColorTileProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'group relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-white/60',
        'shadow-[0_2px_8px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.6)]',
        'transition-all duration-150 hover:scale-105 hover:shadow-[0_4px_12px_rgba(15,23,42,0.22)]',
        selected && 'scale-105 ring-2 ring-primary/80 ring-offset-1 ring-offset-background'
      )}
    >
      <span className="absolute inset-0" style={{ backgroundColor: color }} />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-white/15 to-black/10" />
      <span className="pointer-events-none absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-white/40 to-transparent" />
    </button>
  );
}

export function DatePickerColorPalette({ value, onChange }: DatePickerColorPaletteProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const resolved = resolveDatePickerColor(value);
  const isPreset = DATE_PRESET_COLOR_OPTIONS.some(
    (option) => normalizeHex(option.main) === resolved
  );
  const isCustomSelected = !isPreset;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {DATE_PRESET_COLOR_OPTIONS.map((option) => (
          <GlossyColorTile
            key={option.id}
            color={option.main}
            label={option.label}
            selected={normalizeHex(option.main) === resolved}
            onClick={() => onChange(normalizeHex(option.main))}
          />
        ))}

        <ColorPickerPopover
          isOpen={pickerOpen}
          onOpenChange={setPickerOpen}
          color={resolved}
          setColor={(color) => onChange(normalizeHex(color))}
          previewText="Date picker"
          label="Date picker color"
          popoverSide="left"
          popoverAlign="start"
        >
          <button
            type="button"
            title="Custom color"
            aria-label="Open custom color palette"
            aria-pressed={isCustomSelected}
            className={cn(
              'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/60',
              'shadow-[0_2px_8px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.6)]',
              'transition-all duration-150 hover:scale-105 hover:shadow-[0_4px_12px_rgba(15,23,42,0.22)]',
              isCustomSelected && 'scale-105 ring-2 ring-primary/80 ring-offset-1 ring-offset-background'
            )}
          >
            <span className="absolute inset-0" style={{ backgroundColor: resolved }} />
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/55 via-white/15 to-black/10" />
            <Palette className="relative z-10 h-3.5 w-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
          </button>
        </ColorPickerPopover>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-wide text-gray-text-muted">{resolved}</p>
    </div>
  );
}
