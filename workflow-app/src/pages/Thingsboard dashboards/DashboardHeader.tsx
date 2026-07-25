import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Edit3,
  Clock,
  Settings,
  Tag,
  Filter,
  Image,
  Download,
  Maximize,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  dashboardTitle: string;
  widgetsCount: number;
  isEditMode: boolean;
  saving: boolean;
  dashboardId: string;
  onToggleEditMode: () => void;
  onOpenWidgetPicker: () => void;
  onSaveDashboard: () => void;
  onTriggerAction: (action: string) => void;
  onCancel: () => void;
  onOpenFilters: () => void;
}

export function DashboardHeader({
  dashboardTitle,
  widgetsCount,
  isEditMode,
  saving,
  dashboardId,
  onToggleEditMode,
  onOpenWidgetPicker,
  onSaveDashboard,
  onTriggerAction,
  onCancel,
  onOpenFilters,
}: DashboardHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="border-b border-border/70 bg-card px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate("/iot-gateway/dashboards")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Dashboard</div>
          <div className="truncate text-sm font-semibold text-foreground">{dashboardTitle || "Untitled dashboard"}</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {widgetsCount > 0 && (
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onTriggerAction("Time window")}>
              <Clock className="h-4 w-4" />
              Realtime - last 1 minute
            </Button>
          )}
          {!isEditMode && widgetsCount > 0 && (
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onTriggerAction("Update dashboard image")} title="Update dashboard image">
              <Image className="h-4 w-4" />
            </Button>
          )}
          {widgetsCount > 0 && (
            <Button
              type="button"
              variant={isEditMode ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={onToggleEditMode}
            >
              <Edit3 className="h-4 w-4" />
              {isEditMode ? "Exit Edit Mode" : "Edit Mode"}
            </Button>
          )}
          {!isEditMode && widgetsCount > 0 && (
            <>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onTriggerAction("Export dashboard")} title="Export dashboard">
                <Download className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onTriggerAction("Expand to fullscreen")} title="Expand to fullscreen">
                <Maximize className="h-4 w-4" />
              </Button>
            </>
          )}
          {(isEditMode || widgetsCount === 0) && (
            <>
              <Button type="button" size="sm" className="h-8 gap-1.5" onClick={onOpenWidgetPicker}>
                <Plus className="h-4 w-4" />
                Add widget
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onTriggerAction("Settings")} title="Settings">
                <Settings className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => onTriggerAction("Aliases")} title="Aliases">
                <Tag className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onOpenFilters} title="Filters">
                <Filter className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1.5"
                disabled={saving || !dashboardId.trim()}
                onClick={onSaveDashboard}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Save
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
