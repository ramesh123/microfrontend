import { memo } from "react";
import { cn } from "@/lib/utils";

interface NodeDescriptionProps {
  description: string;
  className?: string;
}

const NodeDescription = memo(({ description, className }: NodeDescriptionProps) => {
  return (
    <p
      className={cn(
        "text-xs text-muted-foreground word-wrap min-w-[200px] mb-2 max-w-[320px]",
        className
      )}
      title={description}
    >
      {description}
    </p>
  );
});

NodeDescription.displayName = "NodeDescription";

export default NodeDescription;