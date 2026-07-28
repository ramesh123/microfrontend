import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";

type WizardStepNavProps = {
  showBack?: boolean;
  showNext?: boolean;
  backLabel?: string;
  nextLabel?: string;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  hint?: React.ReactNode;
  children?: React.ReactNode;
};

export default function WizardStepNav({
  showBack = true,
  showNext = true,
  backLabel = "Back",
  nextLabel = "Next",
  backDisabled = false,
  nextDisabled = false,
  onBack,
  onNext,
  hint,
  children,
}: WizardStepNavProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {hint}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {children}
        {showBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={backDisabled}
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Button>
        ) : null}
        {showNext ? (
          <Button
            type="button"
            size="sm"
            className="gap-1.5 px-5"
            disabled={nextDisabled}
            onClick={onNext}
          >
            {nextLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
