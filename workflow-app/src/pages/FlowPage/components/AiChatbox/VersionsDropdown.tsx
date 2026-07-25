"use client";

import * as React from "react";
import {
  Search,
  Loader2,
  GitBranch,
  Check,
  Clock,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VersionItem {
  draft_id?: string;
  id?: string;
  version?: string;
  name?: string;
  version_name?: string;
  display_name?: string;
  description?: string;
  updated_at?: string;
}

interface VersionsDropdownProps {
  open: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  versions: VersionItem[];
  versionsMessage: string | null;
  filteredVersions: VersionItem[];
  selectedVersionId: string | null;
  onVersionSelect: (draftId: string) => void;
}

function formatUpdatedLabel(iso: string | undefined): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (86400 * 1000));
    if (diffDays === 0) {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function getVersionName(v: VersionItem) {
  return (
    v.version ??
    v.name ??
    v.version_name ??
    v.display_name ??
    (v.draft_id ?? v.id ? `Version ${v.draft_id ?? v.id}` : "Version")
  );
}

export function VersionsDropdown({
  open,
  searchQuery,
  onSearchChange,
  isLoading,
  versions,
  versionsMessage,
  filteredVersions,
  selectedVersionId,
  onVersionSelect,
}: VersionsDropdownProps) {
  if (!open) return null;

  const showList = versions.length > 0;

  return (
    <div
      className={cn(
        "w-full min-w-[180px] max-w-[240px] overflow-hidden rounded-lg border border-border/70",
        "bg-card/95 text-left shadow-md backdrop-blur-sm",
        "ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
      )}
    >
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/40 via-primary to-primary/40" aria-hidden />

      <div className="border-b border-border/50 bg-muted/25 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <GitBranch className="h-3 w-3" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1 leading-none">
            <p className="truncate text-[11px] font-semibold leading-tight text-foreground">
              Version history
            </p>
            <p className="mt-0.5 truncate text-[9px] leading-tight text-muted-foreground">
              Tap a row to load on canvas
            </p>
          </div>
          {showList && (
            <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium tabular-nums text-muted-foreground ring-1 ring-border/50">
              {versions.length}
            </span>
          )}
        </div>
      </div>

      {showList && (
        <>
          <div className="px-1.5 pt-1.5 pb-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/70" />
              <input
                type="search"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className={cn(
                  "h-7 w-full rounded-md border border-border/60 bg-background py-0 pl-7 pr-2",
                  "text-[11px] leading-none placeholder:text-muted-foreground/60",
                  "outline-none transition focus:border-primary/35 focus:ring-1 focus:ring-primary/15"
                )}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="max-h-[min(200px,36vh)] overflow-y-auto overscroll-contain px-1.5 pb-1.5 scrollbar-thin">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
                <p className="text-[10px] text-muted-foreground">Loading…</p>
              </div>
            ) : filteredVersions.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-5 text-center">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/80">
                  <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-[10px] font-medium text-foreground">
                  {searchQuery.trim() ? "No matches" : "No versions"}
                </p>
                <p className="max-w-[180px] px-1 text-[9px] leading-snug text-muted-foreground">
                  {searchQuery.trim()
                    ? "Try another search."
                    : "Save this draft to create versions."}
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-0.5" role="listbox">
                {filteredVersions.map((v, index) => {
                  const draftId = v.draft_id ?? v.id;
                  const name = getVersionName(v);
                  const isSelected = draftId === selectedVersionId;
                  const when = formatUpdatedLabel(v.updated_at);

                  return (
                    <li key={String(draftId ?? index)}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={!draftId}
                        onClick={() => {
                          if (draftId) onVersionSelect(draftId);
                        }}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left transition-colors",
                          "border-transparent hover:bg-muted/80",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                          isSelected && "border-primary/30 bg-primary/[0.06] ring-1 ring-primary/15"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-semibold tabular-nums leading-none",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1">
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium leading-tight text-foreground">
                              {name}
                            </span>
                            {index === 0 && (
                              <span className="shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-emerald-700 dark:text-emerald-400">
                                New
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[9px] leading-none text-muted-foreground">
                            {when && (
                              <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
                                <Clock className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                <span className="truncate">{when}</span>
                              </span>
                            )}
                            {v.description && (
                              <>
                                {when && <span className="text-border" aria-hidden>·</span>}
                                <span className="min-w-0 flex-1 truncate">{v.description}</span>
                              </>
                            )}
                          </span>
                        </span>
                        {isSelected ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                            <Check className="h-3 w-3" strokeWidth={2.5} />
                          </span>
                        ) : (
                          <span className="h-5 w-5 shrink-0" aria-hidden />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {!showList && !isLoading && (
        <div className="flex flex-col items-center gap-1.5 px-3 py-6 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/90">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-[10px] font-medium leading-tight text-foreground">
            {versionsMessage || "No versions available"}
          </p>
          <p className="max-w-[200px] text-[9px] leading-snug text-muted-foreground">
            Save branches of this draft to see them here.
          </p>
        </div>
      )}
    </div>
  );
}
