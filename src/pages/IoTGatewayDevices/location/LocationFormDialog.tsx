import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage } from "@/utils/exceptionHelper";
import {
  createLocation,
  getLocationById,
  updateLocation,
  type CreateLocationPayload,
  type LocationRecord,
} from "@/controllers/API/locationsApi";

type LocationFormDialogProps = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required when `mode` is `edit`. */
  locationId?: string | null;
  onCreated?: () => void;
  onUpdated?: () => void;
};

const emptyForm: CreateLocationPayload = {
  name: "",
  description: "",
  location_id: "",
  business_unit: "",
};

export function LocationFormDialog({
  mode,
  open,
  onOpenChange,
  locationId,
  onCreated,
  onUpdated,
}: LocationFormDialogProps) {
  const [form, setForm] = useState<CreateLocationPayload>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState<LocationRecord | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      setLoaded(null);
      setLoading(false);
      setSubmitting(false);
      return;
    }
    if (mode !== "edit" || !locationId?.trim()) {
      setForm(emptyForm);
      setLoaded(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoaded(null);
    void getLocationById(locationId.trim())
      .then((rec) => {
        if (cancelled) return;
        setLoaded(rec);
        setForm({
          name: rec.name === "—" ? "" : rec.name,
          description: rec.description,
          location_id: rec.location_id,
          business_unit: rec.business_unit,
        });
      })
      .catch((e) => {
        if (!cancelled) {
          setLoaded(null);
          setForm(emptyForm);
          toast.error(getDisplayErrorMessage(e, "Failed to load location."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, locationId]);

  const submitCreate = async () => {
    if (!form.name.trim() || !form.location_id.trim()) return;
    setSubmitting(true);
    try {
      await createLocation(form);
      onCreated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to create location."));
    } finally {
      setSubmitting(false);
    }
  };

  const submitUpdate = async () => {
    const id = loaded?.id?.trim();
    if (!id || id === "—" || !form.name.trim() || !form.location_id.trim()) return;
    setSubmitting(true);
    try {
      await updateLocation(id, form);
      onUpdated?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(getDisplayErrorMessage(e, "Failed to update location."));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = form.name.trim().length > 0 && form.location_id.trim().length > 0;
  const isEditLoading =
    mode === "edit" && Boolean(locationId?.trim()) && (loading || !loaded);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col sm:max-w-md",
          mode === "edit" ? "min-h-[28rem]" : "min-h-[24rem]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-1">
          <DialogTitle>{mode === "create" ? "Create location" : "Edit location"}</DialogTitle>
          <DialogDescription className="text-xs leading-snug">
            {mode === "create"
              ? "Add a new location with name, description, location id, and business unit."
              : "Location information from the gateway."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[18rem] flex-1">
          {isEditLoading ? (
            <div
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md bg-background/90"
              aria-live="polite"
              aria-busy="true"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading location…</p>
            </div>
          ) : null}

          <div
            className={cn(
              "grid h-full gap-2",
              isEditLoading && "pointer-events-none select-none opacity-40",
            )}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="loc-name">
                Name {mode === "create" ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input
                id="loc-name"
                value={form.name}
                disabled={isEditLoading}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Location name"
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc-desc">Description</Label>
              <Textarea
                id="loc-desc"
                value={form.description}
                disabled={isEditLoading}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional description"
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc-location-id">
                Location id {mode === "create" ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input
                id="loc-location-id"
                value={form.location_id}
                disabled={isEditLoading}
                onChange={(e) => setForm((f) => ({ ...f, location_id: e.target.value }))}
                placeholder="e.g. LOC-001"
                className="h-9 font-mono text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc-bu">Business unit</Label>
              <Input
                id="loc-bu"
                value={form.business_unit}
                disabled={isEditLoading}
                onChange={(e) => setForm((f) => ({ ...f, business_unit: e.target.value }))}
                placeholder="Business unit"
                className="h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          {mode === "create" ? (
            <Button
              type="button"
              disabled={submitting || !canSubmit}
              onClick={() => void submitCreate()}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          ) : (
            <Button
              type="button"
              disabled={submitting || loading || !canSubmit || !loaded?.id}
              onClick={() => void submitUpdate()}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update location
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
