import { cn } from "@/lib/utils";

/** Page-level tabs (Widgets / Widgets bundles) — icon + label; border underline on active tab only */
export const widgetsLibraryPageTabsClass = "widgets-library-page-tabs gap-3";

export const widgetsLibraryPageTabListClass =
  "inline-flex !h-auto w-auto max-w-max items-end justify-start gap-2 !rounded-none border-b border-border !bg-background !p-0 !shadow-none";

export const widgetsLibraryPageTabTriggerClass =
  "inline-flex !h-auto !min-h-0 !flex-none -mb-px min-w-[12rem] items-center justify-center gap-2 rounded-none border-x-0 border-t-0 border-b-2 border-b-transparent !bg-transparent !bg-none px-10 py-2.5 text-sm font-medium text-muted-foreground !shadow-none transition-colors hover:!bg-transparent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 data-[state=inactive]:border-b-transparent data-[state=inactive]:!shadow-none data-[state=active]:!border-b-2 data-[state=active]:!border-b-[var(--primary)] data-[state=active]:!bg-transparent data-[state=active]:!bg-none data-[state=active]:text-primary data-[state=active]:[&_svg]:text-primary";

/** Wider tab for the longer “Widgets bundles” label */
export const widgetsLibraryPageTabTriggerBundlesClass = cn(
  widgetsLibraryPageTabTriggerClass,
  "min-w-[16rem]",
);

/** Underline tabs in the widget editor — colors via widgetsLibraryEditorHeader.css */
export const widgetsLibraryEditorTabTriggerClass =
  "rounded-none px-2 py-1.5 text-[10px] font-medium shadow-none transition-colors";

/** Editor pane tabs root — flat headers via widgets-library-editor-tabs */
export const widgetsLibraryEditorTabsRootClass =
  "widgets-library-editor-tabs flex h-full min-h-0 flex-col gap-0 bg-card";

export const widgetsLibraryEditorTabsListClass =
  "h-auto w-full shrink-0 justify-start gap-1 rounded-none bg-transparent px-3 py-0";

/** Tab body — full-height code editor slot (flush, no inner frame) */
export const widgetsLibraryEditorTabsContentClass =
  "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden p-0 focus-visible:outline-none";

/** Code editor body below section headers (Javascript, etc.) */
export const widgetsLibraryEditorCodePaneClass =
  "flex min-h-0 flex-1 flex-col overflow-hidden p-0";

/** Active sheet tab (e.g. bundle Details) */
export const widgetsLibrarySheetTabClass =
  "border-b-2 border-primary pb-2 text-xs font-medium text-primary";

/** Section headers (Javascript, Widget Preview, etc.) */
export const widgetsLibrarySectionTitleClass =
  "widgets-library-editor-section-title text-[10px] font-medium";

/** Editor section header strip — flat, matches tab row */
export const widgetsLibraryEditorSectionHeaderClass =
  "widgets-library-editor-section-header flex shrink-0 items-center justify-between bg-transparent px-3 py-1.5";

/** Secondary action chips on bundle detail sheet */
export const widgetsLibraryActionChipClass =
  "border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-accent hover:text-accent-foreground";

/** Info banner on bundle detail sheet */
export const widgetsLibraryInfoBannerClass =
  "flex items-center gap-2.5 rounded-lg border border-border bg-secondary px-3 py-2";

/** Widget preview outer pad — see widgetsLibraryPreview.css */
export const widgetsLibraryPreviewPaneClass = "widgets-library-preview-pane";

/** ReactFlow canvas inside embedded preview stage (CSS dot grid) */
export const widgetsLibraryPreviewFlowClass = "widgets-library-preview-canvas";

/** ReactFlow canvas in fullscreen — classic muted surface + xyflow Background */
export const widgetsLibraryPreviewFlowFullscreenClass =
  "widgets-library-preview-fullscreen-canvas h-full w-full";

export const widgetsLibraryPreviewPanelAreaClass = "widgets-library-preview-panel-area";

/** Full-span resize gutters — color in widgetsLibraryEditorHeader.css */
export const widgetsLibraryEditorSplitterVerticalClass =
  "widgets-library-editor-splitter-vertical absolute z-30 w-[3px] cursor-col-resize";

export const widgetsLibraryEditorSplitterHorizontalClass =
  "widgets-library-editor-splitter-horizontal absolute z-20 h-[3px] cursor-row-resize";

/** Solid surfaces for editor panels (no opacity modifiers) */
export const widgetsLibraryPanelSurfaceClass = "bg-card";

/** Above fullscreen preview, edit-panel overlays, and dashboard/chart Sheets (z-[1100]). */
export const widgetsLibraryOverlayZClass = "z-[1200]";

export const widgetsLibraryPopoverContentClass = cn(
  widgetsLibraryOverlayZClass,
  "border-border bg-popover shadow-lg",
);

/** Widget edit panel shell — styles in widgetsLibraryEditPanel.css */
export const widgetsLibraryEditPanelShellClass =
  "widgets-library-edit-panel flex h-full flex-col overflow-hidden bg-card";

export const widgetsLibraryEditPanelContentClass =
  "widgets-library-edit-panel__body min-h-0 flex-1 overflow-y-auto";

export const widgetsLibraryEditPanelContentPreviewClass =
  "widgets-library-edit-panel__body widgets-library-edit-panel__body--preview";

export const widgetsLibraryEditPanelTabContentClass =
  "widgets-library-edit-panel__tab-content";

export const widgetsLibraryEditPanelAppearanceClass =
  "widgets-library-edit-panel__tab-content widgets-library-edit-panel__tab-content--appearance";

/** Widget card / Layout tabs — original bordered sections (unchanged look) */
export const widgetsLibraryEditPanelLegacyTabClass = "space-y-4";

export const widgetsLibraryEditPanelLegacySectionClass =
  "space-y-2 rounded-lg border border-border bg-card p-3";

export const widgetsLibraryEditPanelLegacyFieldRowClass =
  "flex items-center rounded-md border border-border bg-card px-3 py-2";

export const widgetsLibraryEditPanelLegacyCodeSurfaceClass =
  "rounded-md border border-border bg-card overflow-hidden";

export const widgetsLibraryEditPanelLegacyCodeGutterClass =
  "shrink-0 border-r border-border bg-muted/50 px-2.5 py-2 text-right font-mono text-[11px] leading-5 text-muted-foreground select-none";

export const widgetsLibraryEditPanelSectionClass = "widgets-library-edit-panel__section";

export const widgetsLibraryEditPanelSectionHeadClass =
  "widgets-library-edit-panel__section-head";

export const widgetsLibraryEditPanelSectionBodyClass =
  "widgets-library-edit-panel__section-body";

export const widgetsLibraryEditPanelFieldRowClass =
  "widgets-library-edit-panel__field-row flex items-center gap-3 px-0";

export const widgetsLibraryEditPanelToggleRowClass =
  "widgets-library-edit-panel__toggle-row";

export const widgetsLibraryEditPanelAccordionClass =
  "widgets-library-edit-panel__accordion";

export const widgetsLibraryEditPanelAccordionPanelClass =
  "widgets-library-edit-panel__accordion-panel";

/** Bordered code area in widget edit panel only (not main editor) */
export const widgetsLibraryEditPanelCodeSurfaceClass =
  "widgets-library-edit-panel__code-surface rounded-md border border-border overflow-hidden";

export const widgetsLibraryEditPanelCodeGutterClass =
  "widgets-library-edit-panel__code-gutter shrink-0 border-r px-2.5 py-2 text-right font-mono text-[11px] leading-5";

export const widgetsLibraryEditPanelCodeCardClass =
  "widgets-library-edit-panel__code-card";

export const widgetsLibraryEditPanelCodeCardGrowClass =
  "widgets-library-edit-panel__code-card widgets-library-edit-panel__code-card--grow";

export const widgetsLibraryEditPanelCodeCardHeadClass =
  "widgets-library-edit-panel__code-card-head";

export const widgetsLibraryEditPanelCodeLabelClass =
  "widgets-library-edit-panel__code-label";

export const widgetsLibraryEditPanelCodeLabelBadgeClass =
  "widgets-library-edit-panel__code-label-badge";

export const widgetsLibraryEditPanelCodeTextareaClass =
  "widgets-library-edit-panel__code-textarea";

/** Active tab on primary-colored edit panel header */
export const widgetsLibraryPanelActiveTabClass =
  "bg-primary-foreground text-primary shadow-sm";

/** Inactive tab on primary-colored edit panel header */
export const widgetsLibraryPanelInactiveTabClass = "bg-primary text-primary-foreground";

/** Hover for tabs/buttons on primary-colored header */
export const widgetsLibraryPanelHeaderHoverClass =
  "hover:bg-primary-foreground hover:text-primary";

/** Widget card / Layout accordions — original style */
export const widgetsLibraryAccordionTriggerClass =
  "flex h-9 w-full items-center justify-between gap-2 rounded-sm px-0 text-left text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground";

/** Read-only table checkboxes (System / Deprecated) — visible border when disabled */
export const widgetsLibraryTableCheckboxClass =
  "h-[18px] w-[18px] border-2 border-muted-foreground/50 bg-background shadow-none disabled:cursor-default disabled:opacity-100 data-[state=checked]:border-primary";
