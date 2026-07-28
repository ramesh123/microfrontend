import React from "react";
import { Check, Cpu, Download, FileJson } from "lucide-react";
import { cn } from "@/lib/utils";
import { WIZARD_STEPS } from "./constants";

type WizardProgressBarProps = {
  activeStep: number;
  completedSteps: Set<number>;
  variant?: "horizontal" | "vertical";
  onStepClick?: (stepIndex: number) => void;
};

const STEP_ICONS = [Cpu, FileJson, Download];

export default function WizardProgressBar({
  activeStep,
  completedSteps,
  variant = "horizontal",
  onStepClick,
}: WizardProgressBarProps) {
  const isStepClickable = (stepIndex: number, stepId: number) =>
    Boolean(onStepClick) &&
    (stepIndex <= activeStep || completedSteps.has(stepId));

  if (variant === "vertical") {
    return (
      <div className="space-y-0">
        {WIZARD_STEPS.map((step, index) => {
          const completed = completedSteps.has(step.id);
          const active = activeStep === index;
          const Icon = STEP_ICONS[index];
          const clickable = isStepClickable(index, step.id);

          return (
            <div key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={cn(
                    "absolute left-[15px] top-8 h-[calc(100%-1rem)] w-0.5",
                    completed ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(index)}
                className={cn(
                  "relative z-10 flex shrink-0 items-start gap-3 text-left",
                  clickable && "cursor-pointer rounded-lg hover:opacity-90",
                  !clickable && "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                    completed && "border-primary bg-primary text-primary-foreground",
                    active && !completed && "border-primary bg-primary/10 text-primary",
                    !active && !completed && "border-muted-foreground/30 bg-background text-muted-foreground",
                  )}
                >
                  {completed ? (
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-snug break-words whitespace-normal",
                      (active || completed) && "text-foreground",
                      !active && !completed && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {completed ? "Completed" : active ? "Active Task" : "Pending"}
                  </p>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-3 gap-2">
      {WIZARD_STEPS.map((step, index) => {
        const completed = completedSteps.has(step.id);
        const active = activeStep === index;
        const Icon = STEP_ICONS[index];
        const clickable = isStepClickable(index, step.id);

        return (
          <button
            key={step.id}
            type="button"
            disabled={!clickable}
            onClick={() => clickable && onStepClick?.(index)}
            className={cn(
              "flex min-w-0 w-full flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-colors sm:px-2",
              active && "border-primary bg-primary/5 shadow-sm",
              completed && !active && "border-primary/40 bg-primary/5",
              !active && !completed && "border-border bg-muted/30",
              clickable && "cursor-pointer hover:border-primary/50 hover:bg-primary/5",
              !clickable && "cursor-default",
            )}
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                completed && "bg-primary text-primary-foreground",
                active && !completed && "bg-primary text-primary-foreground",
                !active && !completed && "bg-muted text-muted-foreground",
              )}
            >
              {completed ? (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Icon className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 w-full px-0.5">
              <p className="text-[10px] font-bold uppercase leading-snug tracking-wide text-muted-foreground break-words whitespace-normal sm:text-[11px]">
                {index + 1}. {step.label}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
