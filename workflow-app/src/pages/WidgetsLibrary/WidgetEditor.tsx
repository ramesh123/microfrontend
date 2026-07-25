
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getDisplayErrorMessage } from '@/utils/exceptionHelper';
import { AlertTriangle, ArrowLeft, ChevronDown, ChevronUp, GripVertical, HelpCircle, Maximize2, Minimize2, Palette, Pencil, Plus, RefreshCw, Save, Search, Settings, Type, Undo, X } from "lucide-react";
import { toast } from "sonner";
import { ReactFlow, Background, BackgroundVariant, Node, Edge, NodeProps, useNodesState, useEdgesState, Panel, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '@/pages/WidgetsLibrary/widgetsLibraryEditorHeader.css';
import '@/pages/WidgetsLibrary/widgetsLibraryPreview.css';
import '@/pages/WidgetsLibrary/widgetsLibraryCodeEditor.css';

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getWidgetType,
  listWidgetBundles,
  saveWidgetType,
  type WidgetTypeRecord,
  getWidgetImage,
  getWidgetImageInfo,
} from "@/controllers/API/widgetsApi";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toWidgetBundleTableRow, type WidgetBundleTableRow } from "./tableModels";
import { FontSettingsPopover } from "./FontSettingsPopover";
import { ColorPickerPopover } from "./ColorPickerPopover";
import { IconPickerPopover, LucideIconByName } from "./IconPickerPopover";
import { IconSizeInput } from "./IconSizeInput";
import { parseIconSizePx, renderLucideIconMarkup } from "./lucideIconMarkup";
import {
  buildWidgetStyleJsonFromConfig,
  resolvePreviewContainerStyle,
} from "./widgetStyleUtils";
import { WidgetEditPanel, type WidgetConfig } from "./WidgetEditPanel";
import { WidgetCodeEditorSurface } from "./WidgetCodeEditorSurface";
import {
  widgetsLibraryEditorTabTriggerClass,
  widgetsLibraryEditorCodePaneClass,
  widgetsLibraryEditorTabsContentClass,
  widgetsLibraryEditorTabsListClass,
  widgetsLibraryEditorTabsRootClass,
  widgetsLibraryEditorSectionHeaderClass,
  widgetsLibraryPanelActiveTabClass,
  widgetsLibraryPanelHeaderHoverClass,
  widgetsLibraryPanelInactiveTabClass,
  widgetsLibraryPanelSurfaceClass,
  widgetsLibraryEditorSplitterHorizontalClass,
  widgetsLibraryEditorSplitterVerticalClass,
  widgetsLibraryPreviewFlowClass,
  widgetsLibraryPreviewFlowFullscreenClass,
  widgetsLibraryPreviewPaneClass,
  widgetsLibrarySectionTitleClass,
  widgetsLibraryAccordionTriggerClass,
} from "./widgetsLibraryClasses";

import type { WidgetTableRow } from "./tableModels";
import { isThemeDarkAppearance, useTheme } from "@/context/theme";
import { getWidgetPreviewThemeChrome } from "./widgetPreviewUtils";



// ✅ ADD THIS HERE — after imports, before constants
function FitViewOnChange({ trigger }: { trigger: boolean }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const timeout = setTimeout(() => {
      fitView({ padding: 0.2, includeHiddenNodes: false, duration: 300 });
    }, 50);
    return () => clearTimeout(timeout);
  }, [trigger, fitView]);

  return null;
}

const EDITOR_SPLIT_GUTTER_PX = 3;
const EDITOR_SPLIT_HALF_GUTTER = EDITOR_SPLIT_GUTTER_PX / 2;

const WIDGET_PREVIEW_MAX_WIDTH = 520;
const WIDGET_PREVIEW_UNIT_WIDTH = 62;
const WIDGET_PREVIEW_UNIT_HEIGHT = 62;

type WidgetPreviewSize = { width: number; height: number };

function getWidgetPreviewSizeFromDescriptor(descriptor: unknown): WidgetPreviewSize {
  const d = descriptor as { sizeX?: number; sizeY?: number } | null | undefined;
  const sizeX = typeof d?.sizeX === "number" && d.sizeX > 0 ? d.sizeX : 8;
  const sizeY = typeof d?.sizeY === "number" && d.sizeY > 0 ? d.sizeY : 6;
  return {
    width: Math.max(320, Math.round(sizeX * WIDGET_PREVIEW_UNIT_WIDTH)),
    height: Math.max(240, Math.round(sizeY * WIDGET_PREVIEW_UNIT_HEIGHT)),
  };
}

function scalePreviewSizeToMaxWidth(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth = WIDGET_PREVIEW_MAX_WIDTH,
): WidgetPreviewSize {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return getWidgetPreviewSizeFromDescriptor(null);
  }
  const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
  return {
    width: Math.round(naturalWidth * scale),
    height: Math.round(naturalHeight * scale),
  };
}

// Type for widget image node data
// interface WidgetImageNodeData {
//   imageUrl: string;
//   onEdit?: () => void;
//   isHtmlContent?: boolean;
//   previewWidth: number;
//   previewHeight: number;
//   onPreviewSizeChange?: (size: WidgetPreviewSize) => void;
// }

// // Custom node for widget image
// function WidgetImageNode({ data }: { data: WidgetImageNodeData }) {
//   const { imageUrl, onEdit, isHtmlContent, previewWidth, previewHeight, onPreviewSizeChange } = data;

//   console.log('WidgetImageNode rendering:', { 
//     imageUrl: imageUrl ? `${imageUrl.substring(0, 50)}...` : 'empty',
//     isHtmlContent 
//   });

//   const previewStyle = {
//     width: `${previewWidth}px`,
//     height: `${previewHeight}px`,
//     pointerEvents: 'all' as const,
//   };


interface WidgetImageNodeData {
  imageUrl: string;
  onEdit?: () => void;
  isHtmlContent?: boolean;
  previewWidth: number;
  previewHeight: number;
  onPreviewSizeChange?: (size: WidgetPreviewSize) => void;
  isEditPanelOpen?: boolean;
  resizable?: boolean;
  preserveAspectRatio?: boolean;
}

const WIDGET_PREVIEW_MIN_SIZE = 120;

function PreviewResizeHandle({
  width,
  height,
  preserveAspectRatio,
  onResize,
}: {
  width: number;
  height: number;
  preserveAspectRatio: boolean;
  onResize: (size: WidgetPreviewSize) => void;
}) {
  const aspectRatio = width > 0 && height > 0 ? width / height : 1;

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = width;
    const startHeight = height;

    const onPointerMove = (moveEvent: PointerEvent) => {
      let nextWidth = Math.max(
        WIDGET_PREVIEW_MIN_SIZE,
        startWidth + (moveEvent.clientX - startX),
      );
      let nextHeight = Math.max(
        WIDGET_PREVIEW_MIN_SIZE,
        startHeight + (moveEvent.clientY - startY),
      );

      if (preserveAspectRatio) {
        nextHeight = Math.round(nextWidth / aspectRatio);
        nextHeight = Math.max(WIDGET_PREVIEW_MIN_SIZE, nextHeight);
        nextWidth = Math.round(nextHeight * aspectRatio);
      }

      onResize({ width: Math.round(nextWidth), height: Math.round(nextHeight) });
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div
      role="separator"
      aria-label="Resize widget preview"
      className="absolute bottom-0 right-0 z-20 flex h-4 w-4 cursor-se-resize items-center justify-center rounded-tl-sm bg-primary/90 text-primary-foreground"
      onPointerDown={onPointerDown}
    >
      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
        <path fill="currentColor" d="M9 1v8H1V6h2V3h3V1h3z" />
      </svg>
    </div>
  );
}

function WidgetImageNode({ data }: { data: WidgetImageNodeData }) {
  const {
    imageUrl,
    onEdit,
    isHtmlContent,
    previewWidth,
    previewHeight,
    onPreviewSizeChange,
    isEditPanelOpen,
    resizable = false,
    preserveAspectRatio = false,
  } = data;

  const effectiveWidth = isEditPanelOpen
    ? Math.round(previewWidth * 0.55)
    : previewWidth;
  const effectiveHeight = isEditPanelOpen
    ? Math.round(previewHeight * 0.55)
    : previewHeight;

  const previewStyle = {
    width: `${effectiveWidth}px`,
    height: `${effectiveHeight}px`,
    pointerEvents: 'all' as const,
  };

  const handleResize = (size: WidgetPreviewSize) => {
    const scale = isEditPanelOpen ? 1 / 0.55 : 1;
    onPreviewSizeChange?.({
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
    });
  };

  return (
    <div className="relative group" style={{ pointerEvents: 'all' }}>
      {imageUrl && imageUrl.length > 0 ? (
        <div className="relative">
          {isHtmlContent ? (
            // Render HTML content in iframe
            <iframe
              src={imageUrl}
              className="widgets-library-preview-widget-frame"
              style={{
                ...previewStyle,
                border: 'none',
              }}
              title="Widget Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            // Render image
            <img
              src={imageUrl}
              alt="Widget Preview"
              className="widgets-library-preview-widget-frame object-contain"
              style={previewStyle}
              onLoad={(e) => {
                console.log('✓ Image loaded successfully');
                if (isHtmlContent) return;
                const { naturalWidth, naturalHeight } = e.currentTarget;
                onPreviewSizeChange?.(
                  scalePreviewSizeToMaxWidth(naturalWidth, naturalHeight),
                );
              }}
              onError={(e) => {
                console.error('✗ Image failed to load:', e);
                console.error('Image src:', imageUrl);
              }}
            />
          )}
          {resizable && isHtmlContent ? (
            <PreviewResizeHandle
              width={effectiveWidth}
              height={effectiveHeight}
              preserveAspectRatio={preserveAspectRatio}
              onResize={handleResize}
            />
          ) : null}
          <div
            className="absolute -top-3 -right-3 w-10 h-10 bg-card rounded-lg shadow-lg flex items-center justify-center cursor-pointer hover:bg-accent transition-all opacity-0 group-hover:opacity-100 border border-border"
            style={{ pointerEvents: 'all' }}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
          >
            <Pencil className="h-5 w-5 text-foreground" />
          </div>
        </div>
      ) : (
        <div className="w-48 h-48 flex items-center justify-center bg-muted rounded-lg border-2 border-dashed border-border">
          <div className="text-center">
            <div className="text-5xl mb-2">🖼️</div>
            <div className="text-sm text-muted-foreground">No Image</div>
            <div className="text-xs text-muted-foreground mt-1">Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  widgetImage: WidgetImageNode,
};

function buildDescriptorForSave(
  baseDescriptor: unknown,
  htmlCode: string,
  cssCode: string,
  jsCode: string,
  config: WidgetConfig,
  styleJson: string,
): Record<string, unknown> {
  const descriptor =
    baseDescriptor && typeof baseDescriptor === "object"
      ? { ...(baseDescriptor as Record<string, unknown>) }
      : {};

  descriptor.templateHtml = htmlCode;
  descriptor.templateCss = cssCode;
  descriptor.controllerScript = jsCode;

  let configObj: Record<string, unknown> = {};
  const existing = descriptor.defaultConfig;
  if (typeof existing === "string" && existing.trim()) {
    try {
      configObj = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      configObj = {};
    }
  } else if (existing && typeof existing === "object") {
    configObj = { ...(existing as Record<string, unknown>) };
  }

  const settings =
    configObj.settings && typeof configObj.settings === "object"
      ? { ...(configObj.settings as Record<string, unknown>) }
      : {};

  if (htmlCode) settings.cardHtml = htmlCode;
  if (cssCode) settings.cardCss = cssCode;

  descriptor.defaultConfig = JSON.stringify({
    ...configObj,
    showTitle: config.showTitle,
    title: config.title,
    titleTooltip: config.titleTooltip,
    showTitleIcon: config.showTitleIcon,
    titleIcon: config.titleIcon,
    icon: config.titleIcon,
    backgroundColor: config.backgroundColor,
    color: config.textColor,
    padding: config.padding,
    margin: config.margin,
    borderRadius: config.borderRadius,
    dropShadow: config.dropShadow,
    enableFullscreen: config.enableFullscreen,
    iconSize: config.iconSize,
    iconColor: config.iconColor,
    resizable: config.resizable,
    preserveAspectRatio: config.preserveAspectRatio,
    hideMobile: config.hideMobile,
    hideOnMobile: config.hideMobile,
    hideDesktop: config.hideDesktop,
    hideOnDesktop: config.hideDesktop,
    mobileOrder: config.order,
    order: config.order,
    mobileHeight: config.height,
    height: config.height,
    widgetStyle: styleJson,
    settings,
  });

  return descriptor;
}

type WidgetEditorProps = {
  widget: WidgetTableRow;
  onClose: () => void;
};

export default function WidgetEditor({ widget, onClose }: WidgetEditorProps) {
  const { theme } = useTheme();
  const isDarkPreview = isThemeDarkAppearance(theme);
  const previewDotColor = isDarkPreview
    ? "rgba(148, 163, 184, 0.22)"
    : "rgba(148, 163, 184, 0.42)";

  const [widgetDetails, setWidgetDetails] = useState<WidgetTypeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedImageUrl, setLoadedImageUrl] = useState<string>("");
  const [artworkUrl, setArtworkUrl] = useState<string>("");
  const [isHtmlContent, setIsHtmlContent] = useState(false);
  const [previewSize, setPreviewSize] = useState<WidgetPreviewSize>(() =>
    getWidgetPreviewSizeFromDescriptor(null),
  );
  const [basePreviewSize, setBasePreviewSize] = useState<WidgetPreviewSize>(() =>
    getWidgetPreviewSizeFromDescriptor(null),
  );
  const [imageInfo, setImageInfo] = useState<Record<string, unknown> | null>(null);
  const [leftWidth, setLeftWidth] = useState(50); // Percentage
  const [topHeight, setTopHeight] = useState(50); // Percentage
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const [isDraggingHorizontal, setIsDraggingHorizontal] = useState(false);
  const [isJsMaximized, setIsJsMaximized] = useState(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'appearance' | 'widget-card' | 'actions' | 'layout'>('appearance');
  const [editMode, setEditMode] = useState<'basic' | 'advanced'>('basic');
  const [hasBasicMode, setHasBasicMode] = useState(false);
  const [isAdvancedTitleStyleOpen, setIsAdvancedTitleStyleOpen] = useState(false);
  const [titleStyleJson, setTitleStyleJson] = useState('{\n  "fontSize": "16px",\n  "fontWeight": 400\n}');
  const [isFontSettingsOpen, setIsFontSettingsOpen] = useState(false);
  const defaultFontSettings = {
    size: "",
    sizeUnit: "px",
    fontFamily: "",
    weight: "",
    style: "",
    lineHeight: "",
  };
  const [fontSettings, setFontSettings] = useState(defaultFontSettings);
  const [draftFontSettings, setDraftFontSettings] = useState(defaultFontSettings);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [isIconColorPickerOpen, setIsIconColorPickerOpen] = useState(false);
  const [titleColor, setTitleColor] = useState("#000000");
  const [draftTitleColor, setDraftTitleColor] = useState("#000000");
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [saveAsTitle, setSaveAsTitle] = useState("");
  const [saveAsBundleId, setSaveAsBundleId] = useState("");
  const [bundleOptions, setBundleOptions] = useState<WidgetBundleTableRow[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [savingAs, setSavingAs] = useState(false);

  // Editable code states
  const [htmlCode, setHtmlCode] = useState("");
  const [cssCode, setCssCode] = useState("");
  const [jsCode, setJsCode] = useState("");

  // Widget configuration — applied (preview) vs draft (editing until main Apply)
  const defaultWidgetConfig: WidgetConfig = {
    showTitle: false,
    title: "",
    titleTooltip: "",
    showTitleIcon: false,
    titleIcon: "",
    backgroundColor: "",
    textColor: "",
    padding: "",
    margin: "",
    borderRadius: "",
    dropShadow: false,
    enableFullscreen: false,
    iconSize: "24px",
    iconColor: "",
    resizable: true,
    preserveAspectRatio: false,
    hideMobile: false,
    hideDesktop: false,
    order: null,
    height: null,
  };
  const [widgetConfig, setWidgetConfig] = useState(defaultWidgetConfig);
  const [draftWidgetConfig, setDraftWidgetConfig] = useState(defaultWidgetConfig);
  const [widgetStyleJson, setWidgetStyleJson] = useState("{}");
  const [draftWidgetStyleJson, setDraftWidgetStyleJson] = useState("{}");

  useEffect(() => {
    if (!draftWidgetConfig.showTitleIcon) {
      setIsIconPickerOpen(false);
      setIsIconColorPickerOpen(false);
    }
  }, [draftWidgetConfig.showTitleIcon]);

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  useEffect(() => {
    const fetchWidgetDetails = async () => {
      setLoading(true);
      try {
        const details = await getWidgetType(widget.id);
        setWidgetDetails(details);
        const descriptorPreviewSize = getWidgetPreviewSizeFromDescriptor(details?.descriptor);
        setBasePreviewSize(descriptorPreviewSize);
        setPreviewSize(descriptorPreviewSize);

        // Initialize code editors with fetched data
        let initialHtmlCode = String((details?.descriptor as any)?.templateHtml || details?.templateHtml || "");
        let initialCssCode = String((details?.descriptor as any)?.templateCss || details?.templateCss || "");
        setJsCode(String((details?.descriptor as any)?.controllerScript || details?.controllerScript || ""));

        const defaultConfigStr = String((details?.descriptor as any)?.defaultConfig || details?.defaultConfig || "");
        let loadedConfig: WidgetConfig = {
          showTitle: false,
          title: String(details?.name || widget.title || ""),
          titleTooltip: "",
          showTitleIcon: false,
          titleIcon: "",
          backgroundColor: "",
          textColor: "",
          padding: "",
          margin: "",
          borderRadius: "",
          dropShadow: false,
          enableFullscreen: false,
          iconSize: "24px",
          iconColor: "",
          resizable: true,
          preserveAspectRatio: false,
          hideMobile: false,
          hideDesktop: false,
          order: null,
          height: null,
        };

        if (defaultConfigStr) {
          try {
            const config = JSON.parse(defaultConfigStr);
            console.log('Parsed defaultConfig:', config);

            // Check if settings.cardHtml and settings.cardCss exist and override
            if (config.settings) {
              if (config.settings.cardHtml) {
                initialHtmlCode = String(config.settings.cardHtml);
                console.log('Using cardHtml from settings:', initialHtmlCode);
              }
              if (config.settings.cardCss) {
                initialCssCode = String(config.settings.cardCss);
                console.log('Using cardCss from settings:', initialCssCode);
              }
            }

            const parsedHeight =
              typeof config.mobileHeight === "number"
                ? config.mobileHeight
                : typeof config.height === "number"
                  ? config.height
                  : null;

            loadedConfig = {
              showTitle: config.showTitle ?? false,
              title: String(config.title || details?.name || widget.title || ""),
              titleTooltip: String(config.titleTooltip || ""),
              showTitleIcon: config.showTitleIcon ?? false,
              titleIcon: String(config.titleIcon || config.icon || ""),
              backgroundColor: String(config.backgroundColor || ""),
              textColor: String(config.color || ""),
              padding: String(config.padding || ""),
              margin: String(config.margin || ""),
              borderRadius: String(config.borderRadius || ""),
              dropShadow: config.dropShadow ?? false,
              enableFullscreen: config.enableFullscreen ?? false,
              iconSize: String(config.iconSize || "24px"),
              iconColor: String(config.iconColor || ""),
              resizable: config.resizable ?? true,
              preserveAspectRatio: config.preserveAspectRatio ?? false,
              hideMobile: config.hideMobile ?? config.hideOnMobile ?? false,
              hideDesktop: config.hideDesktop ?? config.hideOnDesktop ?? false,
              order:
                typeof config.mobileOrder === "number"
                  ? config.mobileOrder
                  : typeof config.order === "number"
                    ? config.order
                    : null,
              height: parsedHeight,
            };
            const initialWidgetStyleJson = buildWidgetStyleJsonFromConfig(loadedConfig);
            setWidgetConfig(loadedConfig);
            setDraftWidgetConfig(loadedConfig);
            setWidgetStyleJson(initialWidgetStyleJson);
            setDraftWidgetStyleJson(initialWidgetStyleJson);

            // Check if hasBasicMode is true
            if (config.hasBasicMode === true) {
              setHasBasicMode(true);
            }
          } catch (configError) {
            console.error('Failed to parse defaultConfig:', configError);
          }
        }

        // Set the HTML and CSS code after checking settings
        setHtmlCode(initialHtmlCode);
        setCssCode(initialCssCode);

        // Fetch image if available
        const widgetImage = (details?.descriptor as any)?.image || details?.image || '';
        console.log('Widget image path:', widgetImage);

        let finalArtworkUrl = "";

        if (widgetImage) {
          try {
            // Extract filename from path: "tb-image;/api/images/system/filename.png" -> "filename.png"
            const imagePath = widgetImage.replace('tb-image;', '');
            const filename = imagePath.split('/').pop() || '';

            console.log('Extracted filename:', filename);

            if (filename) {
              // Fetch image data
              const imageDataResponse = String(await getWidgetImage(filename));
              console.log('Image data received:', imageDataResponse ? `${imageDataResponse.substring(0, 100)}...` : 'empty');
              finalArtworkUrl = imageDataResponse;
              setArtworkUrl(imageDataResponse);

              // Fetch image info
              try {
                const info = await getWidgetImageInfo(filename);
                console.log('Image info received:', info);
                setImageInfo(info);
              } catch (infoError) {
                console.error('Failed to load image info:', infoError);
              }
            }
          } catch (imageError) {
            console.error('Failed to load image:', imageError);
            toast.error('Failed to load widget image');
          }
        }

        // Generate initial preview
        const widgetType = (details?.descriptor as any)?.type || "";
        const isStandardWidget =
          widgetType !== "static" ||
          !initialHtmlCode ||
          initialHtmlCode.includes("<tb-") ||
          initialHtmlCode.includes("<canvas");

        generatePreview(
          initialHtmlCode,
          initialCssCode,
          loadedConfig,
          buildWidgetStyleJsonFromConfig(loadedConfig),
          (details as any).color || "#000000",
          defaultFontSettings,
          isStandardWidget ? finalArtworkUrl : undefined
        );
      } catch (error) {
        console.error(error);
        toast.error(getDisplayErrorMessage(error, "Failed to load widget details."));
        onClose();
      } finally {
        setLoading(false);
      }
    };
    void fetchWidgetDetails();

    // Cleanup blob URL on unmount
    return () => {
      if (loadedImageUrl && loadedImageUrl.startsWith('blob:')) {
        URL.revokeObjectURL(loadedImageUrl);
      }
    };
  }, [widget.id, onClose]);

  const handlePreviewSizeChange = useCallback((size: WidgetPreviewSize) => {
    setPreviewSize((prev) =>
      prev.width === size.width && prev.height === size.height ? prev : size,
    );
    if (isEditSheetOpen) {
      const sizeY = Math.max(1, Math.round(size.height / WIDGET_PREVIEW_UNIT_HEIGHT));
      setDraftWidgetConfig((prev) =>
        prev.height === sizeY ? prev : { ...prev, height: sizeY },
      );
    }
  }, [isEditSheetOpen]);

  const activeLayoutConfig = isEditSheetOpen ? draftWidgetConfig : widgetConfig;

  useEffect(() => {
    if (activeLayoutConfig.height != null && activeLayoutConfig.height > 0) {
      const nextHeight = Math.max(
        240,
        Math.round(activeLayoutConfig.height * WIDGET_PREVIEW_UNIT_HEIGHT),
      );
      setPreviewSize((prev) =>
        prev.height === nextHeight ? prev : { ...prev, height: nextHeight },
      );
      return;
    }
    setPreviewSize((prev) =>
      prev.height === basePreviewSize.height ? prev : { ...prev, height: basePreviewSize.height },
    );
  }, [activeLayoutConfig.height, basePreviewSize.height]);

  // Update React Flow node when image loads
  // useEffect(() => {
  //   console.log('Image load state:', { loadedImageUrl, loading, isHtmlContent });

  //   if (loadedImageUrl || !loading) {
  //     const newNode = {
  //       id: 'widget-image-node',
  //       type: 'widgetImage',
  //       position: { x: 100, y: 80 },
  //       data: {
  //         imageUrl: loadedImageUrl,
  //         onEdit: () => setIsEditSheetOpen(true),
  //         isHtmlContent: isHtmlContent,
  //         previewWidth: previewSize.width,
  //         previewHeight: previewSize.height,
  //         onPreviewSizeChange: handlePreviewSizeChange,
  //       },
  //       draggable: isPreviewFullscreen, // Only draggable in fullscreen
  //       selectable: isPreviewFullscreen, // Only selectable in fullscreen
  //     };

  //     console.log('Setting node:', newNode);
  //     setNodes([newNode]);
  //   }
  // }, [
  //   loadedImageUrl,
  //   loading,
  //   isPreviewFullscreen,
  //   isHtmlContent,
  //   previewSize.width,
  //   previewSize.height,
  //   handlePreviewSizeChange,
  //   setNodes,
  // ]);

  useEffect(() => {
    if (loadedImageUrl || !loading) {
      const newNode = {
        id: 'widget-image-node',
        type: 'widgetImage',
        position: { x: 0, y: 0 },
        data: {
          imageUrl: loadedImageUrl,
          onEdit: () => setIsEditSheetOpen(true),
          isHtmlContent: isHtmlContent,
          previewWidth: previewSize.width,
          previewHeight: previewSize.height,
          onPreviewSizeChange: handlePreviewSizeChange,
          isEditPanelOpen: isPreviewFullscreen && isEditSheetOpen,
          resizable: activeLayoutConfig.resizable,
          preserveAspectRatio: activeLayoutConfig.preserveAspectRatio,
        },
        draggable: isPreviewFullscreen,
        selectable: isPreviewFullscreen,
      };
      setNodes([newNode]);
    }
  }, [
    loadedImageUrl,
    loading,
    isPreviewFullscreen,
    isHtmlContent,
    previewSize.width,
    previewSize.height,
    handlePreviewSizeChange,
    setNodes,
    isEditSheetOpen,
    activeLayoutConfig.resizable,
    activeLayoutConfig.preserveAspectRatio,
  ]);

  const handleVerticalDrag = useCallback((e: React.MouseEvent) => {
    setIsDraggingVertical(true);
    const startX = e.clientX;
    const startWidth = leftWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const deltaX = moveEvent.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.min(Math.max(startWidth + deltaPercent, 20), 80);
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingVertical(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [leftWidth]);

  const handleHorizontalDrag = useCallback((e: React.MouseEvent) => {
    setIsDraggingHorizontal(true);
    const startY = e.clientY;
    const startHeight = topHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!containerRef.current) return;
      const containerHeight = containerRef.current.offsetHeight;
      const deltaY = moveEvent.clientY - startY;
      const deltaPercent = (deltaY / containerHeight) * 100;
      const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
      setTopHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDraggingHorizontal(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [topHeight]);

  // Function to apply changes and update preview
  const generatePreview = useCallback((
    html: string,
    css: string,
    config: WidgetConfig,
    styleJson: string,
    color: string,
    fonts: typeof defaultFontSettings,
    imageToDisplay?: string
  ) => {
    const containerStyle = resolvePreviewContainerStyle(config, styleJson);
    const appliedTitleColor = color;
    const appliedFontSettings = fonts;

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

    const contentToRender = imageToDisplay
      ? `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; background: transparent;">
           <img src="${imageToDisplay}" style="max-width: 90%; max-height: 90%; object-fit: contain; display: block;" />
         </div>`
      : html;

    const previewChrome = getWidgetPreviewThemeChrome(isDarkPreview);

    // Create a blob URL with the HTML/CSS content
    const htmlContent = `
      <!DOCTYPE html>
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
            body {
              position: relative;
            }
            ${css}
            .preview-container {
              position: absolute;
              inset: 0;
              background-color: ${containerStyle.backgroundColor || previewChrome.cardBackground};
              color: ${containerStyle.color};
              padding: ${containerStyle.padding};
              margin: ${containerStyle.margin};
              border-radius: ${containerStyle.borderRadius || '14px'};
              display: flex;
              flex-direction: column;
              border: 1px solid ${previewChrome.frameBorder};
              box-shadow: ${containerStyle.boxShadow || previewChrome.frameShadow};
              box-sizing: border-box;
              overflow: hidden;
            }
            .widget-title {
              display: flex;
              align-items: center;
              gap: 8px;
              color: ${appliedTitleColor};
              font-size: ${appliedFontSettings.size ? `${appliedFontSettings.size}${appliedFontSettings.sizeUnit}` : '16px'};
              font-family: ${appliedFontSettings.fontFamily || 'inherit'};
              font-weight: ${appliedFontSettings.weight || '400'};
              font-style: ${appliedFontSettings.style || 'normal'};
              line-height: ${appliedFontSettings.lineHeight || 'normal'};
              padding: 8px 12px;
              margin: 0;
              border-bottom: 1px solid ${previewChrome.titleBorder};
              flex-shrink: 0;
            }
            .widget-title-icon {
              flex-shrink: 0;
              display: inline-flex;
            }
            .widget-title-text {
              min-width: 0;
            }
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
            .widget-content > * {
              max-width: 100%;
              max-height: 100%;
            }
          </style>
        </head>
        <body>
          <div class="preview-container">
            ${config.showTitle ? `<div class="widget-title" title="${titleTooltip}">${titleIconHtml}<span class="widget-title-text">${titleText}</span></div>` : ''}
            <div class="widget-content">
              ${contentToRender}
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    // Update the preview with new content
    setLoadedImageUrl((prev) => {
      // Never revoke the artworkUrl itself
      if (prev && prev.startsWith('blob:') && prev !== artworkUrl && prev !== imageToDisplay) {
        URL.revokeObjectURL(prev);
      }
      return blobUrl;
    });
    setIsHtmlContent(true);
  }, [artworkUrl, isDarkPreview]);

  useEffect(() => {
    if (loading || !widgetDetails) return;
    const widgetType = String((widgetDetails?.descriptor as { type?: string })?.type || "");
    const isStandardWidget =
      widgetType !== "static" ||
      !htmlCode ||
      htmlCode.includes("<tb-") ||
      htmlCode.includes("<canvas");
    generatePreview(
      htmlCode,
      cssCode,
      widgetConfig,
      widgetStyleJson,
      titleColor,
      fontSettings,
      isStandardWidget ? artworkUrl : undefined,
    );
  }, [isDarkPreview]);

  const handleApplyChanges = () => {
    setWidgetConfig(draftWidgetConfig);
    setWidgetStyleJson(draftWidgetStyleJson);
    setTitleColor(draftTitleColor);
    setFontSettings(draftFontSettings);

    const widgetType = (widgetDetails?.descriptor as any)?.type || "";
    const isStandardWidget =
      widgetType !== "static" ||
      !htmlCode ||
      htmlCode.includes("<tb-") ||
      htmlCode.includes("<canvas");

    generatePreview(
      htmlCode,
      cssCode,
      draftWidgetConfig,
      draftWidgetStyleJson,
      draftTitleColor,
      draftFontSettings,
      isStandardWidget ? artworkUrl : undefined
    );
    toast.success("Changes applied to preview!");
  };

  // Function to run the code and update preview
  const handleRunCode = () => {
    handleApplyChanges();
  };

  const loadBundlesForSaveAs = useCallback(async () => {
    setBundlesLoading(true);
    try {
      const response = await listWidgetBundles({
        page: 0,
        page_size: 50,
        sort_property: "title",
        sort_order: "ASC",
        tenant_only: false,
        full_search: false,
        scada_first: false,
      });
      const options = (response.data ?? []).map(toWidgetBundleTableRow);
      setBundleOptions(options);

      const preferredNames = new Set(
        widget.bundles.map((b) => b.trim().toLowerCase()).filter(Boolean),
      );
      const matched =
        options.find(
          (b) =>
            preferredNames.has(b.title.toLowerCase()) ||
            preferredNames.has(b.alias.toLowerCase()),
        ) ?? options[0];
      setSaveAsBundleId(matched?.id ?? "");
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to load widget bundles."));
      setBundleOptions([]);
      setSaveAsBundleId("");
    } finally {
      setBundlesLoading(false);
    }
  }, [widget.bundles]);

  useEffect(() => {
    if (saveAsDialogOpen) {
      void loadBundlesForSaveAs();
    }
  }, [saveAsDialogOpen, loadBundlesForSaveAs]);

  const handleOpenSaveAs = useCallback(() => {
    setSaveAsTitle(widget.title || "");
    setSaveAsBundleId("");
    setSaveAsDialogOpen(true);
  }, [widget.title]);

  const handleSave = async () => {
    try {
      setLoading(true);

      // Parse existing defaultConfig to preserve other fields if any, 
      // but override with the required ones from the user's requested payload structure
      let existingConfig = {};
      try {
        const configStr = String((widgetDetails?.descriptor as any)?.defaultConfig || "");
        if (configStr) {
          existingConfig = JSON.parse(configStr);
        }
      } catch (e) {
        console.warn("Failed to parse existing defaultConfig", e);
      }

      const payload = {
        version: String(widgetDetails?.version || "1"),
        name: widgetDetails?.name || widget.title || "My Custom Widget",
        deprecated: widgetDetails?.deprecated ?? false,
        scada: widgetDetails?.scada ?? false,
        widgetsBundleId: (widgetDetails as any)?.widgetsBundleId || (widget.raw as any)?.widgetsBundleId || "",
        image: widgetDetails?.image || (widget.raw as any)?.image || null,
        descriptor: {
          ...(widgetDetails?.descriptor as any || {}),
          templateHtml: htmlCode,
          templateCss: cssCode,
          controllerScript: jsCode,
          defaultConfig: JSON.stringify({
            ...existingConfig,
            datasources: [],
            showTitle: widgetConfig.showTitle,
            backgroundColor: widgetConfig.backgroundColor || "#fff",
            color: widgetConfig.textColor || "rgba(0,0,0,0.87)",
            padding: widgetConfig.padding || "8px",
            settings: {},
            title: widgetConfig.title || widgetDetails?.name || widget.title,
          }),
        },
      };

      console.log("Saving widget with payload:", payload);
      await saveWidgetType(payload);
      toast.success("Widget saved successfully");
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to save widget"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAs = useCallback(async () => {
    const name = saveAsTitle.trim();
    if (!name) {
      toast.error("Title is required.");
      return;
    }
    if (!saveAsBundleId) {
      toast.error("Please select a bundle.");
      return;
    }

    setSavingAs(true);
    try {
      const descriptor = buildDescriptorForSave(
        widgetDetails?.descriptor,
        htmlCode,
        cssCode,
        jsCode,
        widgetConfig,
        widgetStyleJson,
      );

      await saveWidgetType({
        version: String(widgetDetails?.version ?? ""),
        name,
        deprecated: Boolean(widgetDetails?.deprecated ?? false),
        scada: Boolean(widgetDetails?.scada ?? false),
        widgetsBundleId: saveAsBundleId,
        image: widgetDetails?.image || (widget.raw as any)?.image || null,
        descriptor,
      });

      toast.success("Widget saved successfully.");
      setSaveAsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error(getDisplayErrorMessage(error, "Failed to save widget."));
    } finally {
      setSavingAs(false);
    }
  }, [
    saveAsTitle,
    saveAsBundleId,
    widgetDetails,
    htmlCode,
    cssCode,
    jsCode,
    widgetConfig,
    widgetStyleJson,
  ]);

  // Toggle fullscreen preview
  const handleToggleFullscreen = () => {
    setIsPreviewFullscreen(prev => !prev);
  };

  // Toggle edit mode
  const handleToggleEditMode = () => {
    if (isEditMode) {
      // Close edit mode and sheet
      setIsEditMode(false);
      setIsEditSheetOpen(false);
      toast.info("Edit mode disabled");
    } else {
      // Open edit mode and sheet
      setIsEditMode(true);
      setIsEditSheetOpen(true);
      toast.success("Edit mode enabled");
    }
  };

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPreviewFullscreen) {
        setIsPreviewFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewFullscreen]);

  return (
    <>
      {/* Fullscreen Preview Mode */}
      {isPreviewFullscreen && (
        <div className="widgets-library-preview-fullscreen-root fixed inset-0 z-50 flex h-[100dvh] min-h-0 bg-muted">
          {/* Preview Section - full width when sheet closed, half when open (classic fullscreen) */}
          <div
            className={cn(
              "relative min-h-0 transition-all duration-300",
              isEditSheetOpen ? "h-full w-1/2 shrink-0" : "h-full w-full",
            )}
          >
            <div className="absolute top-4 left-4 z-10">
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-lg transition-colors hover:bg-accent hover:text-accent-foreground"
                title="Exit fullscreen"
              >
                <Minimize2 className="h-5 w-5" />
              </button>
            </div>
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                onClick={handleToggleEditMode}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-colors",
                  isEditMode
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-primary hover:bg-accent hover:text-accent-foreground",
                )}
                title={isEditMode ? "Disable edit mode" : "Enable edit mode"}
              >
                <Pencil className="h-5 w-5" />
              </button>
            </div>

            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
                proOptions={{ hideAttribution: true }}
                colorMode={isDarkPreview ? "dark" : "light"}
                className={widgetsLibraryPreviewFlowFullscreenClass}
                minZoom={0.1}
                maxZoom={4}
                zoomOnScroll={true}
                zoomOnPinch={true}
                panOnDrag={true}
                nodesDraggable={true}
                nodesConnectable={false}
                elementsSelectable={true}
                defaultEdgeOptions={{
                  type: 'smoothstep',
                }}
              >
                <FitViewOnChange trigger={isEditSheetOpen} />
                <Background
                  variant={BackgroundVariant.Dots}
                  gap={16}
                  size={1}
                  color={previewDotColor}
                />
                <Panel position="top-left" className="space-y-2">
                  <div className="rounded-md bg-card px-3 py-2 text-sm font-semibold text-foreground shadow">
                    {widget?.title || "Widget"}
                  </div>
                  <div className="rounded-md bg-card px-3 py-2 text-xs text-muted-foreground shadow">
                    Type: {widget?.widgetType || "Unknown"}
                  </div>
                </Panel>
              </ReactFlow>
            </ReactFlowProvider>
          </div>

          {/* Edit Panel Section - Appears on the right when open */}
          {isEditSheetOpen && (
            <WidgetEditPanel
              widgetName={String(widgetDetails?.name || widget.title || "Widget")}
              widgetFqn={String(widgetDetails?.fqn || "")}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              editMode={editMode}
              setEditMode={setEditMode}
              hasBasicMode={hasBasicMode}
              htmlCode={htmlCode}
              setHtmlCode={setHtmlCode}
              cssCode={cssCode}
              setCssCode={setCssCode}
              widgetConfig={draftWidgetConfig}
              setWidgetConfig={setDraftWidgetConfig}
              fontSettings={draftFontSettings}
              setFontSettings={setDraftFontSettings}
              isFontSettingsOpen={isFontSettingsOpen}
              setIsFontSettingsOpen={setIsFontSettingsOpen}
              titleColor={draftTitleColor}
              setTitleColor={setDraftTitleColor}
              isColorPickerOpen={isColorPickerOpen}
              setIsColorPickerOpen={setIsColorPickerOpen}
              isAdvancedTitleStyleOpen={isAdvancedTitleStyleOpen}
              setIsAdvancedTitleStyleOpen={setIsAdvancedTitleStyleOpen}
              titleStyleJson={titleStyleJson}
              setTitleStyleJson={setTitleStyleJson}
              widgetStyleJson={draftWidgetStyleJson}
              setWidgetStyleJson={setDraftWidgetStyleJson}
              onClose={() => setIsEditSheetOpen(false)}
              onApply={handleApplyChanges}
              variant="fullscreen"
              widgetType={String((widgetDetails?.descriptor as { type?: string })?.type || "")}
              artworkUrl={artworkUrl || undefined}
            />
          )}
        </div>
      )}

      {/* Normal Editor View */}
      <Card className="flex h-[calc(100vh-120px)] flex-col overflow-hidden border border-border bg-card py-0">
        <div className="flex-shrink-0 border-b border-border bg-muted px-2 py-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={onClose}
                title="Back to widgets"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              <div>
                <h2 className="text-sm font-semibold text-foreground leading-tight">{widget.title}</h2>
                <p className="text-[10px] text-muted-foreground leading-tight">Widget editor</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={handleRunCode}
                disabled={loading}
              >
                Run
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={() => toast.info("Undo changes")}
                disabled={loading}
              >
                <Undo className="h-3 w-3" />
                Undo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={handleSave}
                disabled={loading}
              >
                <Save className="h-3 w-3" />
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 gap-1 px-2 text-[10px]"
                onClick={handleOpenSaveAs}
                disabled={loading}
              >
                <Save className="h-3 w-3" />
                Save as
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-6 w-6"
                onClick={() => toast.info("Toggle fullscreen")}
                title="Toggle fullscreen"
                disabled={loading}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading widget details...</p>
            </div>
          </div>
        ) : isJsMaximized ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-background px-3 py-2">
              <p className={`text-sm ${widgetsLibrarySectionTitleClass}`}>Javascript</p>
              <div className="flex items-center gap-1">
                <button className="rounded p-1 hover:bg-muted">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </button>
                <button className="rounded p-1 hover:bg-muted">
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </button>
                <button className="rounded p-1 hover:bg-muted" onClick={() => setIsJsMaximized(false)}>
                  <Minimize2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className={widgetsLibraryEditorCodePaneClass}>
              <WidgetCodeEditorSurface
                value={jsCode}
                onChange={setJsCode}
                language="javascript"
                fillHeight
                minRows={12}
              />
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="relative flex-1 overflow-hidden bg-background">
            {/* Top Left Panel */}
            <div
              className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden"
              style={{
                left: 0,
                top: 0,
                width: `calc(${leftWidth}% - ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                height: `calc(${topHeight}% - ${EDITOR_SPLIT_HALF_GUTTER}px)`,
              }}
            >
                <Tabs defaultValue="html" className={widgetsLibraryEditorTabsRootClass}>
                  <TabsList className={widgetsLibraryEditorTabsListClass}>
                    <TabsTrigger
                      value="resources"
                      className={widgetsLibraryEditorTabTriggerClass}
                    >
                      Resources
                    </TabsTrigger>
                    <TabsTrigger
                      value="html"
                      className={widgetsLibraryEditorTabTriggerClass}
                    >
                      HTML
                    </TabsTrigger>
                    <TabsTrigger
                      value="css"
                      className={widgetsLibraryEditorTabTriggerClass}
                    >
                      CSS
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="resources" className={widgetsLibraryEditorTabsContentClass}>
                    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto rounded-md border border-border bg-card p-2">
                      <div className="rounded-md border border-border bg-muted/50 p-2">
                        <p className="text-[10px] font-semibold text-foreground mb-1">Widget Type</p>
                        <p className="text-[10px] text-muted-foreground">{(widgetDetails?.descriptor as any)?.type || "N/A"}</p>
                      </div>
                      <div className="rounded-md border border-border bg-muted/50 p-2">
                        <p className="text-[10px] font-semibold text-foreground mb-1">Size</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(widgetDetails?.descriptor as any)?.sizeX || 0} x {(widgetDetails?.descriptor as any)?.sizeY || 0}
                        </p>
                      </div>
                      <div className="min-h-0 flex-1 rounded-md border border-border bg-muted/50 p-2">
                        <p className="text-[10px] font-semibold text-foreground mb-1">Resources</p>
                        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                          {JSON.stringify((widgetDetails?.descriptor as any)?.resources || [], null, 2)}
                        </pre>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="html" className={widgetsLibraryEditorTabsContentClass}>
                    <WidgetCodeEditorSurface
                      value={htmlCode}
                      onChange={setHtmlCode}
                      language="html"
                      fillHeight
                      compact
                      minRows={8}
                    />
                  </TabsContent>
                  <TabsContent value="css" className={widgetsLibraryEditorTabsContentClass}>
                    <WidgetCodeEditorSurface
                      value={cssCode}
                      onChange={setCssCode}
                      language="css"
                      fillHeight
                      compact
                      minRows={8}
                    />
                  </TabsContent>
                </Tabs>
            </div>

            {/* Top Right Panel */}
            <div
              className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden"
              style={{
                left: `calc(${leftWidth}% + ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                top: 0,
                right: 0,
                height: `calc(${topHeight}% - ${EDITOR_SPLIT_HALF_GUTTER}px)`,
              }}
            >
                <Tabs defaultValue="settings" className={widgetsLibraryEditorTabsRootClass}>
                  <TabsList className={widgetsLibraryEditorTabsListClass}>
                    <TabsTrigger
                      value="settings"
                      className={widgetsLibraryEditorTabTriggerClass}
                    >
                      Settings form
                    </TabsTrigger>
                    <TabsTrigger
                      value="datakeys"
                      className={widgetsLibraryEditorTabTriggerClass}
                    >
                      Data key settings
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="settings" className={widgetsLibraryEditorTabsContentClass}>
                    <div className="space-y-2">
                      <div className="rounded-md border border-border bg-muted p-2">
                        <p className="text-[10px] font-medium text-muted-foreground">Image preview</p>
                        <div className="mt-1 flex items-center gap-2 rounded border border-border bg-card p-2">
                          <div className="flex h-12 w-12 items-center justify-center rounded bg-green-50">
                            <span className="text-[10px] text-green-600">IMG</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-medium">{widget.title}</p>
                            <p className="text-[9px] text-muted-foreground">200x160 · 5.9 KB</p>
                          </div>
                        </div>
                      </div>
                      {/* <div className="rounded-md border border-border bg-muted p-2">
                      <p className="text-[10px] font-medium text-muted-foreground">Description</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Widget type: {widget.widgetType}</p>
                    </div> */}
                    </div>
                  </TabsContent>
                  <TabsContent value="datakeys" className={widgetsLibraryEditorTabsContentClass}>
                    <div className="flex h-full items-center justify-center">
                      <p className="text-[10px] text-muted-foreground">Data key settings</p>
                    </div>
                  </TabsContent>
                </Tabs>
            </div>

            {/* Bottom Left Panel */}
            <div
              className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden"
              style={{
                left: 0,
                top: `calc(${topHeight}% + ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                width: `calc(${leftWidth}% - ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                bottom: 0,
              }}
            >
                <div className={widgetsLibraryEditorSectionHeaderClass}>
                  <p className={`text-[10px] ${widgetsLibrarySectionTitleClass}`}>Javascript</p>
                  <div className="flex items-center gap-1">
                    <button className="rounded p-0.5 hover:bg-muted">
                      <Settings className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button className="rounded p-0.5 hover:bg-muted">
                      <HelpCircle className="h-3 w-3 text-muted-foreground" />
                    </button>
                    <button className="rounded p-0.5 hover:bg-muted" onClick={() => setIsJsMaximized(true)}>
                      <Maximize2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div className={widgetsLibraryEditorCodePaneClass}>
                  <WidgetCodeEditorSurface
                    value={jsCode}
                    onChange={setJsCode}
                    language="javascript"
                    fillHeight
                    compact
                    minRows={8}
                  />
                </div>
            </div>

            {/* Bottom Right Panel */}
            <div
              className="absolute flex min-h-0 min-w-0 flex-col overflow-hidden"
              style={{
                left: `calc(${leftWidth}% + ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                top: `calc(${topHeight}% + ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                right: 0,
                bottom: 0,
              }}
            >
                <div className={cn(widgetsLibraryEditorSectionHeaderClass, "px-2")}>
                  <p className={`text-[10px] ${widgetsLibrarySectionTitleClass}`}>Widget Preview</p>
                  <button
                    onClick={handleRunCode}
                    className="rounded p-0.5 hover:bg-muted"
                    title="Refresh preview"
                  >
                    <RefreshCw className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
                <div className={widgetsLibraryPreviewPaneClass}>
                  {/* Floating Action Buttons */}
                  <div className="absolute top-4 left-4 z-10">
                    <button
                      type="button"
                      onClick={handleToggleFullscreen}
                      className="widgets-library-preview-fab h-10 w-10"
                      title="Toggle fullscreen"
                    >
                      <Maximize2 className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      type="button"
                      onClick={handleToggleEditMode}
                      className={cn(
                        "widgets-library-preview-fab h-12 w-12",
                        isEditMode
                          ? "widgets-library-preview-fab--active"
                          : "widgets-library-preview-fab--primary",
                      )}
                      title={isEditMode ? "Disable edit mode" : "Enable edit mode"}
                    >
                      <Pencil className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Popup overlay for minimized view - positioned within card */}
                  {isEditSheetOpen && !isPreviewFullscreen && (
                    <div className="absolute top-16 right-2 bottom-2 z-20 flex min-h-0 w-[min(500px,45%)] min-w-[min(100%,400px)] max-w-[500px] flex-col">
                      <WidgetEditPanel
                        widgetName={String(widgetDetails?.name || widget.title || "Widget")}
                        widgetFqn={String(widgetDetails?.fqn || "")}
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        editMode={editMode}
                        setEditMode={setEditMode}
                        hasBasicMode={hasBasicMode}
                        htmlCode={htmlCode}
                        setHtmlCode={setHtmlCode}
                        cssCode={cssCode}
                        setCssCode={setCssCode}
                        widgetConfig={draftWidgetConfig}
                        setWidgetConfig={setDraftWidgetConfig}
                        fontSettings={draftFontSettings}
                        setFontSettings={setDraftFontSettings}
                        isFontSettingsOpen={isFontSettingsOpen}
                        setIsFontSettingsOpen={setIsFontSettingsOpen}
                        titleColor={draftTitleColor}
                        setTitleColor={setDraftTitleColor}
                        isColorPickerOpen={isColorPickerOpen}
                        setIsColorPickerOpen={setIsColorPickerOpen}
                        isAdvancedTitleStyleOpen={isAdvancedTitleStyleOpen}
                        setIsAdvancedTitleStyleOpen={setIsAdvancedTitleStyleOpen}
                        titleStyleJson={titleStyleJson}
                        setTitleStyleJson={setTitleStyleJson}
                        widgetStyleJson={draftWidgetStyleJson}
                        setWidgetStyleJson={setDraftWidgetStyleJson}
                        onClose={() => setIsEditSheetOpen(false)}
                        onApply={handleApplyChanges}
                        variant="minimized"
                        widgetType={String((widgetDetails?.descriptor as { type?: string })?.type || "")}
                        artworkUrl={artworkUrl || undefined}
                      />
                    </div>
                  )}

                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      nodeTypes={nodeTypes}
                      fitView
                      fitViewOptions={{ padding: 0.1 }}
                      proOptions={{ hideAttribution: true }}
                      colorMode={isDarkPreview ? "dark" : "light"}
                      className={widgetsLibraryPreviewFlowClass}
                      minZoom={0.5}
                      maxZoom={1.5}
                      zoomOnScroll={false}
                      zoomOnPinch={false}
                      zoomOnDoubleClick={false}
                      panOnDrag={false}
                      panOnScroll={false}
                      nodesDraggable={false}
                      nodesConnectable={false}
                      nodesFocusable={false}
                      elementsSelectable={false}
                      defaultEdgeOptions={{
                        type: 'smoothstep',
                      }}
                    >
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
            </div>

            {/* Vertical splitter — full height so it crosses the horizontal bar */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize columns"
              className={cn("group", widgetsLibraryEditorSplitterVerticalClass)}
              style={{
                left: `calc(${leftWidth}% - ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                top: 0,
                bottom: 0,
              }}
              onMouseDown={handleVerticalDrag}
            >
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </div>

            {/* Horizontal splitter — full width */}
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize rows"
              className={cn("group", widgetsLibraryEditorSplitterHorizontalClass)}
              style={{
                top: `calc(${topHeight}% - ${EDITOR_SPLIT_HALF_GUTTER}px)`,
                left: 0,
                right: 0,
              }}
              onMouseDown={handleHorizontalDrag}
            >
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90">
                <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Widget Sheet - Disabled (using inline panels instead) */}
      <Sheet open={false} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[540px] overflow-y-auto p-0">
          {/* Header with Tabs */}
          <div className="bg-primary text-primary-foreground">
            <div className="px-6 py-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium">{String(widgetDetails?.name || widget.title || "Widget")}</h2>
                <p className="text-xs text-primary-foreground">{String(widgetDetails?.fqn || "")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground hover:text-primary rounded-full"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground hover:text-primary rounded-full"
                  onClick={() => setIsEditSheetOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Tabs and Action Buttons */}
            <div className="px-6 pb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('widget-card')}
                  className={`${activeTab === 'widget-card' ? widgetsLibraryPanelActiveTabClass : widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} h-8 px-4 text-xs font-normal`}
                >
                  Widget card
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('actions')}
                  className={`${activeTab === 'actions' ? widgetsLibraryPanelActiveTabClass : widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} h-8 px-4 text-xs font-normal`}
                >
                  Actions
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('layout')}
                  className={`${activeTab === 'layout' ? widgetsLibraryPanelActiveTabClass : widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} h-8 px-4 text-xs font-normal`}
                >
                  Layout
                </Button>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} h-7 px-2 text-xs gap-1`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-primary-foreground"></span>
                  Preview
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} h-7 px-2 text-xs gap-1`}
                >
                  <X className="h-3 w-3" />
                  Decline
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`${widgetsLibraryPanelInactiveTabClass} ${widgetsLibraryPanelHeaderHoverClass} h-7 px-2 text-xs gap-1`}
                  onClick={handleApplyChanges}
                >
                  <span>✓</span>
                  Apply
                </Button>
              </div>
            </div>
          </div>

          {/* Content with Tab-based sections */}
          <div className={`${widgetsLibraryPanelSurfaceClass} min-h-[500px]`}>
            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="p-2 space-y-2">
                {/* HTML Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">
                      HTML <span className="text-red-500">*</span>
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Tidy
                    </Button>
                  </div>
                  <textarea
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    className="w-full h-24 px-3 py-2 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Enter HTML code here"
                  />
                </div>

                {/* CSS Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-foreground">CSS</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Tidy
                    </Button>
                  </div>
                  <textarea
                    value={cssCode}
                    onChange={(e) => setCssCode(e.target.value)}
                    className="w-full h-48 px-3 py-2 text-xs font-mono bg-background border border-border rounded focus:outline-none focus:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Enter CSS code here"
                  />
                </div>
              </div>
            )}

            {/* Widget Card Tab */}
            {activeTab === 'widget-card' && (
              <div className="p-2 space-y-2">
                {/* Card title Section */}
                <div className="bg-card rounded-lg border border-border p-3 space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Card title</h3>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="display-title-sheet"
                      checked={draftWidgetConfig.showTitle}
                      onCheckedChange={(checked) => setDraftWidgetConfig({ ...draftWidgetConfig, showTitle: checked })}
                    />
                    <Label htmlFor="display-title-sheet" className="text-sm text-foreground cursor-pointer">
                      Display widget title
                    </Label>
                  </div>

                  <div className="flex items-center gap-4">
                    <Label className="text-sm text-foreground w-32 flex-shrink-0">Title</Label>
                    <div className="flex gap-2 flex-1">
                      <Input
                        value={draftWidgetConfig.title}
                        onChange={(e) => setDraftWidgetConfig({ ...draftWidgetConfig, title: e.target.value })}
                        className="flex-1 h-9 text-sm"
                        disabled={!draftWidgetConfig.showTitle}
                      />
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!draftWidgetConfig.showTitle}>
                        <Type className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" disabled={!draftWidgetConfig.showTitle}>
                        <Palette className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Label className="text-sm text-foreground w-32 flex-shrink-0">Title Tooltip</Label>
                    <Input
                      value={draftWidgetConfig.titleTooltip}
                      onChange={(e) => setDraftWidgetConfig({ ...draftWidgetConfig, titleTooltip: e.target.value })}
                      className="flex-1 h-9 text-sm"
                      placeholder="Set"
                      disabled={!draftWidgetConfig.showTitle}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="display-icon-sheet"
                      checked={draftWidgetConfig.showTitleIcon}
                      onCheckedChange={(checked) => {
                        if (!checked) {
                          setIsIconPickerOpen(false);
                          setIsIconColorPickerOpen(false);
                        }
                        setDraftWidgetConfig({ ...draftWidgetConfig, showTitleIcon: checked });
                      }}
                      disabled={!draftWidgetConfig.showTitle}
                    />
                    <Label htmlFor="display-icon-sheet" className="text-sm text-foreground cursor-pointer flex-1">
                      Display title icon
                    </Label>
                    <IconSizeInput
                      value={draftWidgetConfig.iconSize}
                      onChange={(iconSize) => setDraftWidgetConfig({ ...draftWidgetConfig, iconSize })}
                      disabled={!draftWidgetConfig.showTitle || !draftWidgetConfig.showTitleIcon}
                    />
                    <IconPickerPopover
                      isOpen={isIconPickerOpen}
                      onOpenChange={setIsIconPickerOpen}
                      icon={draftWidgetConfig.titleIcon}
                      onIconChange={(titleIcon) => setDraftWidgetConfig({ ...draftWidgetConfig, titleIcon })}
                      disabled={!draftWidgetConfig.showTitle || !draftWidgetConfig.showTitleIcon}
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 bg-background"
                        disabled={!draftWidgetConfig.showTitle || !draftWidgetConfig.showTitleIcon}
                        type="button"
                      >
                        {draftWidgetConfig.titleIcon ? (
                          <LucideIconByName
                            name={draftWidgetConfig.titleIcon}
                            className="h-4 w-4 shrink-0"
                            style={{ color: draftWidgetConfig.iconColor || "#000000" }}
                          />
                        ) : null}
                      </Button>
                    </IconPickerPopover>
                    <ColorPickerPopover
                      isOpen={isIconColorPickerOpen}
                      onOpenChange={setIsIconColorPickerOpen}
                      color={draftWidgetConfig.iconColor || "#000000"}
                      setColor={(color) => setDraftWidgetConfig({ ...draftWidgetConfig, iconColor: color })}
                      previewText={draftWidgetConfig.title || "Icon Preview"}
                      previewIconName={draftWidgetConfig.titleIcon || undefined}
                      previewIconSizePx={parseIconSizePx(draftWidgetConfig.iconSize, 32)}
                      label="Icon Color"
                      disabled={!draftWidgetConfig.showTitle || !draftWidgetConfig.showTitleIcon}
                    >
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0"
                        disabled={!draftWidgetConfig.showTitle || !draftWidgetConfig.showTitleIcon}
                      >
                        <Palette className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </ColorPickerPopover>
                  </div>

                  <div className="border-t border-border pt-4">
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
                            className="w-full h-32 p-3 text-sm font-mono border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus-visible:ring-ring"
                            spellCheck={false}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                          >
                            <Maximize2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card style Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold text-foreground">Card style</h3>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Text color</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded border border-border bg-black"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Background color</Label>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded border border-border bg-card"></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Padding</Label>
                    <Input defaultValue="9px" className="w-32 h-9 text-sm text-right" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Margin</Label>
                    <Input defaultValue="Set" className="w-32 h-9 text-sm text-right" />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-foreground">Border radius</Label>
                    <Input defaultValue="Set" className="w-32 h-9 text-sm text-right" />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch id="drop-shadow" defaultChecked />
                    <Label htmlFor="drop-shadow" className="text-sm text-foreground cursor-pointer">
                      Drop shadow
                    </Label>
                  </div>

                  <button type="button" className={widgetsLibraryAccordionTriggerClass}>
                    <span>Advanced widget style</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </div>

                {/* Card buttons Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold text-foreground">Card buttons</h3>

                  <div className="flex items-center gap-2">
                    <Switch id="enable-fullscreen" defaultChecked />
                    <Label htmlFor="enable-fullscreen" className="text-sm text-foreground cursor-pointer">
                      Enable fullscreen
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Actions Tab */}
            {activeTab === 'actions' && (
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Actions</h3>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Search className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  {/* Table */}
                  <div className="border rounded-lg bg-card overflow-hidden">
                    <div className="border-b bg-muted">
                      <div className="grid grid-cols-4 gap-4 px-4 py-3">
                        <div className="text-xs font-medium text-foreground flex items-center gap-1">
                          Action source
                          <ChevronDown className="h-3 w-3" />
                        </div>
                        <div className="text-xs font-medium text-foreground">Name</div>
                        <div className="text-xs font-medium text-foreground">Icon</div>
                        <div className="text-xs font-medium text-foreground">Type</div>
                      </div>
                    </div>

                    <div className="py-20 flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">No actions found</p>
                    </div>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-2">
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">1-0 of 0</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                          <span className="text-muted-foreground">&lt;</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
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
              <div className="p-2 space-y-2">
                {/* Resize options Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Resize options</h3>

                  <div className="flex items-center gap-2">
                    <Switch id="resizable" defaultChecked />
                    <Label htmlFor="resizable" className="text-sm text-foreground cursor-pointer">
                      Resizable
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch id="preserve-aspect" />
                    <Label htmlFor="preserve-aspect" className="text-sm text-foreground cursor-pointer">
                      Preserve aspect ratio
                    </Label>
                  </div>
                </div>

                {/* Mobile Section */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-sm font-semibold text-foreground">Mobile</h3>

                  <div className="flex items-center gap-2">
                    <Switch id="hide-mobile" />
                    <Label htmlFor="hide-mobile" className="text-sm text-foreground cursor-pointer">
                      Hide widget in mobile mode
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch id="hide-desktop" />
                    <Label htmlFor="hide-desktop" className="text-sm text-foreground cursor-pointer">
                      Hide widget in desktop mode
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">Order</Label>
                    <Select defaultValue="set">
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="set">Set</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">Height</Label>
                    <Select defaultValue="set">
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="set">Set</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={saveAsDialogOpen} onOpenChange={setSaveAsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save as</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="save-as-title">Title</Label>
              <Input
                id="save-as-title"
                value={saveAsTitle}
                onChange={(e) => setSaveAsTitle(e.target.value)}
                placeholder="Enter widget title"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveAs();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="save-as-bundle">Bundles</Label>
              <Select
                value={saveAsBundleId}
                onValueChange={setSaveAsBundleId}
                disabled={bundlesLoading || bundleOptions.length === 0}
              >
                <SelectTrigger id="save-as-bundle" className="w-full">
                  <SelectValue
                    placeholder={
                      bundlesLoading
                        ? "Loading bundles..."
                        : bundleOptions.length === 0
                          ? "No bundles available"
                          : "Select bundle"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {bundleOptions.map((bundle) => (
                    <SelectItem key={bundle.id} value={bundle.id}>
                      {bundle.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveAsDialogOpen(false)}
              disabled={savingAs}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveAs()}
              disabled={savingAs || bundlesLoading || !saveAsBundleId}
            >
              {savingAs ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

