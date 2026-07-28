
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronUp, HelpCircle, Maximize2, Minimize2, Plus, Search, Type, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FontSettingsPopover } from "./FontSettingsPopover";
import { ColorPickerPopover } from "./ColorPickerPopover";
import { IconPickerPopover, LucideIconByName } from "./IconPickerPopover";
import { IconSizeInput } from "./IconSizeInput";
import { parseIconSizePx, renderLucideIconMarkup } from "./lucideIconMarkup";
import { resolvePreviewContainerStyle } from "./widgetStyleUtils";
import { isThemeDarkAppearance, useTheme } from "@/context/theme";
import {
  canRenderWidgetPreview,
  getWidgetPreviewThemeChrome,
  isStandardTbWidget,
  resolveWidgetPreviewContent,
} from "./widgetPreviewUtils";
import {
  widgetsLibraryPanelActiveTabClass,
  widgetsLibraryPanelInactiveTabClass,
  widgetsLibraryPanelHeaderHoverClass,
  widgetsLibraryAccordionTriggerClass,
  widgetsLibraryEditPanelShellClass,
  widgetsLibraryEditPanelContentClass,
  widgetsLibraryEditPanelCodeSurfaceClass,
  widgetsLibraryEditPanelCodeGutterClass,
  widgetsLibraryEditPanelCodeCardClass,
  widgetsLibraryEditPanelCodeCardGrowClass,
  widgetsLibraryEditPanelCodeCardHeadClass,
  widgetsLibraryEditPanelCodeLabelClass,
  widgetsLibraryEditPanelCodeLabelBadgeClass,
  widgetsLibraryEditPanelCodeTextareaClass,
  widgetsLibraryEditPanelContentPreviewClass,
  widgetsLibraryEditPanelAppearanceClass,
  widgetsLibraryEditPanelTabContentClass,
  widgetsLibraryEditPanelLegacyTabClass,
  widgetsLibraryEditPanelLegacySectionClass,
  widgetsLibraryEditPanelLegacyFieldRowClass,
  widgetsLibraryEditPanelLegacyCodeSurfaceClass,
  widgetsLibraryEditPanelLegacyCodeGutterClass,
} from "./widgetsLibraryClasses";
import "@/pages/WidgetsLibrary/widgetsLibraryEditPanel.css";

const CODE_EDITOR_LINE_HEIGHT_PX = 20;
const CODE_EDITOR_PADDING_Y_PX = 16;

interface FontSettings {
  size: string;
  sizeUnit: string;
  fontFamily: string;
  weight: string;
  style: string;
  lineHeight: string;
}

function tidyJson(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function CodeEditorExpandButton({
  label,
  isFullscreen = false,
  onClick,
}: {
  label: string;
  isFullscreen?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
      aria-label={isFullscreen ? `Exit fullscreen ${label}` : `Fullscreen ${label}`}
      onClick={onClick}
    >
      {isFullscreen ? (
        <Minimize2 className="h-3 w-3" />
      ) : (
        <Maximize2 className="h-3 w-3" />
      )}
    </Button>
  );
}

function CodeEditorSurface({
  value,
  onChange,
  lineCount,
  maxHeightPx = 72,
  fillHeight = false,
  legacy = false,
}: {
  value: string;
  onChange: (value: string) => void;
  lineCount: number;
  maxHeightPx?: number;
  fillHeight?: boolean;
  /** Original bordered editor (widget card / layout tabs). */
  legacy?: boolean;
}) {
  const surfaceClass = legacy
    ? widgetsLibraryEditPanelLegacyCodeSurfaceClass
    : widgetsLibraryEditPanelCodeSurfaceClass;
  const gutterClass = legacy
    ? widgetsLibraryEditPanelLegacyCodeGutterClass
    : widgetsLibraryEditPanelCodeGutterClass;
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, index) => index + 1),
    [lineCount],
  );

  const contentHeightPx = lineCount * CODE_EDITOR_LINE_HEIGHT_PX + CODE_EDITOR_PADDING_Y_PX;

  return (
    <div
      className={cn(
        "overflow-y-auto overflow-x-auto",
        surfaceClass,
        fillHeight && (legacy ? "min-h-[200px] flex-1" : "min-h-0 flex-1"),
      )}
      style={
        fillHeight
          ? legacy
            ? { minHeight: Math.max(maxHeightPx ?? 200, contentHeightPx) }
            : undefined
          : { maxHeight: maxHeightPx }
      }
    >
      <div className="flex min-w-full" style={{ minHeight: contentHeightPx }}>
        <div className={cn("flex flex-col", gutterClass)}>
          {lineNumbers.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className={cn(
            !legacy && widgetsLibraryEditPanelCodeTextareaClass,
            "block min-w-0 flex-1 resize-none overflow-hidden border-0 bg-transparent px-2 py-2 font-mono text-sm leading-5 text-foreground focus:outline-none focus-visible:ring-0",
            fillHeight ? "min-h-full overflow-auto" : "overflow-hidden",
          )}
          style={
            fillHeight
              ? { minHeight: contentHeightPx }
              : { minHeight: contentHeightPx, height: contentHeightPx }
          }
        />
      </div>
    </div>
  );
}

function WidgetPanelCodeField({
  label,
  value,
  onChange,
  required = false,
  minRows = 3,
  maxEditorHeight = 360,
  fillEditor = false,
  badge,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minRows?: number;
  maxEditorHeight?: number;
  /** Grow editor to fill remaining panel height (Appearance tab). */
  fillEditor?: boolean;
  badge?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const lineCount = useMemo(() => {
    const lines = value.split("\n").length;
    return Math.max(minRows, lines);
  }, [value, minRows]);

  const fullscreenLineCount = useMemo(() => {
    const lines = value.split("\n").length;
    return Math.max(minRows, lines);
  }, [value, minRows]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  return (
    <>
      <div className={cn(fillEditor ? widgetsLibraryEditPanelCodeCardGrowClass : widgetsLibraryEditPanelCodeCardClass)}>
        <div className={widgetsLibraryEditPanelCodeCardHeadClass}>
          <Label className={widgetsLibraryEditPanelCodeLabelClass}>
            {badge ? <span className={widgetsLibraryEditPanelCodeLabelBadgeClass}>{badge}</span> : null}
            {label}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <CodeEditorExpandButton label={label} onClick={() => setIsFullscreen(true)} />
        </div>
        <CodeEditorSurface
          value={value}
          onChange={onChange}
          lineCount={lineCount}
          maxHeightPx={maxEditorHeight}
          fillHeight={fillEditor}
        />
      </div>

      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="widgets-library-edit-panel__fullscreen fixed inset-0 z-[200] flex flex-col">
            <div className="widgets-library-edit-panel__fullscreen-head flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                {badge ? (
                  <span className={cn(widgetsLibraryEditPanelCodeLabelBadgeClass, "mr-2")}>{badge}</span>
                ) : null}
                {label}
              </h3>
              <CodeEditorExpandButton
                label={label}
                isFullscreen
                onClick={() => setIsFullscreen(false)}
              />
            </div>
            <div className="widgets-library-edit-panel__fullscreen-body flex min-h-0 flex-1 flex-col">
              <div className={widgetsLibraryEditPanelCodeCardClass}>
                <CodeEditorSurface
                  value={value}
                  onChange={onChange}
                  lineCount={fullscreenLineCount}
                  fillHeight
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}


function WidgetStyleCodeField({
  label,
  value,
  onChange,
  minRows = 3,
  maxEditorHeight = 72,
  showMini = false,
  isMinimized = false,
  onToggleMini,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  maxEditorHeight?: number;
  showMini?: boolean;
  isMinimized?: boolean;
  onToggleMini?: () => void;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const lineCount = useMemo(() => {
    const lines = value.split("\n").length;
    return Math.max(minRows, isMinimized ? 1 : lines);
  }, [value, minRows, isMinimized]);

  const fullscreenLineCount = useMemo(() => {
    const lines = value.split("\n").length;
    return Math.max(minRows, lines);
  }, [value, minRows]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isFullscreen]);

  const toolbar = (onCloseFullscreen?: () => void) => (
    <div className="flex items-center gap-0.5">
      {showMini ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[10px] font-normal text-muted-foreground hover:text-foreground"
          onClick={onToggleMini}
        >
          Mini
        </Button>
      ) : null}
      <CodeEditorExpandButton
        label={label}
        isFullscreen={Boolean(onCloseFullscreen)}
        onClick={() => (onCloseFullscreen ? onCloseFullscreen() : setIsFullscreen(true))}
      />
    </div>
  );

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-normal text-muted-foreground">{label}</Label>
          {toolbar()}
        </div>
        <CodeEditorSurface
          value={value}
          onChange={onChange}
          lineCount={lineCount}
          maxHeightPx={isMinimized ? 32 : maxEditorHeight}
          legacy
        />
      </div>

      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex flex-col bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h3 className="text-sm font-semibold text-foreground">{label}</h3>
              <CodeEditorExpandButton
                label={label}
                isFullscreen
                onClick={() => setIsFullscreen(false)}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col bg-muted/40 p-4">
              <CodeEditorSurface
                value={value}
                onChange={onChange}
                lineCount={fullscreenLineCount}
                fillHeight
                legacy
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}


export interface WidgetConfig {
  showTitle: boolean;
  title: string;
  titleTooltip: string;
  showTitleIcon: boolean;
  titleIcon?: string;
  iconSize: string;
  iconColor: string;
  textColor: string;
  backgroundColor: string;
  padding: string;
  margin: string;
  borderRadius: string;
  dropShadow: boolean;
  enableFullscreen: boolean;
  resizable: boolean;
  preserveAspectRatio: boolean;
  hideMobile: boolean;
  hideDesktop: boolean;
  order: number | null;
  height: number | null;
}

function SettingsToggleInline({
  id,
  label,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
      <Label htmlFor={id} className="text-sm text-foreground cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

function SettingsFieldRow({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(widgetsLibraryEditPanelLegacyFieldRowClass, "gap-3", className)}>
      <Label className="w-32 shrink-0 text-sm text-foreground">{label}</Label>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

function LayoutSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={widgetsLibraryEditPanelLegacySectionClass}>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function LayoutSettingRow({
  label,
  htmlFor,
  children,
  variant = "field",
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  variant?: "toggle" | "field";
}) {
  if (variant === "toggle") {
    return (
      <div className={cn(widgetsLibraryEditPanelLegacyFieldRowClass, "gap-2")}>
        {children}
        <Label
          htmlFor={htmlFor}
          className="text-sm font-normal text-foreground cursor-pointer"
        >
          {label}
        </Label>
      </div>
    );
  }

  return (
    <div className={cn(widgetsLibraryEditPanelLegacyFieldRowClass, "justify-between gap-3")}>
      <Label htmlFor={htmlFor} className="text-sm font-normal text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function LayoutNumberInput({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [draft, setDraft] = useState("");

  const displayValue =
    isFocused ? draft : value == null ? "" : String(value);

  const commitDraft = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      onChange(null);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
  };

  const step = (delta: number) => {
    const base = value ?? min;
    onChange(Math.min(max, Math.max(min, base + delta)));
  };

  return (
    <div
      className={cn(
        "flex h-9 w-[88px] items-stretch overflow-hidden rounded-md border border-input bg-background shadow-sm",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        type="text"
        value={displayValue}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setDraft(value == null ? "" : String(value));
        }}
        onBlur={() => {
          setIsFocused(false);
          commitDraft(draft);
        }}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-center text-sm outline-none"
        placeholder="Set"
        disabled={disabled}
        inputMode="numeric"
        aria-label="Numeric value"
      />
      <div className="flex w-5 shrink-0 flex-col border-l border-input">
        <button
          type="button"
          className="flex h-1/2 flex-1 items-center justify-center hover:bg-muted disabled:opacity-40"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => step(1)}
          aria-label="Increase value"
        >
          <ChevronUp className="size-1.5 text-muted-foreground" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className="flex h-1/2 flex-1 items-center justify-center border-t border-input hover:bg-muted disabled:opacity-40"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => step(-1)}
          aria-label="Decrease value"
        >
          <ChevronDown className="size-1.5 text-muted-foreground" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

function buildWidgetPreviewDocument(
  htmlCode: string,
  cssCode: string,
  config: WidgetConfig,
  widgetStyleJson: string,
  titleColor: string,
  fontSettings: FontSettings,
  widgetType = "",
  artworkUrl?: string,
  isDarkPreview = false,
): string {
  const previewChrome = getWidgetPreviewThemeChrome(isDarkPreview);
  const containerStyle = resolvePreviewContainerStyle(config, widgetStyleJson);
  const iconSizePx = parseIconSizePx(config.iconSize);
  const iconColorValue = config.iconColor || "#000000";
  const titleIconHtml =
    config.showTitleIcon && config.titleIcon
      ? renderLucideIconMarkup(config.titleIcon, {
          size: iconSizePx,
          color: iconColorValue,
          className: "widget-title-icon",
        })
      : "";
  const titleText = (config.title || "Widget Title")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const titleTooltip = (config.titleTooltip || "").replace(/"/g, "&quot;");
  const contentHtml = resolveWidgetPreviewContent(htmlCode, widgetType, artworkUrl);

  return `<!DOCTYPE html>
<html>
  <head>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background-color: ${previewChrome.canvasBackground};
        color: ${previewChrome.canvasColor};
      }
      body { position: relative; }
      ${cssCode}
      .preview-container {
        position: absolute;
        inset: 0;
        background-color: ${containerStyle.backgroundColor || previewChrome.cardBackground};
        color: ${containerStyle.color};
        padding: ${containerStyle.padding};
        margin: ${containerStyle.margin};
        border-radius: ${containerStyle.borderRadius || "14px"};
        display: flex;
        flex-direction: column;
        border: 1px solid ${previewChrome.frameBorder};
        box-shadow: ${containerStyle.boxShadow ? containerStyle.boxShadow : previewChrome.frameShadow};
        box-sizing: border-box;
        overflow: hidden;
      }
      .widget-title {
        display: flex;
        align-items: center;
        gap: 8px;
        color: ${titleColor};
        font-size: ${fontSettings.size ? `${fontSettings.size}${fontSettings.sizeUnit}` : "16px"};
        font-family: ${fontSettings.fontFamily || "inherit"};
        font-weight: ${fontSettings.weight || "400"};
        font-style: ${fontSettings.style || "normal"};
        line-height: ${fontSettings.lineHeight || "normal"};
        padding: 8px 12px;
        margin: 0;
        border-bottom: 1px solid ${previewChrome.titleBorder};
        flex-shrink: 0;
      }
      .widget-title-icon { flex-shrink: 0; display: inline-flex; }
      .widget-title-text { min-width: 0; }
      .widget-content {
        flex: 1 1 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: auto;
        min-height: 0;
        width: 100%;
        position: relative;
      }
      .widget-content > * { max-width: 100%; max-height: 100%; }
    </style>
  </head>
  <body>
    <div class="preview-container">
      ${config.showTitle ? `<div class="widget-title" title="${titleTooltip}">${titleIconHtml}<span class="widget-title-text">${titleText}</span></div>` : ""}
      <div class="widget-content">${contentHtml}</div>
    </div>
  </body>
</html>`;
}

function WidgetPanelPreviewView({
  htmlCode,
  cssCode,
  widgetConfig,
  widgetStyleJson,
  titleColor,
  fontSettings,
  widgetType = "",
  artworkUrl,
}: {
  htmlCode: string;
  cssCode: string;
  widgetConfig: WidgetConfig;
  widgetStyleJson: string;
  titleColor: string;
  fontSettings: FontSettings;
  widgetType?: string;
  artworkUrl?: string;
}) {
  const { theme } = useTheme();
  const isDarkPreview = isThemeDarkAppearance(theme);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const canShowPreview = canRenderWidgetPreview(htmlCode, widgetType, artworkUrl);

  useEffect(() => {
    if (!canShowPreview) {
      setPreviewUrl(null);
      return;
    }
    const doc = buildWidgetPreviewDocument(
      htmlCode,
      cssCode,
      widgetConfig,
      widgetStyleJson,
      titleColor,
      fontSettings,
      widgetType,
      artworkUrl,
      isDarkPreview,
    );
    const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [
    canShowPreview,
    htmlCode,
    cssCode,
    widgetConfig,
    widgetStyleJson,
    titleColor,
    fontSettings,
    widgetType,
    artworkUrl,
    isDarkPreview,
  ]);

  const emptyPreviewMessage =
    isStandardTbWidget(widgetType, htmlCode) && !artworkUrl
      ? "Preview unavailable — bundle artwork could not be loaded"
      : "Add HTML in Appearance to preview";

  const previewCard = (
    <div className="widgets-library-edit-panel__preview-card relative flex h-full min-h-[360px] w-full max-w-3xl flex-col overflow-hidden bg-card">
      <div className="widgets-library-edit-panel__preview-expand absolute right-2 top-2 z-10">
        <CodeEditorExpandButton
          label="Preview"
          isFullscreen={isCardExpanded}
          onClick={() => setIsCardExpanded((prev) => !prev)}
        />
      </div>
      {canShowPreview && previewUrl ? (
        <iframe
          title="Widget preview"
          src={previewUrl}
          className="h-full w-full flex-1 border-0"
          sandbox="allow-scripts allow-same-origin"
        />
      ) : (
        <div className="widgets-library-edit-panel__preview-empty flex flex-1 items-center justify-center px-4 text-center">
          {emptyPreviewMessage}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div
        className={cn(
          widgetsLibraryEditPanelContentPreviewClass,
          "flex min-h-0 flex-1 items-center justify-center p-6",
        )}
      >
        {previewCard}
      </div>
      {isCardExpanded &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-background">
            <div className="flex items-center justify-end border-b border-border px-3 py-2">
              <CodeEditorExpandButton
                label="Preview"
                isFullscreen
                onClick={() => setIsCardExpanded(false)}
              />
            </div>
            <div className="relative min-h-0 flex-1 p-4">
              <div className="widgets-library-edit-panel__preview-card relative mx-auto h-full w-full max-w-5xl overflow-hidden bg-card">
                {canShowPreview && previewUrl ? (
                  <iframe
                    title="Widget preview fullscreen"
                    src={previewUrl}
                    className="h-full w-full border-0"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="flex h-full min-h-[320px] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    {emptyPreviewMessage}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

interface WidgetEditPanelProps {
  // Widget details
  widgetName: string;
  widgetFqn: string;

  // Tab management
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<'appearance' | 'widget-card' | 'actions' | 'layout'>>;

  // Edit mode
  editMode: 'basic' | 'advanced';
  setEditMode: (mode: 'basic' | 'advanced') => void;
  hasBasicMode: boolean;

  // Code editors
  htmlCode: string;
  setHtmlCode: (code: string) => void;
  cssCode: string;
  setCssCode: (code: string) => void;

  // Widget configuration
  widgetConfig: WidgetConfig;
  setWidgetConfig: React.Dispatch<React.SetStateAction<WidgetConfig>>;

  // Font settings
  fontSettings: FontSettings;
  setFontSettings: (settings: FontSettings) => void;
  isFontSettingsOpen: boolean;
  setIsFontSettingsOpen: (open: boolean) => void;

  // Color picker
  titleColor: string;
  setTitleColor: (color: string) => void;
  isColorPickerOpen: boolean;
  setIsColorPickerOpen: (open: boolean) => void;

  // Advanced title style
  isAdvancedTitleStyleOpen: boolean;
  setIsAdvancedTitleStyleOpen: (open: boolean) => void;
  titleStyleJson: string;
  setTitleStyleJson: (json: string) => void;

  widgetStyleJson?: string;
  setWidgetStyleJson?: (json: string) => void;

  // Handlers
  onClose: () => void;
  onApply: () => void;

  // UI variant
  variant?: 'fullscreen' | 'minimized';

  /** ThingsBoard widget descriptor type (e.g. latest, static). */
  widgetType?: string;
  /** Resolved bundle artwork URL for standard TB widget previews. */
  artworkUrl?: string;
}

export function WidgetEditPanel({
  widgetName,
  widgetFqn,
  activeTab,
  setActiveTab,
  editMode,
  setEditMode,
  hasBasicMode,
  htmlCode,
  setHtmlCode,
  cssCode,
  setCssCode,
  widgetConfig,
  setWidgetConfig,
  fontSettings,
  setFontSettings,
  isFontSettingsOpen,
  setIsFontSettingsOpen,
  titleColor,
  setTitleColor,
  isColorPickerOpen,
  setIsColorPickerOpen,
  isAdvancedTitleStyleOpen,
  setIsAdvancedTitleStyleOpen,
  titleStyleJson,
  setTitleStyleJson,
  widgetStyleJson,
  setWidgetStyleJson,
  onClose,
  onApply,
  variant = 'fullscreen',
  widgetType = "",
  artworkUrl,
}: WidgetEditPanelProps) {
  const isFullscreen = variant === 'fullscreen';
  const isMinimized = variant === 'minimized';
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isIconColorPickerOpen, setIsIconColorPickerOpen] = useState(false);
  const [isTextColorPickerOpen, setIsTextColorPickerOpen] = useState(false);
  const [isBackgroundColorPickerOpen, setIsBackgroundColorPickerOpen] = useState(false);
  const [isAdvancedWidgetStyleOpen, setIsAdvancedWidgetStyleOpen] = useState(false);
  const [isWidgetStyleMinimized, setIsWidgetStyleMinimized] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isApplyHighlighted, setIsApplyHighlighted] = useState(false);
  const skipApplyHighlightOnMountRef = useRef(true);
  const [localWidgetStyleJson, setLocalWidgetStyleJson] = useState("{}");
  const resolvedWidgetStyleJson = widgetStyleJson ?? localWidgetStyleJson;
  const resolvedSetWidgetStyleJson = setWidgetStyleJson ?? setLocalWidgetStyleJson;
  const iconColor = widgetConfig.iconColor || "#000000";
  const textColor = widgetConfig.textColor || "#000000";
  const backgroundColor = widgetConfig.backgroundColor || "";

  useEffect(() => {
    if (!widgetConfig.showTitleIcon) {
      setIsIconPickerOpen(false);
      setIsIconColorPickerOpen(false);
    }
  }, [widgetConfig.showTitleIcon]);

  useEffect(() => {
    skipApplyHighlightOnMountRef.current = true;
    setIsApplyHighlighted(false);
  }, [widgetName]);

  useEffect(() => {
    if (skipApplyHighlightOnMountRef.current) {
      skipApplyHighlightOnMountRef.current = false;
      return;
    }
    setIsApplyHighlighted(true);
  }, [
    htmlCode,
    cssCode,
    widgetConfig,
    titleColor,
    fontSettings,
    titleStyleJson,
    resolvedWidgetStyleJson,
  ]);

  const handleApplyClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onApply();
    setIsApplyHighlighted(false);
    event.currentTarget.blur();
  };

  // Size classes based on variant
  const headerPaddingX = isFullscreen ? 'px-6' : 'px-4';
  const headerPaddingY = isFullscreen ? 'py-3' : 'py-2';
  const headerTextSize = isFullscreen ? 'text-base' : 'text-sm';
  const headerSubTextSize = isFullscreen ? 'text-xs' : 'text-xs';
  const tabButtonHeight = isFullscreen ? 'h-8' : 'h-7';
  const tabButtonPadding = isFullscreen ? 'px-4' : 'px-2.5';
  const actionButtonHeight = isFullscreen ? 'h-7' : 'h-6';
  const actionButtonPadding = isFullscreen ? 'px-2' : 'px-2';
  const contentPadding = isFullscreen ? "p-5" : "p-4";

  const headerActionButtonClass = cn(
    widgetsLibraryPanelInactiveTabClass,
    widgetsLibraryPanelHeaderHoverClass,
    actionButtonHeight,
    actionButtonPadding,
    "text-xs gap-1",
  );

  const applyHeaderButtonClass = cn(
    headerActionButtonClass,
    isApplyHighlighted && widgetsLibraryPanelActiveTabClass,
  );

  return (
    <div
      className={cn(
        widgetsLibraryEditPanelShellClass,
        "h-full min-h-0 w-full animate-in slide-in-from-right duration-300",
        isMinimized && "rounded-none border-0 shadow-none",
        isFullscreen && "h-full w-1/2 shrink-0 border-l border-border",
      )}
    >
      {/* Header with Tabs */}
      <div className="widgets-library-edit-panel__header shrink-0 bg-primary text-primary-foreground">
        <div
          className={cn(
            "widgets-library-edit-panel__header-top",
            headerPaddingX,
            headerPaddingY,
            "flex items-center justify-between",
          )}
        >
          <div className="min-w-0 flex-1">
            <h2 className={cn("widgets-library-edit-panel__header-title", headerTextSize, "truncate font-medium")}>
              {widgetName}
            </h2>
            <p className={cn("widgets-library-edit-panel__header-fqn", headerSubTextSize, "truncate")}>
              {widgetFqn}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Basic/Advanced Toggle */}
            {hasBasicMode && !isPreviewMode && (
              <div className={`flex items-center gap-1 ${isFullscreen ? 'mr-2' : 'mr-1'}`}>
                <Button
                  size="sm"
                  onClick={() => setEditMode('basic')}
                  className={`${editMode === 'basic' ? widgetsLibraryPanelActiveTabClass : widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} ${isFullscreen ? 'h-7 px-3' : 'h-6 px-2'} text-xs font-medium`}
                >
                  Basic
                </Button>
                <Button
                  size="sm"
                  onClick={() => setEditMode('advanced')}
                  className={`${editMode === 'advanced' ? widgetsLibraryPanelActiveTabClass : widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} ${isFullscreen ? 'h-7 px-3' : 'h-6 px-2'} text-xs font-medium`}
                >
                  Advanced
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "widgets-library-edit-panel__icon-btn",
                isFullscreen ? "h-7 w-7" : "h-6 w-6",
                "text-primary-foreground hover:bg-primary-foreground hover:text-primary",
              )}
            >
              <HelpCircle className={`${isFullscreen ? 'h-4 w-4' : 'h-3 w-3'}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "widgets-library-edit-panel__icon-btn",
                isFullscreen ? "h-7 w-7" : "h-6 w-6",
                "text-primary-foreground hover:bg-primary-foreground hover:text-primary",
              )}
              onClick={onClose}
            >
              <X className={`${isFullscreen ? 'h-4 w-4' : 'h-3 w-3'}`} />
            </Button>
          </div>
        </div>

        {/* Tabs and Action Buttons */}
        {!isPreviewMode && (
        <div
          className={cn(
            "widgets-library-edit-panel__header-tabs",
            headerPaddingX,
            isFullscreen ? "pb-3" : "pb-2.5",
            "flex shrink-0 items-center justify-between gap-2",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <Button
              size="sm"
              onClick={() => setActiveTab('appearance')}
              className={cn(
                tabButtonHeight,
                tabButtonPadding,
                "shrink-0 whitespace-nowrap text-xs font-normal transition-colors",
                activeTab === "appearance"
                  ? "widgets-library-edit-panel__tab-active !bg-primary-foreground !text-primary font-medium"
                  : "widgets-library-edit-panel__tab-inactive bg-transparent text-primary-foreground",
              )}
            >
              Appearance
            </Button>

            <Button
              size="sm"
              onClick={() => setActiveTab('widget-card')}
              className={cn(
                tabButtonHeight,
                tabButtonPadding,
                "shrink-0 whitespace-nowrap text-xs font-normal transition-colors",
                activeTab === "widget-card"
                  ? "widgets-library-edit-panel__tab-active !bg-primary-foreground !text-primary font-medium"
                  : "widgets-library-edit-panel__tab-inactive bg-transparent text-primary-foreground",
              )}
            >
              Widget card
            </Button>

            <Button
              size="sm"
              onClick={() => setActiveTab('actions')}
              className={cn(
                tabButtonHeight,
                tabButtonPadding,
                "shrink-0 whitespace-nowrap text-xs font-normal transition-colors",
                activeTab === "actions"
                  ? "widgets-library-edit-panel__tab-active !bg-primary-foreground !text-primary font-medium"
                  : "widgets-library-edit-panel__tab-inactive bg-transparent text-primary-foreground",
              )}
            >
              Actions
            </Button>

            <Button
              size="sm"
              onClick={() => setActiveTab('layout')}
              className={cn(
                tabButtonHeight,
                tabButtonPadding,
                "shrink-0 whitespace-nowrap text-xs font-normal transition-colors",
                activeTab === "layout"
                  ? "widgets-library-edit-panel__tab-active !bg-primary-foreground !text-primary font-medium"
                  : "widgets-library-edit-panel__tab-inactive bg-transparent text-primary-foreground",
              )}
            >
              Layout
            </Button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className={cn("widgets-library-edit-panel__header-action", headerActionButtonClass)}
              onClick={() => setIsPreviewMode(true)}
            >
              <span
                className={cn(
                  "inline-block rounded-full bg-primary-foreground",
                  isFullscreen ? "h-2 w-2" : "h-1.5 w-1.5",
                )}
              />
              Preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("widgets-library-edit-panel__header-action", headerActionButtonClass)}
              onClick={onClose}
            >
              <X className="h-3 w-3" />
              Decline
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "widgets-library-edit-panel__header-action",
                "widgets-library-edit-panel__header-action--apply",
                applyHeaderButtonClass,
              )}
              onClick={handleApplyClick}
            >
              <span className={isMinimized ? 'text-xs' : ''}>✓</span>
              Apply
            </Button>
          </div>
        </div>
        )}
      </div>

      {isPreviewMode && (
        <div
          className={cn(
            "widgets-library-edit-panel__preview-bar",
            headerPaddingX,
            "flex shrink-0 items-center justify-between py-2.5 text-foreground",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-sm font-normal text-foreground hover:bg-muted"
            onClick={() => setIsPreviewMode(false)}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-input bg-card px-3 text-sm font-normal text-muted-foreground"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
              Decline
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-input bg-muted px-3 text-sm font-normal text-muted-foreground"
              onClick={handleApplyClick}
            >
              <span>✓</span>
              Apply
            </Button>
          </div>
        </div>
      )}

      {isPreviewMode ? (
        <WidgetPanelPreviewView
          htmlCode={htmlCode}
          cssCode={cssCode}
          widgetConfig={widgetConfig}
          widgetStyleJson={resolvedWidgetStyleJson}
          titleColor={titleColor}
          fontSettings={fontSettings}
          widgetType={widgetType}
          artworkUrl={artworkUrl}
        />
      ) : (
      <div className={cn(widgetsLibraryEditPanelContentClass, "min-h-0 flex-1 overflow-y-auto")}>
        {activeTab === 'appearance' && (
          <div className={cn(widgetsLibraryEditPanelAppearanceClass, contentPadding)}>
            <WidgetPanelCodeField
              label="HTML"
              badge="html"
              required
              value={htmlCode}
              onChange={setHtmlCode}
              minRows={4}
              maxEditorHeight={160}
            />
            <WidgetPanelCodeField
              label="CSS"
              badge="css"
              value={cssCode}
              onChange={setCssCode}
              minRows={8}
              maxEditorHeight={320}
              fillEditor
            />
          </div>
        )}

        {/* Widget Card Tab */}
        {activeTab === 'widget-card' && (
          <div className={cn(widgetsLibraryEditPanelLegacyTabClass, contentPadding)}>
            <LayoutSection title="Card title">
              <SettingsToggleInline
                id={`display-title-${variant}`}
                label="Display widget title"
                checked={widgetConfig.showTitle}
                onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, showTitle: checked })}
              />

              <SettingsFieldRow label="Title">
                <Input
                  value={widgetConfig.title}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, title: e.target.value })}
                  className="h-9 flex-1 text-sm"
                  disabled={!widgetConfig.showTitle}
                />
                <FontSettingsPopover
                  isOpen={isFontSettingsOpen}
                  onOpenChange={setIsFontSettingsOpen}
                  fontSettings={fontSettings}
                  setFontSettings={setFontSettings}
                  previewText={widgetConfig.title || "HTML Card"}
                  disabled={!widgetConfig.showTitle}
                >
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                    <Type className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </FontSettingsPopover>
                <ColorPickerPopover
                  isOpen={isColorPickerOpen}
                  onOpenChange={setIsColorPickerOpen}
                  color={titleColor}
                  setColor={setTitleColor}
                  previewText={widgetConfig.title || "Title Preview"}
                  disabled={!widgetConfig.showTitle}
                >
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </ColorPickerPopover>
              </SettingsFieldRow>

              <SettingsFieldRow label="Title Tooltip">
                <Input
                  value={widgetConfig.titleTooltip}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, titleTooltip: e.target.value })}
                  className="h-9 flex-1 text-sm"
                  placeholder="Set"
                  disabled={!widgetConfig.showTitle}
                />
              </SettingsFieldRow>

              <div className={cn(widgetsLibraryEditPanelLegacyFieldRowClass, "justify-between gap-3")}>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Switch
                    id={`display-icon-${variant}`}
                    checked={widgetConfig.showTitleIcon}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        setIsIconPickerOpen(false);
                        setIsIconColorPickerOpen(false);
                      }
                      setWidgetConfig({ ...widgetConfig, showTitleIcon: checked });
                    }}
                    disabled={!widgetConfig.showTitle}
                  />
                  <Label
                    htmlFor={`display-icon-${variant}`}
                    className="cursor-pointer text-sm text-foreground"
                  >
                    Display title icon
                  </Label>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <IconSizeInput
                    value={widgetConfig.iconSize}
                    onChange={(iconSize) => setWidgetConfig({ ...widgetConfig, iconSize })}
                    disabled={!widgetConfig.showTitle || !widgetConfig.showTitleIcon}
                  />
                  <IconPickerPopover
                    isOpen={isIconPickerOpen}
                    onOpenChange={setIsIconPickerOpen}
                    icon={widgetConfig.titleIcon ?? ""}
                    onIconChange={(titleIcon) => setWidgetConfig({ ...widgetConfig, titleIcon })}
                    disabled={!widgetConfig.showTitle || !widgetConfig.showTitleIcon}
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 bg-card"
                      disabled={!widgetConfig.showTitle || !widgetConfig.showTitleIcon}
                      type="button"
                    >
                      {widgetConfig.titleIcon ? (
                        <LucideIconByName
                          name={widgetConfig.titleIcon}
                          className="h-4 w-4 shrink-0"
                          style={{ color: iconColor }}
                        />
                      ) : null}
                    </Button>
                  </IconPickerPopover>
                  <ColorPickerPopover
                    isOpen={isIconColorPickerOpen}
                    onOpenChange={setIsIconColorPickerOpen}
                    color={iconColor}
                    setColor={(color) => setWidgetConfig({ ...widgetConfig, iconColor: color })}
                    previewText={widgetConfig.title || "Icon Preview"}
                    previewIconName={widgetConfig.titleIcon || undefined}
                    previewIconSizePx={parseIconSizePx(widgetConfig.iconSize, 32)}
                    label="Icon Color"
                    disabled={!widgetConfig.showTitle || !widgetConfig.showTitleIcon}
                  >
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      disabled={!widgetConfig.showTitle || !widgetConfig.showTitleIcon}
                    >
                      <Palette className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </ColorPickerPopover>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  className={widgetsLibraryAccordionTriggerClass}
                  onClick={() => setIsAdvancedTitleStyleOpen(!isAdvancedTitleStyleOpen)}
                >
                  <span>Advanced title style</span>
                  {isAdvancedTitleStyleOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isAdvancedTitleStyleOpen && (
                  <div className="mt-4 space-y-2">
                    <Label className="text-sm text-foreground">Title style</Label>
                    <div className="relative">
                      <textarea
                        value={titleStyleJson}
                        onChange={(e) => setTitleStyleJson(e.target.value)}
                        className="h-32 w-full resize-none rounded-md border border-border bg-card p-3 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus-visible:ring-ring"
                        spellCheck={false}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-6 w-6"
                      >
                        <Maximize2 className="h-3 w-3 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </LayoutSection>

            <LayoutSection title="Card style">
              <SettingsFieldRow label="Text color">
                <div className="ml-auto">
                  <ColorPickerPopover
                    isOpen={isTextColorPickerOpen}
                    onOpenChange={setIsTextColorPickerOpen}
                    color={textColor}
                    setColor={(color) => setWidgetConfig({ ...widgetConfig, textColor: color })}
                    previewText={widgetConfig.title || "HTML Card"}
                    label="Text color"
                  >
                    <button
                      type="button"
                      className="h-8 w-8 shrink-0 overflow-hidden rounded border border-border"
                      aria-label="Text color"
                    >
                      <div className="h-full w-full" style={{ backgroundColor: textColor }} />
                    </button>
                  </ColorPickerPopover>
                </div>
              </SettingsFieldRow>

              <SettingsFieldRow label="Background color">
                <div className="ml-auto">
                  <ColorPickerPopover
                    isOpen={isBackgroundColorPickerOpen}
                    onOpenChange={setIsBackgroundColorPickerOpen}
                    color={backgroundColor || "#ffffff"}
                    setColor={(color) => setWidgetConfig({ ...widgetConfig, backgroundColor: color })}
                    previewText={widgetConfig.title || "HTML Card"}
                    label="Background color"
                  >
                    <button
                      type="button"
                      className="relative h-8 w-8 shrink-0 overflow-hidden rounded border border-border"
                      aria-label="Background color"
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage:
                            "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                          backgroundSize: "8px 8px",
                          backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
                          backgroundColor: "#fff",
                        }}
                      />
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: backgroundColor || "transparent" }}
                      />
                    </button>
                  </ColorPickerPopover>
                </div>
              </SettingsFieldRow>

              <SettingsFieldRow label="Padding">
                <Input
                  value={widgetConfig.padding}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, padding: e.target.value })}
                  className="ml-auto h-9 w-32 text-right text-sm"
                />
              </SettingsFieldRow>

              <SettingsFieldRow label="Margin">
                <Input
                  value={widgetConfig.margin}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, margin: e.target.value })}
                  className="ml-auto h-9 w-32 text-right text-sm"
                  placeholder="Set"
                />
              </SettingsFieldRow>

              <SettingsFieldRow label="Border radius">
                <Input
                  value={widgetConfig.borderRadius}
                  onChange={(e) => setWidgetConfig({ ...widgetConfig, borderRadius: e.target.value })}
                  className="ml-auto h-9 w-32 text-right text-sm"
                />
              </SettingsFieldRow>

              <SettingsToggleInline
                id={`drop-shadow-${variant}`}
                label="Drop shadow"
                checked={widgetConfig.dropShadow}
                onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, dropShadow: checked })}
              />

              <div>
                <button
                  type="button"
                  className={widgetsLibraryAccordionTriggerClass}
                  onClick={() => setIsAdvancedWidgetStyleOpen(!isAdvancedWidgetStyleOpen)}
                >
                  <span>Advanced widget style</span>
                  {isAdvancedWidgetStyleOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>

                {isAdvancedWidgetStyleOpen && (
                  <div className="mt-3 space-y-4">
                    <WidgetStyleCodeField
                      label="Widget style"
                      value={resolvedWidgetStyleJson}
                      onChange={resolvedSetWidgetStyleJson}
                      minRows={4}
                      maxEditorHeight={120}
                      showMini
                      isMinimized={isWidgetStyleMinimized}
                      onToggleMini={() => setIsWidgetStyleMinimized((prev) => !prev)}
                    />
                    <WidgetStyleCodeField
                      label="Widget CSS"
                      value={cssCode}
                      onChange={setCssCode}
                      minRows={6}
                      maxEditorHeight={200}
                    />
                  </div>
                )}
              </div>
            </LayoutSection>

            <LayoutSection title="Card buttons">
              <SettingsToggleInline
                id={`enable-fullscreen-${variant}`}
                label="Enable fullscreen"
                checked={widgetConfig.enableFullscreen}
                onCheckedChange={(checked) => setWidgetConfig({ ...widgetConfig, enableFullscreen: checked })}
              />
            </LayoutSection>
          </div>
        )}

        {/* Actions Tab */}
        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className={cn(widgetsLibraryEditPanelTabContentClass, contentPadding)}>
              <div className="widgets-library-edit-panel__page-head">
                <div>
                  <h3 className="widgets-library-edit-panel__page-title">Actions</h3>
                  <p className="widgets-library-edit-panel__page-desc">
                    Manage and monitor all available actions
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="widgets-library-edit-panel__toolbar-btn">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="widgets-library-edit-panel__toolbar-btn">
                    <Plus className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              </div>

              <div className="widgets-library-edit-panel__table">
                <div className="widgets-library-edit-panel__table-head">
                  <div className="flex items-center gap-1">
                    Action source
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </div>
                  <div>Name</div>
                  <div>Icon</div>
                  <div>Type</div>
                </div>

                <div className="widgets-library-edit-panel__table-empty">
                  <div className="widgets-library-edit-panel__table-empty-icon">
                    <Plus className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-muted-foreground">No actions found</p>
                </div>

                <div className="widgets-library-edit-panel__table-foot">

                  {/* Left */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Items per page:</span>

                    <Select defaultValue="10">
                      <SelectTrigger className="h-7 w-16 text-xs">
                        <SelectValue />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      1-0 of 0
                    </span>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled
                      >
                        <span className="text-muted-foreground">&lt;</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled
                      >
                        <span className="text-muted-foreground">&gt;</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className={cn(widgetsLibraryEditPanelLegacyTabClass, contentPadding)}>
            <LayoutSection title="Resize options">
              <LayoutSettingRow label="Resizable" htmlFor={`resizable-${variant}`} variant="toggle">
                <Switch
                  id={`resizable-${variant}`}
                  checked={widgetConfig.resizable}
                  onCheckedChange={(checked) =>
                    setWidgetConfig({ ...widgetConfig, resizable: checked })
                  }
                />
              </LayoutSettingRow>
              <LayoutSettingRow label="Preserve aspect ratio" htmlFor={`preserve-aspect-${variant}`} variant="toggle">
                <Switch
                  id={`preserve-aspect-${variant}`}
                  checked={widgetConfig.preserveAspectRatio}
                  onCheckedChange={(checked) =>
                    setWidgetConfig({ ...widgetConfig, preserveAspectRatio: checked })
                  }
                  disabled={!widgetConfig.resizable}
                />
              </LayoutSettingRow>
            </LayoutSection>

            <LayoutSection title="Mobile">
              <LayoutSettingRow label="Hide widget in mobile mode" htmlFor={`hide-mobile-${variant}`} variant="toggle">
                <Switch
                  id={`hide-mobile-${variant}`}
                  checked={widgetConfig.hideMobile}
                  onCheckedChange={(checked) =>
                    setWidgetConfig({ ...widgetConfig, hideMobile: checked })
                  }
                />
              </LayoutSettingRow>
              <LayoutSettingRow label="Hide widget in desktop mode" htmlFor={`hide-desktop-${variant}`} variant="toggle">
                <Switch
                  id={`hide-desktop-${variant}`}
                  checked={widgetConfig.hideDesktop}
                  onCheckedChange={(checked) =>
                    setWidgetConfig({ ...widgetConfig, hideDesktop: checked })
                  }
                />
              </LayoutSettingRow>
              <LayoutSettingRow label="Order">
                <LayoutNumberInput
                  value={widgetConfig.order}
                  onChange={(order) => setWidgetConfig({ ...widgetConfig, order })}
                />
              </LayoutSettingRow>
              <LayoutSettingRow label="Height">
                <LayoutNumberInput
                  value={widgetConfig.height}
                  onChange={(height) => setWidgetConfig({ ...widgetConfig, height })}
                  min={1}
                  max={50}
                />
              </LayoutSettingRow>
            </LayoutSection>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

