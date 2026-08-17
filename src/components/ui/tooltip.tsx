import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

// No @material/web tooltip component exists yet (a known gap in the
// library's current component set) — this is a plain, portal-rendered
// floating label positioned off the trigger's measured bounding rect.
const TooltipDelayContext = React.createContext(0)

function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number
  children?: React.ReactNode
}) {
  return <TooltipDelayContext.Provider value={delayDuration}>{children}</TooltipDelayContext.Provider>
}

type TooltipTriggerProps = { children?: React.ReactNode; asChild?: boolean }
type Side = "top" | "right" | "bottom" | "left"
type Align = "start" | "center" | "end"
type TooltipContentProps = {
  children?: React.ReactNode
  className?: string
  sideOffset?: number
  side?: Side
  align?: Align
  hidden?: boolean
  avoidCollisions?: boolean
  sticky?: string
  ref?: React.Ref<HTMLDivElement>
}

function computePosition(
  rect: DOMRect,
  side: Side,
  align: Align,
  sideOffset: number,
): { top: number; left: number; transform: string } {
  const alongMain = { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
  const crossCenter = side === "top" || side === "bottom" ? rect.left + rect.width / 2 : rect.top + rect.height / 2;
  const crossStart = side === "top" || side === "bottom" ? rect.left : rect.top;
  const crossEnd = side === "top" || side === "bottom" ? rect.right : rect.bottom;
  const cross = align === "center" ? crossCenter : align === "start" ? crossStart : crossEnd;
  const crossTransform =
    align === "center" ? "-50%" : align === "start" ? "0%" : "-100%";

  switch (side) {
    case "top":
      return { top: alongMain.top - sideOffset, left: cross, transform: `translate(${crossTransform}, -100%)` };
    case "bottom":
      return { top: alongMain.bottom + sideOffset, left: cross, transform: `translate(${crossTransform}, 0%)` };
    case "left":
      return { top: cross, left: alongMain.left - sideOffset, transform: `translate(-100%, ${crossTransform})` };
    case "right":
    default:
      return { top: cross, left: alongMain.right + sideOffset, transform: `translate(0%, ${crossTransform})` };
  }
}

// Radix splits Tooltip into Root/Trigger/Content so the trigger and its
// label can live as separate JSX children — Root here walks its children
// once to pull the trigger element and content out (same as before), then
// wires hover/focus handlers onto a cloned trigger and portals a positioned
// label while visible.
function Tooltip({ children }: { children?: React.ReactNode }) {
  const delayDuration = React.useContext(TooltipDelayContext)
  const [visible, setVisible] = React.useState(false)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const showTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  let trigger: React.ReactNode = null
  let content: React.ReactNode = null
  let contentProps: TooltipContentProps = {}

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === TooltipTrigger) {
      trigger = (child.props as TooltipTriggerProps).children
    } else if (child.type === TooltipContent) {
      contentProps = child.props as TooltipContentProps
      content = contentProps.children
    }
  })

  const show = () => {
    if (showTimeout.current) clearTimeout(showTimeout.current)
    showTimeout.current = setTimeout(() => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
      setVisible(true)
    }, delayDuration)
  }
  const hide = () => {
    if (showTimeout.current) clearTimeout(showTimeout.current)
    setVisible(false)
  }

  if (!React.isValidElement(trigger)) return <>{trigger}</>
  if (contentProps.hidden) return <>{trigger}</>

  const triggerEl = trigger as React.ReactElement<Record<string, unknown>> & { ref?: React.Ref<HTMLElement> }
  const cloned = React.cloneElement(triggerEl, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
      const originalRef = triggerEl.ref
      if (typeof originalRef === "function") originalRef(node)
      else if (originalRef && typeof originalRef === "object") (originalRef as React.MutableRefObject<HTMLElement | null>).current = node
    },
    onMouseEnter: (e: React.MouseEvent) => {
      (triggerEl.props.onMouseEnter as ((e: React.MouseEvent) => void) | undefined)?.(e)
      show()
    },
    onMouseLeave: (e: React.MouseEvent) => {
      (triggerEl.props.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e)
      hide()
    },
    onFocus: (e: React.FocusEvent) => {
      (triggerEl.props.onFocus as ((e: React.FocusEvent) => void) | undefined)?.(e)
      show()
    },
    onBlur: (e: React.FocusEvent) => {
      (triggerEl.props.onBlur as ((e: React.FocusEvent) => void) | undefined)?.(e)
      hide()
    },
  })

  return (
    <>
      {cloned}
      {visible && rect
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: "fixed",
                zIndex: 1400,
                pointerEvents: "none",
                ...computePosition(rect, contentProps.side ?? "top", contentProps.align ?? "center", contentProps.sideOffset ?? 4),
              }}
              className={cn(
                "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs text-balance shadow-md",
                contentProps.className,
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

// Not rendered directly — Tooltip reads its child/props above.
function TooltipTrigger(props: TooltipTriggerProps) {
  return <>{props.children}</>
}

function TooltipContent(props: TooltipContentProps) {
  return <>{props.children}</>
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
