import { cn } from '@/lib/utils';

/** Shared Tailwind classes for the form builder (no external CSS). */
export const formBuilderCanvasSurfaceClass = cn(
  'min-h-0 flex-1 overflow-y-auto bg-gray-surface p-3',
  '[background-image:radial-gradient(color-mix(in_srgb,var(--gray-border)_55%,transparent)_1px,transparent_1px)]',
  '[background-size:20px_20px]',
);

export const formBuilderFormZoneClass = cn(
  'mx-auto w-full max-w-5xl rounded-xl border border-gray-border/80 bg-gray-elevated/95 shadow-sm',
  'shadow-gray-text/[0.03]',
);

export const formBuilderFieldSelectedClass = cn(
  'shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_4px_14px_color-mix(in_srgb,var(--primary)_12%,transparent)]',
);

export const formBuilderFadeInClass = 'animate-in fade-in slide-in-from-bottom-1.5 duration-300';

export const formBuilderFieldEnterClass = 'animate-in fade-in slide-in-from-bottom-1.5 duration-200';

/** Parent wrapper for react-grid-layout — third-party child selectors via Tailwind. */
export const formBuilderGridCanvasClass = cn(
  'relative w-full',
  '[&_.react-grid-layout]:relative [&_.react-grid-layout]:min-h-[inherit]',
  '[&_.react-grid-item]:box-border [&_.react-grid-item]:transition-[box-shadow] [&_.react-grid-item]:duration-150',
  '[&_.react-grid-item:hover]:z-[3]',
  '[&_.react-grid-item.react-grid-placeholder]:z-[2] [&_.react-grid-item.react-grid-placeholder]:rounded-lg',
  '[&_.react-grid-item.react-grid-placeholder]:border-2 [&_.react-grid-item.react-grid-placeholder]:border-dashed',
  '[&_.react-grid-item.react-grid-placeholder]:border-primary/45 [&_.react-grid-item.react-grid-placeholder]:bg-primary/15',
  '[&_.react-grid-item.react-grid-placeholder]:opacity-100',
  '[&_.react-grid-item>.react-resizable-handle]:z-40',
  '[&_.react-grid-item>.react-resizable-handle::after]:border-none',
  '[&_.react-grid-item>.react-resizable-handle-s]:!bottom-0 [&_.react-grid-item>.react-resizable-handle-s]:!h-2 [&_.react-grid-item>.react-resizable-handle-s]:cursor-s-resize [&_.react-grid-item>.react-resizable-handle-s]:opacity-0',
  '[&_.react-grid-item>.react-resizable-handle-e]:!right-0 [&_.react-grid-item>.react-resizable-handle-e]:!w-2 [&_.react-grid-item>.react-resizable-handle-e]:cursor-e-resize [&_.react-grid-item>.react-resizable-handle-e]:opacity-0',
  '[&_.react-grid-item:hover>.react-resizable-handle-s]:opacity-35 [&_.react-grid-item:hover>.react-resizable-handle-s]:!bg-primary/25',
  '[&_.react-grid-item:hover>.react-resizable-handle-e]:opacity-35 [&_.react-grid-item:hover>.react-resizable-handle-e]:!bg-primary/25',
  '[&_.react-grid-item>.react-resizable-handle-se]:!bottom-0.5 [&_.react-grid-item>.react-resizable-handle-se]:!right-0.5',
  '[&_.react-grid-item>.react-resizable-handle-se]:!h-4 [&_.react-grid-item>.react-resizable-handle-se]:!w-4',
  '[&_.react-grid-item>.react-resizable-handle-se]:cursor-se-resize [&_.react-grid-item>.react-resizable-handle-se]:rounded-br-lg [&_.react-grid-item>.react-resizable-handle-se]:rounded-tl-sm',
  '[&_.react-grid-item>.react-resizable-handle-se]:bg-primary/85 [&_.react-grid-item>.react-resizable-handle-se]:opacity-55',
  '[&_.react-grid-item:hover>.react-resizable-handle-se]:opacity-100',
  "[&_.react-grid-item>.react-resizable-handle-se::after]:!block [&_.react-grid-item>.react-resizable-handle-se::after]:!content-['']",
  '[&_.react-grid-item>.react-resizable-handle-se::after]:absolute [&_.react-grid-item>.react-resizable-handle-se::after]:bottom-0.5 [&_.react-grid-item>.react-resizable-handle-se::after]:right-0.5',
  '[&_.react-grid-item>.react-resizable-handle-se::after]:h-1.5 [&_.react-grid-item>.react-resizable-handle-se::after]:w-1.5',
  '[&_.react-grid-item>.react-resizable-handle-se::after]:border-b-2 [&_.react-grid-item>.react-resizable-handle-se::after]:border-r-2',
  '[&_.react-grid-item>.react-resizable-handle-se::after]:border-primary-foreground',
);

export const formBuilderGridItemClass = cn(
  'box-border flex h-full w-full min-h-0 min-w-0 items-start',
);

export const formBuilderGridDragHandleClass = cn(
  'grid-drag-handle flex cursor-grab items-center rounded p-0.5 text-gray-text-muted',
  'hover:bg-gray-surface-hover active:cursor-grabbing',
);
