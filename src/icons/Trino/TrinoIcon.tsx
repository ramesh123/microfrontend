import { cn } from "@/lib/utils";
import trinoSvg from "./trino.svg?url";

export const TrinoIcon = ({ className, size = 24, ...props }: any) => (
  <img
    src={trinoSvg}
    alt="Trino"
    width={size}
    height={size}
    className={cn("w-14 h-14", className)}
    {...props}
  />
);
