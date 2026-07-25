import React from "react";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { platformMatchesValue, type AgentPlatform } from "../agentApi";
import OsPlatformIcon from "../OsPlatformIcon";
import { getArchBadge, isRecommendedPlatform } from "./constants";
import WizardStepNav from "./WizardStepNav";

type Step1SelectOsProps = {
  platforms: AgentPlatform[];
  platformsLoading: boolean;
  selectedPlatform: string;
  hasConnectionId?: boolean;
  onPlatformSelect: (value: string) => void;
  onNext: () => void;
};

export default function Step1SelectOs({
  platforms,
  platformsLoading,
  selectedPlatform,
  hasConnectionId = false,
  onPlatformSelect,
  onNext,
}: Step1SelectOsProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Select Target Architecture
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose the host platform for the edge agent.
        </p>
      </div>

      {platformsLoading ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border bg-muted/20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">
          No platforms available for this connector.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform) => {
            const platformKey =
              platform.value || platform.platform || platform.label;
            const isSelected = platformMatchesValue(platform, selectedPlatform);
            const recommended = isRecommendedPlatform(platform);

            return (
              <button
                key={platformKey}
                type="button"
                onClick={() =>
                  onPlatformSelect(platform.value || platform.platform || platformKey)
                }
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg border-2 p-2.5 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/[0.04] ring-1 ring-primary/20"
                    : "border-border bg-card hover:border-primary/30",
                )}
              >
                {recommended && (
                  <Badge className="absolute -top-2 right-2 bg-primary px-1.5 py-0 text-[9px] font-semibold uppercase">
                    Recommended
                  </Badge>
                )}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    isSelected ? "bg-primary/15" : "bg-muted",
                  )}
                >
                  <OsPlatformIcon
                    osSymbol={platform.os_symbol}
                    os={platform.os}
                    icon={platform.icon}
                    platformHint={platform.value || platform.label}
                    size="md"
                    className={cn(isSelected && "text-primary")}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {platform.label}
                  </p>
                  <Badge
                    variant="secondary"
                    className="mt-1 h-4 rounded px-1.5 text-[9px] font-bold tracking-wide"
                  >
                    {getArchBadge(platform)}
                  </Badge>
                </div>
                {isSelected && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <WizardStepNav
        showBack={false}
        nextLabel="Next"
        nextDisabled={!selectedPlatform || !hasConnectionId}
        onNext={onNext}
        hint={
          !hasConnectionId ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Save the connection first — a connection ID is required for Step 2.
            </p>
          ) : null
        }
      />
    </div>
  );
}
