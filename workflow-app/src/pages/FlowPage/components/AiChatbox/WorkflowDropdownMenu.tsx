"use client";

import * as React from "react";
import { Folder, ChevronRight, Pencil } from "lucide-react";

interface WorkflowDropdownMenuProps {
  open: boolean;
  onSelectHistory: () => void;
  onSelectWorkflows: () => void;
  onSelectRename: () => void;
  onNewChat: () => void;
}

export function WorkflowDropdownMenu({
  open,
  onSelectWorkflows,
  onSelectRename,
}: WorkflowDropdownMenuProps) {
  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-1 w-50 bg-muted/95 backdrop-blur-sm rounded-lg border border-border/50 shadow-lg z-50">
      <button
        onClick={onSelectWorkflows}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted rounded-t-lg transition text-sm"
      >
        <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">Workflows</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>

      <button
        onClick={onSelectRename}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 hover:bg-muted rounded-b-lg transition text-sm"
      >
        <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left">Rename</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
    </div>
  );
}
