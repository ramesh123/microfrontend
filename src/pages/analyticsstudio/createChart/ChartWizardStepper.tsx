import { Check } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CHART_WIZARD_STEPS, type ChartWizardStep, type ChartWizardStepKey } from "./types";

interface ChartWizardStepperProps {
  currentStep: ChartWizardStepKey;
  steps?: ChartWizardStep[];
  onStepClick?: (stepKey: ChartWizardStepKey) => void;
  /** When true (e.g. view mode), any step except the current one is clickable. */
  allowAllStepNavigation?: boolean;
  leadingAction?: ReactNode;
  trailingAction?: ReactNode;
}

export default function ChartWizardStepper({
  currentStep,
  steps = CHART_WIZARD_STEPS,
  onStepClick,
  allowAllStepNavigation = false,
  leadingAction,
  trailingAction,
}: ChartWizardStepperProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  const handleStepClick = (step: ChartWizardStep, index: number) => {
    if (!onStepClick || index === currentIndex) return;
    if (allowAllStepNavigation || index < currentIndex) {
      onStepClick(step.key);
    }
  };

  const stepperContent = (
    <div className="flex min-w-0 items-center">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = step.key === currentStep;
        const isUpcoming = index > currentIndex;
        const isClickable =
          !!onStepClick &&
          index !== currentIndex &&
          (allowAllStepNavigation || index < currentIndex);

        const stepBody = (
          <>
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold leading-none transition-colors",
                isComplete && "border-green-600 bg-green-600 text-background",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                isUpcoming && "border-border bg-muted text-muted-foreground",
              )}
            >
              {isComplete ? <Check className="size-3" strokeWidth={2.5} /> : step.id}
            </div>

            <span
              className={cn(
                "whitespace-nowrap text-xs font-semibold leading-none",
                isCurrent && "text-primary",
                isComplete && "text-green-600",
                isUpcoming && "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </>
        );

        return (
          <Fragment key={step.key}>
            <div className="relative shrink-0 pb-1">
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => handleStepClick(step, index)}
                  className="flex items-center gap-1.5 rounded-md px-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  aria-label={`Go to ${step.label}`}
                >
                  {stepBody}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">{stepBody}</div>
              )}

              {isComplete ? (
                <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-green-600" />
              ) : null}

              {isCurrent ? (
                <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
              ) : null}
            </div>

            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "mx-1 hidden h-px w-6 shrink-0 sm:block sm:w-10",
                  isComplete ? "bg-green-600" : "bg-border",
                )}
                aria-hidden
              />
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );

  if (leadingAction || trailingAction) {
    return (
      <div className="border-b bg-background px-2 sm:px-3">
        <div className="grid grid-cols-[minmax(2rem,auto)_1fr_minmax(2rem,auto)] items-center gap-2 py-2">
          <div className="flex items-center justify-start">{leadingAction}</div>
          <div className="flex min-w-0 justify-center overflow-x-auto">{stepperContent}</div>
          <div className="flex items-center justify-end">{trailingAction}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-background px-2 sm:px-3">
      <div className="flex justify-center py-2">{stepperContent}</div>
    </div>
  );
}
