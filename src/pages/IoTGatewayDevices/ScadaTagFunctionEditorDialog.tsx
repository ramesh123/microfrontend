import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/theme";

const JsMonacoEditor = lazy(() => import("@monaco-editor/react"));

export type ScadaTagFunctionEditorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tagName: string;
  value: string;
  onChange: (next: string) => void;
  onApply: () => void;
};

export function ScadaTagFunctionEditorDialog({
  open,
  onOpenChange,
  title,
  tagName,
  value,
  onChange,
  onApply,
}: ScadaTagFunctionEditorDialogProps) {
  const { theme } = useTheme();
  const monacoTheme = theme === "dark" || theme === "blue-dark-g" ? "vs-dark" : "light";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92vh,52rem)] w-[min(96vw,52rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[52rem]">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
          <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 font-mono text-xs font-normal">
            {tagName}
          </Badge>

          <div
            className={cn(
              "min-h-[18rem] flex-1 overflow-hidden rounded-md border border-border",
              monacoTheme === "vs-dark" ? "bg-[#1e1e1e]" : "bg-muted/20",
            )}
          >
            <Suspense
              fallback={
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <JsMonacoEditor
                language="javascript"
                value={value}
                theme={monacoTheme}
                onChange={(v) => onChange(v ?? "")}
                height="min(60vh, 22rem)"
                loading={
                  <div className="flex h-72 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 8 },
                  folding: true,
                }}
              />
            </Suspense>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
