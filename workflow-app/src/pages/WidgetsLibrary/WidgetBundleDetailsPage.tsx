import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileDown, HelpCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { tbImageRefToFilename, type WidgetBundleTableRow } from "./tableModels";
import {
  widgetsLibraryActionChipClass,
  widgetsLibrarySheetTabClass,
} from "./widgetsLibraryClasses";

type Props = {
  bundle: WidgetBundleTableRow;
  bundleDetail: Record<string, unknown> | null;
  bundleImageSrc: string | null;
  onBack: () => void;
  onOpenWidgets: () => void;
  onExport: () => void;
};

export default function WidgetBundleDetailsPage({
  bundle,
  bundleDetail,
  bundleImageSrc,
  onBack,
  onOpenWidgets,
  onExport,
}: Props) {  const title = (bundleDetail?.title as string) ?? bundle.title ?? "Widget Bundle";
  const description = (bundleDetail?.description as string) ?? "";
  const order = (bundleDetail?.order as number) ?? 0;
  const isScada = (bundleDetail?.scada as boolean) ?? false;
  const imageRef = bundleDetail?.image as string | undefined;
  const imageFilename = tbImageRefToFilename(imageRef);

  return (
    <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden border border-border bg-card shadow-md">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <p className="text-xs text-muted-foreground">Widgets bundle details</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Help"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-border px-6">
        <button type="button" className={widgetsLibrarySheetTabClass}>
          Details
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="space-y-5">

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className={widgetsLibraryActionChipClass}
              onClick={onOpenWidgets}
            >
              <Package className="mr-1.5 h-3.5 w-3.5" />
              Open widgets bundle
            </Button>
            <Button
              type="button"
              size="sm"
              className={widgetsLibraryActionChipClass}
              onClick={onExport}
            >
              <FileDown className="mr-1.5 h-3.5 w-3.5" />
              Export widgets bundle
            </Button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-title" className="text-xs text-muted-foreground">
              Title*
            </Label>
            <Input
              id="detail-title"
              value={title}
              className="h-10 border-border bg-background text-sm focus-visible:ring-ring"
              readOnly
            />
          </div>

          {/* Image preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Image preview</Label>
            <div className="flex items-center gap-4 border border-border p-4">
              {/* Thumbnail */}
              <div className="flex h-[4.5rem] w-[7.5rem] shrink-0 items-center justify-center overflow-hidden border border-border">
                {bundleImageSrc ? (
                  <img
                    src={bundleImageSrc}
                    alt="Bundle preview"
                    className="max-h-[4rem] max-w-full object-contain"
                  />
                ) : imageRef ? (
                  <div className="h-10 w-16 animate-pulse bg-muted" />
                ) : (
                  <Package className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>

              {/* Meta */}
              {imageFilename ? (
                <p className="text-sm font-medium text-foreground">{imageFilename}</p>
              ) : null}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="detail-description" className="text-xs text-muted-foreground">
                Description
              </Label>
              <span className="text-xs text-muted-foreground">{description.length}/1024</span>
            </div>
            <Textarea
              id="detail-description"
              value={description}
              className="min-h-[80px] resize-none border-border bg-background text-sm focus-visible:ring-ring"
              readOnly
            />
          </div>

          {/* SCADA toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={isScada} disabled />
            <span className="text-sm text-foreground">SCADA widgets bundle</span>
          </div>

          {/* Order */}
          <div className="space-y-1.5">
            <Label htmlFor="detail-order" className="text-xs text-muted-foreground">
              Order
            </Label>
            <Input
              id="detail-order"
              type="number"
              value={order}
              className="h-10 border-border bg-background text-sm focus-visible:ring-ring"
              readOnly
            />
          </div>

        </div>
      </div>
    </div>
  );
}