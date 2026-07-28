import { Workflow } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, XCircle, Timer, CircleSlash, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PipelineListItemProps {
  workflow: Workflow;
  onView: () => void;
}

const statusMap = {
  active: {
    icon: CheckCircle2,
    label: "Success",
    color: "text-green-500",
  },
  error: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-500",
  },
  pending: {
    icon: Timer,
    label: "Pending",
    color: "text-yellow-500",
  },
  inactive: {
    icon: CircleSlash,
    label: "Inactive",
    color: "text-gray-500",
  },
};

export default function PipelineListItem({ workflow, onView }: PipelineListItemProps) {
  const { icon: Icon, label, color } = statusMap[workflow.status];

  return (
    <div className="flex items-center gap-4 py-3 px-2 hover:bg-muted/50 rounded-lg transition-colors">
      <Icon className={cn("h-5 w-5 flex-shrink-0", color)} />
      <div className="flex-1 grid grid-cols-[auto,1fr] items-center gap-3">
        <div>
          <p className="font-medium truncate">{workflow.name}</p>
          <p className="text-sm text-muted-foreground">
            {label} • {formatDistanceToNow(new Date(workflow.lastRun), { addSuffix: true })}
          </p>
        </div>
      </div>
      <Button variant="outline" size="iconMd" onClick={onView}>
        <Eye className={cn("h-4 w-4", color)} /> View
      </Button>
    </div>
  );
}
