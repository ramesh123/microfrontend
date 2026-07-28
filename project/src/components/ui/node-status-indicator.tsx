import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type NodeStatusIndicatorProps = {
  status?: "loading" | "success" | "error" | "initial";
  children: ReactNode;
  className?: string;
};

export const LoadingIndicator = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <>
      <div className={cn("absolute -left-[1px] -top-[1px] h-[calc(100%+2px)] w-[calc(100%+2px)]", className)}>
        <style>
          {`
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .spinner {
          animation: spin 2s linear infinite;
          position: absolute;
          left: 50%;
          top: 50%;
          width: 140%;
          aspect-ratio: 1;
          transform-origin: center;
        }
      `}
        </style>
        <div className="absolute inset-0 overflow-hidden rounded-[7px]">
          <div className="spinner rounded-full bg-[conic-gradient(from_0deg_at_50%_50%,_rgb(42,67,233)_0deg,_rgba(42,138,246,0)_360deg)]" />
        </div>
      </div>
      {children}
    </>
  );
};

const StatusBorder = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <>
      <div
        className={cn(
          "absolute -left-[1px] -right-[1px] -top-[1px] h-[calc(100%+2px)] w-[calc(100%+2px)] rounded-[7px] border-2",
          className,
        )}
      />
      {children}
    </>
  );
};

export const NodeStatusIndicator = ({
  status,
  children,
  className,
}: NodeStatusIndicatorProps) => {
  switch (status) {
    case "loading":
      return <LoadingIndicator className={className}>{children}</LoadingIndicator>;
    case "success":
      return (
        <StatusBorder className={cn("border-emerald-600", className)}>{children}</StatusBorder>
      );
    case "error":
      return <StatusBorder className={cn("border-red-400", className)}>{children}</StatusBorder>;
    default:
      return <>{children}</>;
  }
};
