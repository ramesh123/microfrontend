"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";

interface WorkflowItem {
  id: string;
  name?: string;
  description?: string;
}

interface WorkflowsDropdownProps {
  open: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isLoading: boolean;
  workflows: WorkflowItem[];
  onWorkflowSelect: (id: string) => void;
}

export function WorkflowsDropdown({
  open,
  searchQuery,
  onSearchChange,
  isLoading,
  workflows,
  onWorkflowSelect,
}: WorkflowsDropdownProps) {
  if (!open) return null;

  return (
    <div className="mt-1.5 bg-muted/30 rounded-lg p-1.5 space-y-1">
      <div className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">
        Workflows
      </div>

      <div className="relative px-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search workflows..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20"
        />
      </div>

      <div className="max-h-[200px] overflow-y-auto space-y-0.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="px-2.5 py-3 text-xs text-muted-foreground text-center">
            {searchQuery ? "No workflows found" : "No workflows available"}
          </div>
        ) : (
          workflows.map((workflow) => (
            <button
              key={workflow.id}
              onClick={() => onWorkflowSelect(workflow.id)}
              className="w-full text-left px-2.5 py-1.5 hover:bg-muted rounded-md transition"
            >
              <div className="text-xs font-medium truncate">{workflow.name}</div>
              {workflow.description && (
                <div className="text-[10px] text-muted-foreground truncate">
                  {workflow.description}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
