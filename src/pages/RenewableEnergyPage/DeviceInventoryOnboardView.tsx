import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, MapPin, PackagePlus, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  buildOnboardDeviceInventoryPayload,
  getDomainsByLocation,
  getSubDomainOptions,
  onboardDeviceInventory,
  type OnboardDeviceInventoryPcss,
} from '@/controllers/API/energySectorApi';
import { cn } from '@/lib/utils';

export type DeviceInventoryOnboardLocation = {
  name: string;
  location_id: string;
  business_unit?: string;
};

const DEFAULT_PCSS_UNIT = (): OnboardDeviceInventoryPcss => ({
  inverters: [{ smbCount: 1 }],
  transformer: 1,
  ups: 1,
});

type DeviceInventoryOnboardViewProps = {
  location: DeviceInventoryOnboardLocation;
  onBack: () => void;
  onSuccess?: () => void;
};

function parseCount(value: string, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function DeviceInventoryOnboardView({ location, onBack, onSuccess }: DeviceInventoryOnboardViewProps) {
  const locationIdForPayload =
    location.location_id === '—' ? '' : location.location_id.trim();
  const [domain, setDomain] = useState('');
  const [subDomain, setSubDomain] = useState('');
  const [validateAgainstHierarchy, setValidateAgainstHierarchy] = useState(false);
  const [pcssCount, setPcssCount] = useState(1);
  const [pcssUnits, setPcssUnits] = useState<OnboardDeviceInventoryPcss[]>([DEFAULT_PCSS_UNIT()]);
  const [pessTransformer, setPessTransformer] = useState('1');
  const [pessUps, setPessUps] = useState('1');
  const [domainOptions, setDomainOptions] = useState<{ value: string; label: string }[]>([]);
  const [subDomainOptions, setSubDomainOptions] = useState<{ value: string; label: string }[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isLoadingSubDomains, setIsLoadingSubDomains] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingDomains(true);
    setDomain('');
    setSubDomain('');
    setSubDomainOptions([]);
    void getDomainsByLocation(location.name === '—' ? '' : location.name)
      .then((response) => {
        if (!cancelled) setDomainOptions(response.data || []);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Failed to load domains.');
          setDomainOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDomains(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location.name]);

  const loadSubDomains = useCallback(
    async (nextDomain: string) => {
      if (!nextDomain.trim()) {
        setSubDomainOptions([]);
        return;
      }
      setIsLoadingSubDomains(true);
      try {
        const response = await getSubDomainOptions(
          location.name === '—' ? '' : location.name,
          nextDomain,
        );
        setSubDomainOptions(response.data || []);
      } catch {
        toast.error('Failed to load sub domains.');
        setSubDomainOptions([]);
      } finally {
        setIsLoadingSubDomains(false);
      }
    },
    [location.name],
  );

  const syncPcssUnits = (count: number) => {
    setPcssUnits((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      const next = [...prev];
      while (next.length < count) next.push(DEFAULT_PCSS_UNIT());
      return next;
    });
  };

  const handlePcssCountChange = (value: string) => {
    const count = Math.max(1, Math.min(20, parseCount(value, 1) || 1));
    setPcssCount(count);
    syncPcssUnits(count);
  };

  const updatePcssUnit = (index: number, patch: Partial<OnboardDeviceInventoryPcss>) => {
    setPcssUnits((prev) =>
      prev.map((unit, i) => (i === index ? { ...unit, ...patch } : unit)),
    );
  };

  const addInverter = (pcssIndex: number) => {
    setPcssUnits((prev) =>
      prev.map((unit, i) =>
        i === pcssIndex ? { ...unit, inverters: [...unit.inverters, { smbCount: 1 }] } : unit,
      ),
    );
  };

  const removeInverter = (pcssIndex: number, inverterIndex: number) => {
    setPcssUnits((prev) =>
      prev.map((unit, i) => {
        if (i !== pcssIndex || unit.inverters.length <= 1) return unit;
        return {
          ...unit,
          inverters: unit.inverters.filter((_, j) => j !== inverterIndex),
        };
      }),
    );
  };

  const updateInverterSmb = (pcssIndex: number, inverterIndex: number, smbCount: string) => {
    setPcssUnits((prev) =>
      prev.map((unit, i) => {
        if (i !== pcssIndex) return unit;
        return {
          ...unit,
          inverters: unit.inverters.map((inv, j) =>
            j === inverterIndex ? { smbCount: parseCount(smbCount, 0) } : inv,
          ),
        };
      }),
    );
  };

  const handleSubmit = async () => {
    if (!domain.trim() || !subDomain.trim() || !locationIdForPayload) {
      toast.error('Domain, subdomain, and location ID are required.');
      return;
    }

    const payload = buildOnboardDeviceInventoryPayload({
      domain,
      locationId: locationIdForPayload,
      subDomain,
      validateAgainstHierarchy,
      pcssCount,
      pcssUnits,
      pess: {
        transformer: parseCount(pessTransformer, 0),
        ups: parseCount(pessUps, 0),
      },
    });

    setSubmitting(true);
    try {
      await onboardDeviceInventory(payload);
      toast.success('Device inventory onboarded successfully.');
      onSuccess?.();
      onBack();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to onboard device inventory.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="border-b bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground">Onboard Device Inventory</h3>
              <p className="mt-0.5 text-xs leading-tight text-muted-foreground">
                Register PCSS units, inverters, and site-level PESS counts for this location.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={onBack}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Location</p>
              <p className="truncate text-sm font-semibold text-foreground">{location.name}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[11px] font-medium text-foreground">{location.location_id}</p>
              {location.business_unit && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">{location.business_unit}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-foreground">Scope</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold">
                  Location ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={locationIdForPayload}
                  readOnly
                  className="h-9 bg-muted/50 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Domain <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  value={domain}
                  onChange={(val) => {
                    const next = String(val);
                    setDomain(next);
                    setSubDomain('');
                    setSubDomainOptions([]);
                    void loadSubDomains(next);
                  }}
                  options={domainOptions}
                  placeholder="Select a domain"
                  searchPlaceholder="Search domains..."
                  isLoading={isLoadingDomains}
                  emptyText="No domains found."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Sub domain <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  value={subDomain}
                  onChange={(val) => setSubDomain(String(val))}
                  options={subDomainOptions}
                  placeholder={domain ? 'Select a subdomain' : 'Select a domain first'}
                  searchPlaceholder="Search subdomains..."
                  disabled={!domain}
                  isLoading={isLoadingSubDomains}
                  emptyText="No subdomains found."
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id="validate-hierarchy"
                  checked={validateAgainstHierarchy}
                  onCheckedChange={(checked) => setValidateAgainstHierarchy(checked === true)}
                />
                <Label htmlFor="validate-hierarchy" className="cursor-pointer text-xs font-medium">
                  Validate against hierarchy
                </Label>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-foreground">PCSS units</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Configure each PCSS block (pcss1, pcss2, …) with inverters and counts.
                </p>
              </div>
              <div className="w-28 space-y-1.5">
                <Label className="text-xs font-semibold">PCSS count</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={pcssCount}
                  onChange={(e) => handlePcssCountChange(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {pcssUnits.slice(0, pcssCount).map((unit, pcssIndex) => (
                <div key={pcssIndex} className="rounded-lg border bg-muted/20 p-3">
                  <h5 className="text-xs font-bold uppercase tracking-wide text-primary">
                    pcss{pcssIndex + 1}
                  </h5>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Transformer</Label>
                      <Input
                        type="number"
                        min={0}
                        value={unit.transformer}
                        onChange={(e) =>
                          updatePcssUnit(pcssIndex, { transformer: parseCount(e.target.value, 0) })
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">UPS</Label>
                      <Input
                        type="number"
                        min={0}
                        value={unit.ups}
                        onChange={(e) => updatePcssUnit(pcssIndex, { ups: parseCount(e.target.value, 0) })}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold">Inverters (SMB count)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => addInverter(pcssIndex)}
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        Add inverter
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {unit.inverters.map((inv, invIndex) => (
                        <div key={invIndex} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-[11px] font-medium text-muted-foreground">
                            Unit {invIndex + 1}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            value={inv.smbCount}
                            onChange={(e) => updateInverterSmb(pcssIndex, invIndex, e.target.value)}
                            className="h-8 flex-1"
                            placeholder="smbCount"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={unit.inverters.length <= 1}
                            onClick={() => removeInverter(pcssIndex, invIndex)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-foreground">PESS (site level)</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Transformer</Label>
                <Input
                  type="number"
                  min={0}
                  value={pessTransformer}
                  onChange={(e) => setPessTransformer(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">UPS</Label>
                <Input
                  type="number"
                  min={0}
                  value={pessUps}
                  onChange={(e) => setPessUps(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t pt-2">
            <Button type="button" variant="outline" className="h-9" onClick={onBack} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              className={cn('h-9 min-w-[140px]', submitting && 'pointer-events-none')}
              disabled={submitting || !domain || !subDomain || !locationIdForPayload}
              onClick={() => void handleSubmit()}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Onboard inventory'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
