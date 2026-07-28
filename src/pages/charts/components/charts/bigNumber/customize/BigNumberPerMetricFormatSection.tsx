import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { BigNumberCustomizationOptions } from '../customize/BigNumberCustmizechart';
import {
  BIG_NUMBER_UNIT_PRESETS,
  type BigNumberMetricDescriptor,
  type BigNumberMetricFormatOptions,
} from '../utils/bigNumberUnitOptions';

function resolveUnitSelectValue(code: string | undefined): string {
  if (!code) return 'inherit';
  if (BIG_NUMBER_UNIT_PRESETS.some((p) => p.value === code && p.value !== 'Custom')) return code;
  return 'Custom';
}

export function BigNumberPerMetricFormatSection({
  options,
  metricDescriptors,
  onOptionsChange,
}: {
  options: BigNumberCustomizationOptions;
  metricDescriptors: BigNumberMetricDescriptor[];
  onOptionsChange: (next: BigNumberCustomizationOptions) => void;
}) {
  if (metricDescriptors.length === 0) return null;

  const getMetricFormat = (descriptor: BigNumberMetricDescriptor): BigNumberMetricFormatOptions =>
    options.metricFormatsByKey?.[descriptor.key] ??
    options.metricFormats?.[descriptor.index] ??
    {};

  const updateMetricFormat = (
    descriptor: BigNumberMetricDescriptor,
    patch: Partial<BigNumberMetricFormatOptions>,
  ) => {
    const current = getMetricFormat(descriptor);
    const nextEntry = { ...current, ...patch };
    const byKey = { ...(options.metricFormatsByKey || {}), [descriptor.key]: nextEntry };
    const arr = [...(options.metricFormats || [])];
    while (arr.length <= descriptor.index) arr.push({});
    arr[descriptor.index] = nextEntry;
    onOptionsChange({ ...(options || {}), metricFormatsByKey: byKey, metricFormats: arr });
  };

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 p-3">
      {metricDescriptors.map((descriptor) => {
        const mf = getMetricFormat(descriptor);
        const unitCode = mf.currencyCode;
        const unitSelectValue = resolveUnitSelectValue(unitCode);

        return (
          <div
            key={descriptor.key}
            className="space-y-2 rounded-md border border-border/50 bg-background/80 p-2.5"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {descriptor.label}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-600">Number format</span>
                <Select
                  value={mf.numberFormat === 'raw' ? 'decimal' : mf.numberFormat || 'inherit'}
                  onValueChange={(v) =>
                    updateMetricFormat(descriptor, {
                      numberFormat:
                        v === 'inherit'
                          ? undefined
                          : (v as BigNumberMetricFormatOptions['numberFormat']),
                    })
                  }
                >
                  <SelectTrigger className="w-full !h-8 text-sm">
                    <SelectValue placeholder="Use global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Use global default</SelectItem>
                    <SelectItem value="adaptive">Adaptive</SelectItem>
                    <SelectItem value="short">Short (K/M/B)</SelectItem>
                    <SelectItem value="full">Full number</SelectItem>
                    <SelectItem value="decimal">Decimal</SelectItem>
                    <SelectItem value="percent">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-600">Font size</span>
                <Select
                  value={mf.fontSize || 'inherit'}
                  onValueChange={(v) =>
                    updateMetricFormat(descriptor, {
                      fontSize:
                        v === 'inherit' ? undefined : (v as BigNumberMetricFormatOptions['fontSize']),
                    })
                  }
                >
                  <SelectTrigger className="w-full !h-8 text-sm">
                    <SelectValue placeholder="Use global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Use global default</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-600">Units format</span>
                <Select
                  value={mf.currencyFormat || 'inherit'}
                  onValueChange={(v) =>
                    updateMetricFormat(descriptor, {
                      currencyFormat:
                        v === 'inherit'
                          ? undefined
                          : (v as BigNumberMetricFormatOptions['currencyFormat']),
                    })
                  }
                >
                  <SelectTrigger className="w-full !h-8 text-sm">
                    <SelectValue placeholder="Use global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Use global default</SelectItem>
                    <SelectItem value="prefix">Prefix</SelectItem>
                    <SelectItem value="suffix">Suffix</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-600">Units</span>
                <Select
                  value={unitSelectValue}
                  onValueChange={(v) => {
                    if (v === 'inherit') updateMetricFormat(descriptor, { currencyCode: undefined });
                    else if (v === 'none') updateMetricFormat(descriptor, { currencyCode: '' });
                    else if (v !== 'Custom') updateMetricFormat(descriptor, { currencyCode: v });
                    else updateMetricFormat(descriptor, { currencyCode: unitCode || '' });
                  }}
                >
                  <SelectTrigger className="w-full !h-8 text-sm">
                    <SelectValue placeholder="Use global" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">Use global default</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                    {BIG_NUMBER_UNIT_PRESETS.filter((p) => p.value !== 'none' && p.value !== 'Custom').map(
                      (preset) => (
                        <SelectItem key={preset.value} value={preset.value}>
                          {preset.label}
                        </SelectItem>
                      ),
                    )}
                    <SelectItem value="Custom">Custom text…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {unitSelectValue === 'Custom' ? (
              <Input
                className="h-8 text-sm"
                placeholder="Custom unit (e.g. MWh, kg CO₂)"
                value={unitCode || ''}
                onChange={(e) => updateMetricFormat(descriptor, { currencyCode: e.target.value })}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
