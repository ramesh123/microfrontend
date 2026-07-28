import { cn } from "@/lib/utils";
import databaseSvg from "./database.svg?url";

export const VirtualDBIcon = ({ className, size = 24, ...props }: any) => (
  <img
    src={databaseSvg}
    alt="Virtual DB"
    width={size}
    height={size}
    className={cn("w-14 h-14", className)}
    {...props}
  />
);
