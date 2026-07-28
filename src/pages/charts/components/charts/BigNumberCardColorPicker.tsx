import { useState, useRef, useCallback, useEffect } from 'react';
import { Pipette } from 'lucide-react';
import { isValidHexColor } from './bigNumber/utils/bigNumberCardColors';

export type BigNumberCardColorPickerProps = {
  cardColorScheme?: string;
  cardBackgroundColor?: string;
  onChange: (next: { cardColorScheme: string; cardBackgroundColor?: string }) => void;
  className?: string;
  label?: string;
};

const CUSTOM_VALUE = 'custom';
const DEFAULT_HEX = '#f1f5f9';

// ---------- color math ----------
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    '#' +
    [r, g, b]
      .map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s: s * 100, v: v * 100 };
}

function hsvToRgb(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

type HSV = { h: number; s: number; v: number };

function hexToHsv(hex?: string | null): HSV {
  if (!hex || !isValidHexColor(hex)) {
    const { r, g, b } = hexToRgb(DEFAULT_HEX);
    return rgbToHsv(r, g, b);
  }
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

function hsvToHex(hsv: HSV): string {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  return rgbToHex(r, g, b);
}

export default function BigNumberCardColorPicker({
  cardColorScheme = 'theme',
  cardBackgroundColor,
  onChange,
  className = '',
  label = 'Custom Color',
}: BigNumberCardColorPickerProps) {
  const isCustomActive = cardColorScheme === CUSTOM_VALUE;
  const currentHex = isCustomActive && cardBackgroundColor ? cardBackgroundColor : DEFAULT_HEX;

  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(currentHex));
  const [hexInput, setHexInput] = useState(currentHex);

  const containerRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ type: 'square' | 'hue'; rect: DOMRect } | null>(null);

  // sync local state whenever the applied color changes from outside
  useEffect(() => {
    setHsv(hexToHsv(currentHex));
    setHexInput(currentHex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHex]);

  // close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const commit = useCallback(
    (next: HSV) => {
      const hex = hsvToHex(next);
      setHexInput(hex);
      onChange({ cardColorScheme: CUSTOM_VALUE, cardBackgroundColor: hex });
    },
    [onChange],
  );

  const updateFromSquare = (clientX: number, clientY: number, rect: DOMRect) => {
    const x = clamp(clientX - rect.left, 0, rect.width);
    const y = clamp(clientY - rect.top, 0, rect.height);
    const s = (x / rect.width) * 100;
    const v = 100 - (y / rect.height) * 100;
    setHsv((prev) => {
      const next = { ...prev, s, v };
      commit(next);
      return next;
    });
  };

  const updateFromHue = (clientX: number, rect: DOMRect) => {
    const x = clamp(clientX - rect.left, 0, rect.width);
    const h = (x / rect.width) * 360;
    setHsv((prev) => {
      const next = { ...prev, h };
      commit(next);
      return next;
    });
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === 'square') updateFromSquare(e.clientX, e.clientY, drag.rect);
    else updateFromHue(e.clientX, drag.rect);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  const beginDrag = (type: 'square' | 'hue', rect: DOMRect, clientX: number, clientY: number) => {
    dragRef.current = { type, rect };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    if (type === 'square') updateFromSquare(clientX, clientY, rect);
    else updateFromHue(clientX, rect);
  };

  const handleHexTextChange = (raw: string) => {
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    setHexInput(hex);
    if (isValidHexColor(hex)) {
      const next = hexToHsv(hex);
      setHsv(next);
      onChange({ cardColorScheme: CUSTOM_VALUE, cardBackgroundColor: hex });
    }
  };

  const handleRgbChange = (channel: 'r' | 'g' | 'b', raw: string) => {
    const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
    const rgb = { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    const n = clamp(Number(raw) || 0, 0, 255);
    rgb[channel] = n;
    const next = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHsv(next);
    commit(next);
  };

  const handleEyedropper = async () => {
    const EyeDropperCtor = (window as any).EyeDropper;
    if (!EyeDropperCtor) return;
    try {
      const result = await new EyeDropperCtor().open();
      if (result?.sRGBHex) {
        const next = hexToHsv(result.sRGBHex);
        setHsv(next);
        commit(next);
      }
    } catch {
      /* user cancelled */
    }
  };

  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const rgb = { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  const solidHueHex = hsvToHex({ h: hsv.h, s: 100, v: 100 });

  return (
    <div className={className}>
      <div className="text-sm font-semibold text-slate-800 mb-2">{label}</div>

      <div ref={containerRef} className="relative flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="h-11 w-11 shrink-0 rounded-lg border border-gray-300"
          style={{ background: currentHex }}
          title="Choose custom color"
        />
        <input
          value={hexInput}
          onChange={(e) => handleHexTextChange(e.target.value)}
          className="flex-1 h-11 rounded-lg border border-blue-200 px-3 text-sm font-mono outline-none focus:border-blue-400"
          maxLength={7}
        />

        {isOpen && (
          <div className="absolute z-50 top-full left-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl p-3">
            {/* Saturation / value square */}
            <div
              ref={squareRef}
              className="relative w-full h-36 rounded-lg cursor-crosshair mb-3 select-none"
              style={{
                backgroundImage: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                const rect = squareRef.current!.getBoundingClientRect();
                beginDrag('square', rect, e.clientX, e.clientY);
              }}
            >
              <div
                className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow pointer-events-none"
                style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: solidHueHex }}
              />
            </div>

            {/* Eyedropper + hue */}
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={handleEyedropper}
                disabled={!(typeof window !== 'undefined' && (window as any).EyeDropper)}
                title={
                  typeof window !== 'undefined' && (window as any).EyeDropper
                    ? 'Pick from screen'
                    : 'Not supported in this browser'
                }
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pipette className="h-4 w-4" />
              </button>

              <div
                ref={hueRef}
                className="relative flex-1 h-3 rounded-full cursor-pointer select-none"
                style={{
                  background: 'linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  const rect = hueRef.current!.getBoundingClientRect();
                  beginDrag('hue', rect, e.clientX, e.clientY);
                }}
              >
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow bg-white pointer-events-none"
                  style={{ left: `${(hsv.h / 360) * 100}%` }}
                />
              </div>
            </div>

            {/* R G B */}
            <div className="grid grid-cols-3 gap-2">
              {(['r', 'g', 'b'] as const).map((channel) => (
                <div key={channel} className="flex flex-col items-center gap-1">
                  <input
                    value={rgb[channel]}
                    onChange={(e) => handleRgbChange(channel, e.target.value)}
                    className="w-full text-center text-sm border border-gray-200 rounded py-1.5 outline-none focus:border-blue-400"
                    inputMode="numeric"
                  />
                  <span className="text-xs text-gray-400 uppercase">{channel}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}