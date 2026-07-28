import { memo } from "react";
import { cn } from "@/lib/utils";
import { NodeHeaderIcon } from "@/components/ui/node-header";
import ForwardedIconComponent from "@/components/common/genericIconComponent";

interface NodeIconProps {
  icon: string;
  className?: string;
  /** Raised `.icon-well` chrome (e.g. sheet headers). Canvas nodes omit this. */
  showWell?: boolean;
  /** Optional custom image URL to display instead of the icon */
  imageUrl?: string | null;
}

const NodeIcon = memo(({ icon, className, showWell = false, imageUrl }: NodeIconProps) => {
  return (
    <>
      <NodeHeaderIcon
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-md px-1 py-1",
          showWell && "icon-well icon-well-lg",
          className,
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Node icon" className="!h-10 !w-10 object-contain" />
        ) : icon ? (
          <ForwardedIconComponent name={icon} className="!h-10 !w-10 text-foreground" />
        ) : (
          <div className="h-14 w-14 bg-muted-foreground/20 rounded" />
        )}
      </NodeHeaderIcon>
    </>
  );
});

NodeIcon.displayName = "NodeIcon";

export default NodeIcon;