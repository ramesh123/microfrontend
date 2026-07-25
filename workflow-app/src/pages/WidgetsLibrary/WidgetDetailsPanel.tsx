import React, { useEffect, useState } from "react";
import { HelpCircle, X, Pencil, FileDown, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { 
  widgetsLibraryActionChipClass, 
} from "./widgetsLibraryClasses";
import { type WidgetTableRow } from "./tableModels";
import { WidgetsBundleDetailsSheet } from "./WidgetsBundleDetailsSheet";
import { getWidgetType, getWidgetImage, getWidgetImageInfo, type WidgetTypeRecord } from "@/controllers/API/widgetsApi";

type Props = {
  widget: WidgetTableRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardAnchorRef: React.RefObject<HTMLElement | null>;
  onEdit: (widget: WidgetTableRow) => void;
  onExport: (widget: WidgetTableRow) => void;
  onDelete: (id: string, title: string) => void;
};

export function WidgetDetailsPanel({
  widget,
  open,
  onOpenChange,
  dashboardAnchorRef,
  onEdit,
  onExport,
  onDelete,
}: Props) {
  const [details, setDetails] = useState<WidgetTypeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [artworkUrl, setArtworkUrl] = useState<string>("");
  const [imageInfo, setImageInfo] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (open && widget?.id) {
      const fetchDetails = async () => {
        setLoading(true);
        try {
          const fullDetails = await getWidgetType(widget.id);
          setDetails(fullDetails);

          // Handle image preview
          const descriptor = (fullDetails?.descriptor as any) || {};
          const widgetImage = descriptor.image || fullDetails.image || "";
          
          if (widgetImage) {
            const imagePath = widgetImage.replace("tb-image;", "");
            const filename = imagePath.split("/").pop() || "";
            
            if (filename) {
              const [imageUrl, info] = await Promise.all([
                getWidgetImage(filename),
                getWidgetImageInfo(filename).catch(() => null)
              ]);
              setArtworkUrl(imageUrl);
              setImageInfo(info);
            }
          }
        } catch (error) {
          console.error("Failed to fetch widget details:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchDetails();
    } else {
      setDetails(null);
      setArtworkUrl("");
      setImageInfo(null);
    }

    return () => {
      if (artworkUrl && artworkUrl.startsWith("blob:")) {
        URL.revokeObjectURL(artworkUrl);
      }
    };
  }, [open, widget?.id]);

  if (!widget) return null;

  const description = details?.description || widget.raw?.description || "";
  const isScada = details?.scada ?? widget.raw?.scada ?? false;
  const isDeprecated = details?.deprecated ?? widget.deprecated ?? false;
  const tags = Array.isArray(details?.tags) ? details.tags.join(", ") : "";

  return (
    <WidgetsBundleDetailsSheet
      open={open}
      onOpenChange={onOpenChange}
      dashboardAnchorRef={dashboardAnchorRef}
      className="sm:max-w-2xl"
    >
      <div className="flex h-full flex-col overflow-hidden bg-background text-foreground">
        {/* Header */}
        <div className="relative flex h-32 flex-col justify-end bg-primary px-6 pb-4 text-primary-foreground">
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
              title="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            <h1 className="text-2xl font-semibold leading-tight">{widget.title}</h1>
            <p className="text-sm font-light opacity-90">Details</p>
          </div>

          {/* Pencil FAB */}
          <Button
            type="button"
            size="icon"
            className="absolute -bottom-6 right-6 h-12 w-12 rounded-full bg-orange-600 shadow-lg hover:bg-orange-700"
            onClick={() => onEdit(widget)}
          >
            <Pencil className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="mt-2 border-b border-border px-6 pb-2">
          <span className="inline-block border-b-2 border-primary px-4 pb-2 pt-4 text-xs font-medium text-primary">
            Details
          </span>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className={cn(widgetsLibraryActionChipClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
                onClick={() => onEdit(widget)}
              >
                Edit widget
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(widgetsLibraryActionChipClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
                onClick={() => onExport(widget)}
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                Export widget
              </Button>
              <Button
                type="button"
                size="sm"
                className={cn(widgetsLibraryActionChipClass, "bg-primary text-primary-foreground hover:bg-primary/90")}
                onClick={() => onDelete(widget.id, widget.title)}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete widget
              </Button>
            </div>

            {/* Form Fields */}
            <div className="space-y-5">
              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="panel-title" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Title*
                </Label>
                <Input
                  id="panel-title"
                  value={widget.title}
                  readOnly
                  className="h-9 border-0 border-b border-border bg-transparent px-0 text-base font-normal shadow-none focus-visible:ring-0 rounded-none"
                />
              </div>

              {/* Image preview */}
              <div className="space-y-2">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Image preview</Label>
                <div className="flex items-center gap-4 rounded-sm border border-border p-2 bg-background">
                  <div className="flex h-20 w-32 shrink-0 items-center justify-center bg-white p-1 border border-border/50 shadow-sm">
                    {artworkUrl ? (
                       <img 
                        src={artworkUrl} 
                        alt={widget.title} 
                        className="max-h-full max-w-full object-contain"
                       />
                    ) : (
                      <Package className="h-8 w-8 text-muted-foreground/10" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden text-foreground">
                    <p className="truncate text-sm font-medium">{widget.title}</p>
                    <p className="text-[10px] text-muted-foreground opacity-60">
                      {imageInfo ? (
                        `${imageInfo.width || imageInfo.width_px}x${imageInfo.height || imageInfo.height_px} · ${(Number(imageInfo.size || imageInfo.file_size || 0) / 1024).toFixed(1)} KB`
                      ) : (
                        widget.widgetType
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="panel-description" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    {String(description).length}/1024
                  </span>
                </div>
                <Textarea
                  id="panel-description"
                  value={String(description)}
                  readOnly
                  className="min-h-[40px] resize-none border-0 border-b border-border bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 rounded-none"
                  placeholder=" "
                />
              </div>

              {/* Tags */}
              <div className="space-y-1">
                <Label htmlFor="panel-tags" className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Tags
                </Label>
                <Input
                  id="panel-tags"
                  value={tags}
                  readOnly
                  className="h-9 border-0 border-b border-border bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 rounded-none"
                  placeholder=" "
                />
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-4">
                  <Switch checked={Boolean(isScada)} disabled className="scale-90" />
                  <span className="text-sm text-foreground opacity-80">SCADA symbol</span>
                </div>
                <div className="flex items-center gap-4">
                  <Switch checked={Boolean(isDeprecated)} disabled className="scale-90" />
                  <span className="text-sm text-foreground opacity-80">Deprecated</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WidgetsBundleDetailsSheet>
  );
}
