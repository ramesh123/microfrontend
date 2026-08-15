import * as React from "react"
import MuiTooltip, { type TooltipProps as MuiTooltipProps } from "@mui/material/Tooltip"

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
  // Radix-only positioning knobs some call sites still pass through; MUI's
  // Tooltip auto-flips placement on its own, so these are accepted (for
  // call-site compatibility) but have no effect.
  avoidCollisions?: boolean
  sticky?: string
  // TooltipContent never renders its own DOM node (Tooltip reads its props
  // and renders a single MuiTooltip around the trigger instead), so a ref
  // passed here is accepted for call-site compatibility but never attaches.
  ref?: React.Ref<HTMLDivElement>
}

// side+align (Radix's two-axis positioning) combine into MUI's single
// `placement` string (e.g. side="right" align="start" -> "right-start").
function toPlacement(side: Side = "top", align: Align = "center"): MuiTooltipProps["placement"] {
  if (align === "center") return side
  return `${side}-${align === "start" ? "start" : "end"}` as MuiTooltipProps["placement"]
}

// Radix splits Tooltip into Root/Trigger/Content so the trigger and its
// label can live as separate JSX children; MUI's Tooltip instead wraps a
// single child directly via a `title` prop. Root here walks its children
// once to pull the trigger element and content out, then renders one
// MuiTooltip — preserving the familiar
// <Tooltip><TooltipTrigger>...</TooltipTrigger><TooltipContent>...</TooltipContent></Tooltip> shape.
function Tooltip({ children }: { children?: React.ReactNode }) {
  const delayDuration = React.useContext(TooltipDelayContext)
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

  if (!React.isValidElement(trigger)) return <>{trigger}</>
  if (contentProps.hidden) return <>{trigger}</>

  return (
    <MuiTooltip
      title={content ?? ""}
      enterDelay={delayDuration}
      placement={toPlacement(contentProps.side, contentProps.align)}
      arrow
    >
      {trigger}
    </MuiTooltip>
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
