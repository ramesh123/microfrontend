import * as React from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { BigNumberCustomizeToggleRow } from './bigNumberCustomizeShared';
import { ColorPickerPopover } from '@/pages/WidgetsLibrary/ColorPickerPopover';
import { BigNumberKpiIcon } from '../components/BigNumberKpiIcon';
import {
  DEFAULT_KPI_ICON_SIZE_PX,
  hasKpiIconSource,
  MAX_KPI_ICON_SIZE_PX,
  MIN_KPI_ICON_SIZE_PX,
  resolveKpiIconSizePx,
} from '../utils/bigNumberKpiIconUtils';
import { isSvgSource, svgTextToDataUrl } from '../utils/svgIconColorUtils';
import {
  DEFAULT_FREE_ICON_X,
  DEFAULT_FREE_ICON_Y,
  gridPositionToFreePercent,
} from '../utils/bigNumberFreeIconPosition';
import type { BigNumberCustomizationOptions } from './BigNumberCustmizechart';
import {
  BIG_NUMBER_ELEMENT_POSITION_OPTIONS,
  DEFAULT_HEADER_POSITION,
  DEFAULT_ICON_POSITION,
  DEFAULT_VALUE_POSITION,
  type BigNumberElementPosition,
} from '../utils/bigNumberStreamLayout';

const MAX_ICON_FILE_BYTES = 2 * 1024 * 1024;
const ICON_UPLOAD_ACCEPT = '.svg,image/svg+xml,image/png,image/jpeg,image/jpg,image/webp,image/gif';

function PositionSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: BigNumberElementPosition;
  onChange: (v: BigNumberElementPosition) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as BigNumberElementPosition)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full !h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BIG_NUMBER_ELEMENT_POSITION_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function isSvgUploadFile(file: File): boolean {
  if (file.type === 'image/svg+xml') return true;
  return file.name.toLowerCase().endsWith('.svg');
}

function isRasterUploadFile(file: File): boolean {
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'].includes(file.type);
}

export function BigNumberIconCustomizeSection({
  options,
  onOptionsChange,
}: {
  options: BigNumberCustomizationOptions;
  onOptionsChange: (next: BigNumberCustomizationOptions) => void;
}) {
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [isIconColorPickerOpen, setIsIconColorPickerOpen] = React.useState(false);
  const iconInputRef = React.useRef<HTMLInputElement>(null);

  const update = <K extends keyof BigNumberCustomizationOptions>(
    key: K,
    value: BigNumberCustomizationOptions[K],
  ) => {
    onOptionsChange({ ...(options || {}), [key]: value });
  };

  const handleIconUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setUploadError(null);
    if (!file) return;

    const isSvg = isSvgUploadFile(file);
    const isRaster = isRasterUploadFile(file);
    if (!isSvg && !isRaster) {
      setUploadError('Upload an SVG or image (PNG, JPG, WebP, GIF).');
      return;
    }

    if (file.size > MAX_ICON_FILE_BYTES) {
      setUploadError('File must be 2 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setUploadError('Could not read icon file.');

    if (isSvg) {
      reader.onload = () => {
        const text = String(reader.result || '');
        if (!/<svg[\s>]/i.test(text)) {
          setUploadError('Invalid SVG file.');
          return;
        }
        onOptionsChange({
          ...(options || {}),
          iconSvg: svgTextToDataUrl(text),
          iconSizePx: options.iconSizePx ?? DEFAULT_KPI_ICON_SIZE_PX,
          iconPositionX: options.iconPositionX ?? DEFAULT_FREE_ICON_X,
          iconPositionY: options.iconPositionY ?? DEFAULT_FREE_ICON_Y,
        });
      };
      reader.readAsText(file);
      return;
    }

    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        setUploadError('Invalid image file.');
        return;
      }
      onOptionsChange({
        ...(options || {}),
        iconSvg: dataUrl,
        iconSvgColor: '',
        iconSizePx: options.iconSizePx ?? DEFAULT_KPI_ICON_SIZE_PX,
        iconPositionX: options.iconPositionX ?? DEFAULT_FREE_ICON_X,
        iconPositionY: options.iconPositionY ?? DEFAULT_FREE_ICON_Y,
      });
    };
    reader.readAsDataURL(file);
  };

  const hasIcon = hasKpiIconSource(options.iconSvg);
  const isSvgIcon = isSvgSource(options.iconSvg);
  const iconPickerColor = options.iconSvgColor?.trim() || '#3B82F6';
  const iconSizePx = resolveKpiIconSizePx(options.iconSizePx);

  return (
    <div className="space-y-2">
      <input
        ref={iconInputRef}
        type="file"
        accept={ICON_UPLOAD_ACCEPT}
        className="hidden"
        onChange={handleIconUpload}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="!h-7 gap-1.5"
          onClick={() => iconInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload icon
        </Button>
        {hasIcon ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!h-7 gap-1.5 text-muted-foreground"
            onClick={() =>
              onOptionsChange({
                ...(options || {}),
                iconSvg: '',
                iconSvgColor: '',
              })
            }
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
      {hasIcon ? (
        <div className="space-y-1.5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Icon size</span>
              <span className="text-xs font-mono text-muted-foreground">{iconSizePx}px</span>
            </div>
            <Slider
              value={[iconSizePx]}
              min={MIN_KPI_ICON_SIZE_PX}
              max={MAX_KPI_ICON_SIZE_PX}
              step={2}
              onValueChange={([nextSize]) => update('iconSizePx', nextSize)}
            />
          </div>
          {isSvgIcon ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">Icon colour</span>
              <ColorPickerPopover
                isOpen={isIconColorPickerOpen}
                onOpenChange={setIsIconColorPickerOpen}
                color={iconPickerColor}
                setColor={(nextColor) => update('iconSvgColor', nextColor)}
                previewText="SVG icon"
                label="Icon colour"
                popoverSide="left"
                popoverAlign="end"
              >
                <button
                  type="button"
                  className="flex h-8 items-center gap-2 rounded-md border border-border px-2 hover:bg-muted/40"
                  aria-label="Pick icon colour"
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded border border-border"
                    style={{ backgroundColor: iconPickerColor }}
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    {options.iconSvgColor?.trim() ? iconPickerColor : 'Pick colour'}
                  </span>
                </button>
              </ColorPickerPopover>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Uploaded images keep their original colours. Use an SVG to tint the icon.
            </p>
          )}
          <div className="flex items-center gap-2 rounded border border-dashed border-border/70 bg-muted/20 p-2">
            <BigNumberKpiIcon
              source={options.iconSvg!}
              color={options.iconSvgColor}
              sizePx={iconSizePx}
              alt="Uploaded icon preview"
            />
            <span className="text-xs text-muted-foreground">
              Preview — drag the icon on the chart to reposition
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No icon uploaded. SVG or PNG/JPG/WebP/GIF supported.</p>
      )}
    </div>
  );
}

export function BigNumberContentLayoutCustomizeSection({
  options,
  onOptionsChange,
}: {
  options: BigNumberCustomizationOptions;
  onOptionsChange: (next: BigNumberCustomizationOptions) => void;
}) {
  const update = <K extends keyof BigNumberCustomizationOptions>(
    key: K,
    value: BigNumberCustomizationOptions[K],
  ) => {
    onOptionsChange({ ...(options || {}), [key]: value });
  };

  const hasIcon = hasKpiIconSource(options.iconSvg);

  return (
    <div className="space-y-1.5">
      <BigNumberCustomizeToggleRow
        label="Header and value same position"
        checked={options.headerValueSamePosition === true}
        onCheckedChange={(v) => update('headerValueSamePosition', v)}
      />
      <PositionSelect
        label="Icon position"
        value={options.iconPosition ?? DEFAULT_ICON_POSITION}
        onChange={(v) => {
          const { x, y } = gridPositionToFreePercent(v);
          onOptionsChange({
            ...(options || {}),
            iconPosition: v,
            iconPositionX: x,
            iconPositionY: y,
          });
        }}
        disabled={!hasIcon}
      />
      <PositionSelect
        label="Header position"
        value={options.headerPosition ?? DEFAULT_HEADER_POSITION}
        onChange={(v) => update('headerPosition', v)}
      />
      <PositionSelect
        label="Value position"
        value={options.valuePosition ?? DEFAULT_VALUE_POSITION}
        onChange={(v) => update('valuePosition', v)}
        disabled={options.headerValueSamePosition === true}
      />
    </div>
  );
}
