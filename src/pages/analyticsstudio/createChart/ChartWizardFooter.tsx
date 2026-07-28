import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChartWizardFooterProps {
  hint: string;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showNext?: boolean;
}

export default function ChartWizardFooter({
  hint,
  onBack,
  onNext,
  nextLabel = "Next",
  nextDisabled = false,
  nextLoading = false,
  showNext = true,
}: ChartWizardFooterProps) {
  return (
    <div className="flex items-center justify-between border-t bg-background px-4 py-3 sm:px-6">
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back
      </Button>
      <p className="hidden text-sm text-muted-foreground md:block">{hint}</p>
      {showNext ? (
        <Button
          type="button"
          size="sm"
          className="gap-2"
          onClick={onNext}
          disabled={nextDisabled || nextLoading}
        >
          {nextLoading ? <Loader2 className="size-4 animate-spin" /> : null}
          {nextLabel}
          {!nextLoading ? <ArrowRight className="size-4" /> : null}
        </Button>
      ) : (
        <div className="w-[88px]" />
      )}
    </div>
  );
}
