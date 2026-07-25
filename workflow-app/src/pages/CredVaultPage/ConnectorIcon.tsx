import ForwardedIconComponent from "@/components/common/genericIconComponent";
import { cn } from "@/lib/utils";
import { resolveConnectorIconLookupKey } from "./connectorIconResolve";

type ConnectorIconProps = {
  icon: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: { box: "h-8 w-8", icon: "h-5 w-5", svgOverride: "[&_svg]:!h-5 [&_svg]:!w-5" },
  md: { box: "h-11 w-11", icon: "h-7 w-7", svgOverride: "[&_svg]:!h-7 [&_svg]:!w-7" },
  lg: { box: "h-12 w-12", icon: "h-8 w-8", svgOverride: "[&_svg]:!h-8 [&_svg]:!w-8" },
} as const;

export function ConnectorIcon({ icon, size = "md", className }: ConnectorIconProps) {
  if (!icon?.trim()) return null;

  const iconName = resolveConnectorIconLookupKey(icon);
  const sizes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden",
        sizes.box,
        sizes.svgOverride,
        "[&_svg]:block [&_svg]:shrink-0 [&_svg]:object-contain",
        className,
      )}
    >
      <ForwardedIconComponent
        name={iconName}
        className={cn(sizes.icon, "flex items-center justify-center [&>svg]:!h-full [&>svg]:!w-full")}
        skipFallback={false}
      />
    </div>
  );
}
