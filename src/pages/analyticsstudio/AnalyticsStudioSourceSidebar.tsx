import { ArrowLeft, Cable, Globe, Layers2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type AnalyticsStudioSourceView = "connections" | "analytical-dataset" | "api";

export const SOURCE_VIEWS: Array<{
  key: AnalyticsStudioSourceView;
  label: string;
  icon: typeof Cable;
}> = [
  { key: "connections", label: "Connections", icon: Cable },
  { key: "analytical-dataset", label: "Analytical data set", icon: Layers2Icon },
  { key: "api", label: "API", icon: Globe },
];

interface AnalyticsStudioSourceSidebarProps {
  activeView: AnalyticsStudioSourceView;
  onViewChange: (view: AnalyticsStudioSourceView) => void;
  onBackToLists: () => void;
  hideBackButton?: boolean;
  isViewOnly?: boolean;
  variant?: "horizontal" | "vertical";
}

export default function AnalyticsStudioSourceSidebar({
  activeView,
  onViewChange,
  onBackToLists,
  hideBackButton = false,
  variant = "horizontal",
}: AnalyticsStudioSourceSidebarProps) {
  if (variant === "vertical") {
    return (
      <aside className="flex w-52 shrink-0 flex-col border-r border-border/60 bg-muted/40">
        {!hideBackButton ? (
          <div className="border-b border-border/60 px-2 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!h-8 w-full justify-start gap-2 !px-2"
              onClick={onBackToLists}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        ) : null}

        <nav className="flex flex-col gap-1 p-2 pt-4">
          {SOURCE_VIEWS.map(({ key, label, icon: Icon }) => {
            const isActive = activeView === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onViewChange(key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate text-xs font-bold uppercase">{label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <header className="shrink-0 border-b border-border/60 bg-background px-3 pt-0 pb-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn("!h-8 !w-8 shrink-0 !px-0", hideBackButton && "invisible pointer-events-none")}
          onClick={onBackToLists}
        >
          <ArrowLeft className="size-4" />
          <span className="sr-only">Back to lists</span>
        </Button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {SOURCE_VIEWS.map(({ key, label, icon: Icon }) => {
            const isActive = activeView === key;

            return (
              <Button
                key={key}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => onViewChange(key)}
                className={cn(
                  "!h-7 gap-1.5 rounded-xl px-3 text-xs font-medium sm:text-sm",
                  isActive
                    ? "shadow-none"
                    : "border-border/60 bg-background text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Icon className="!size-3.5 shrink-0" />
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
