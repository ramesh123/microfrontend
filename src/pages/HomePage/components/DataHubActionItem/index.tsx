import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface DataHubActionItemProps {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick?: () => void;
}

export default function DataHubActionItem({ icon: Icon, title, description, onClick }: DataHubActionItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-3 rounded-lg text-left transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <div className="p-2 bg-primary/10 rounded-lg">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </button>
  );
}
