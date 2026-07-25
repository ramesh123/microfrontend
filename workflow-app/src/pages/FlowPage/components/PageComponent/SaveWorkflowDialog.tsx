import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileEdit, Loader2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SaveWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAsDraft: (description: string) => void | Promise<void>;
  onRelease: () => void;
  isSavingDraft?: boolean;
  isReleasing?: boolean;
  /** When true (Virtual DB workflow), hide Save as Draft and show "Release Virtual DB" */
  virtualDbMode?: boolean;
}

export function SaveWorkflowDialog({
  open,
  onOpenChange,
  onSaveAsDraft,
  onRelease,
  isSavingDraft = false,
  isReleasing = false,
  virtualDbMode = false,
}: SaveWorkflowDialogProps) {
  const [draftDescription, setDraftDescription] = React.useState("");
  const isBusy = isSavingDraft || isReleasing;

  const handleSaveAsDraft = async () => {
    try {
      await Promise.resolve(onSaveAsDraft(draftDescription.trim()));
      setDraftDescription("");
      onOpenChange(false);
    } catch {
      // Keep dialog open on failure; parent shows toast
    }
  };

  const releaseLabel = virtualDbMode ? "Release Virtual DB" : "Release Workflow";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {virtualDbMode ? "Release Virtual DB" : "Choose workflow version"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {virtualDbMode ? "Publish this Virtual DB workflow and make it available." : "How do you want to save this workflow?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {!virtualDbMode && (
            <>
              {/* Description for draft */}
              <div className="space-y-2">
                <Label htmlFor="draft-description" className="text-sm font-medium">
                  Description
                </Label>
                <Textarea
                  id="draft-description"
                  placeholder="Describe what this workflow does..."
                  value={draftDescription}
                  onChange={(e) => setDraftDescription(e.target.value)}
                  className="min-h-[80px] resize-none text-sm"
                  disabled={isBusy}
                />
              </div>

              {/* Save as Draft Button */}
              <Button
                variant="outline"
                className={cn(
                  "w-full h-auto py-3 px-4 flex items-center justify-start gap-3",
                  "border-2 hover:border-primary/50 hover:bg-accent transition-all",
                  "group disabled:cursor-not-allowed"
                )}
                onClick={handleSaveAsDraft}
                disabled={isBusy}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                  {isSavingDraft ? (
                    <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                  ) : (
                    <FileEdit className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">
                    {isSavingDraft ? "Saving..." : "Save as Draft"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Save your work without publishing
                  </div>
                </div>
              </Button>
            </>
          )}

          {/* Release Button */}
          <Button
            className={cn(
              "w-full h-auto py-3 px-4 flex items-center justify-start gap-3",
              "bg-primary hover:bg-primary/90 transition-all",
              "group"
            )}
            onClick={() => {
              onRelease();
              onOpenChange(false);
            }}
            disabled={isBusy}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-foreground/10">
              {isReleasing ? (
                <Loader2 className="h-5 w-5 text-primary-foreground animate-spin" />
              ) : (
                <Rocket className="h-5 w-5 text-primary-foreground" />
              )}
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-sm text-primary-foreground">
                {isReleasing ? "Releasing..." : releaseLabel}
              </div>
              <div className="text-xs text-primary-foreground/80">
                Publish and make it available
              </div>
            </div>
          </Button>

          {/* Cancel Button */}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
            disabled={isBusy}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
