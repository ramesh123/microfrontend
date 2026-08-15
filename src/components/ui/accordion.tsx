import * as React from "react"
import MuiAccordion from "@mui/material/Accordion"
import MuiAccordionSummary from "@mui/material/AccordionSummary"
import MuiAccordionDetails from "@mui/material/AccordionDetails"
import { ChevronDownIcon } from "lucide-react"

// Radix keeps open/closed state for every item at the Accordion Root
// (type="single"|"multiple", value/onValueChange), while MUI's Accordion
// manages `expanded` per individual instance with no built-in grouping.
// This context reproduces the Root-level state so AccordionItem/Trigger
// call sites don't need to change.
type AccordionCtx = {
  type: "single" | "multiple"
  value: string[]
  toggle: (itemValue: string) => void
}
const AccordionContext = React.createContext<AccordionCtx | null>(null)

interface AccordionProps {
  type?: "single" | "multiple"
  collapsible?: boolean
  value?: string | string[]
  defaultValue?: string | string[]
  onValueChange?: (value: string | string[]) => void
  className?: string
  children?: React.ReactNode
}

function Accordion({ type = "single", collapsible = true, value, defaultValue, onValueChange, className, children }: AccordionProps) {
  const toArray = (v: string | string[] | undefined): string[] => (v == null ? [] : Array.isArray(v) ? v : [v])
  const [internal, setInternal] = React.useState<string[]>(() => toArray(defaultValue))
  const current = value !== undefined ? toArray(value) : internal

  const toggle = (itemValue: string) => {
    let next: string[]
    if (type === "single") {
      const isOpen = current.includes(itemValue)
      next = isOpen ? (collapsible ? [] : current) : [itemValue]
    } else {
      next = current.includes(itemValue) ? current.filter((v) => v !== itemValue) : [...current, itemValue]
    }
    setInternal(next)
    onValueChange?.(type === "single" ? next[0] ?? "" : next)
  }

  return (
    <AccordionContext.Provider value={{ type, value: current, toggle }}>
      <div data-slot="accordion" className={className}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

function AccordionItem({ value, className, children }: { value: string; className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(AccordionContext)
  const expanded = !!ctx?.value.includes(value)

  return (
    <MuiAccordion
      data-slot="accordion-item"
      className={className}
      expanded={expanded}
      onChange={() => ctx?.toggle(value)}
      disableGutters
      square
      sx={{ boxShadow: "none", "&:before": { display: "none" } }}
    >
      {children}
    </MuiAccordion>
  )
}

function AccordionTrigger({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <MuiAccordionSummary
      data-slot="accordion-trigger"
      className={className}
      expandIcon={<ChevronDownIcon size={16} />}
    >
      {children}
    </MuiAccordionSummary>
  )
}

function AccordionContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <MuiAccordionDetails data-slot="accordion-content" className={className}>
      {children}
    </MuiAccordionDetails>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
