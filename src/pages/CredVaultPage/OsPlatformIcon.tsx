import React from "react";
import { cn } from "@/lib/utils";

type OsPlatformIconProps = {
  icon?: string;
  osSymbol?: string;
  os?: string;
  platformHint?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

/** Linux penguin-style mark for cards */
function LinuxIcon({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(sizeClass[size], className)}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.769-.3 3.001-1.362 4.709-.962 1.542-2.297 3.957-2.853 6.484-.332 1.453-.18 2.818.105 3.772.285.954.712 1.555 1.047 1.898.335.343.577.477.577.477s.242-.134.577-.477c.335-.343.762-.944 1.047-1.898.285-.954.437-2.319.105-3.772-.556-2.527-1.891-4.942-2.853-6.484-1.062-1.708-1.286-2.94-1.362-4.709C9.609 4.828 10.73.333 6.504.021 6.339.008 6.179 0 6.024 0h6.48z" />
    </svg>
  );
}

function WindowsIcon({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(sizeClass[size], className)}
      aria-hidden
      fill="currentColor"
    >
      <path d="M3 5.548l7.5-1.036v7.222H3V5.548zm0 8.902h7.5v7.222L3 20.636V14.45zm9-9.384L21 3v7.636h-9V5.548zm0 8.902H21V21l-9-1.384V14.45z" />
    </svg>
  );
}

function resolveOsKind(
  osSymbol?: string,
  os?: string,
  icon?: string,
  platformHint?: string,
): "linux" | "windows" | "unknown" {
  const parts = [osSymbol, os, icon, platformHint]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase().trim());

  for (const key of parts) {
    if (!key) continue;
    if (
      key === "windows" ||
      key.includes("windows") ||
      key.includes("win_x64") ||
      key.includes("win-x64") ||
      (key.includes("win") && !key.includes("darwin"))
    ) {
      return "windows";
    }
    if (
      key === "linux" ||
      key.includes("linux") ||
      key.includes("aarch64") ||
      key.includes("aarch") ||
      key.includes("x86_64") ||
      key.includes("x86-64") ||
      key.includes("amd64") ||
      key.includes("arm64")
    ) {
      return "linux";
    }
  }

  return "unknown";
}

export default function OsPlatformIcon({
  icon,
  osSymbol,
  os,
  platformHint,
  size = "md",
  className,
}: OsPlatformIconProps) {
  const kind = resolveOsKind(osSymbol, os, icon, platformHint);

  if (kind === "windows") {
    return <WindowsIcon size={size} className={className} />;
  }
  if (kind === "linux") {
    return <LinuxIcon size={size} className={className} />;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-muted text-[9px] font-semibold uppercase text-muted-foreground",
        size === "lg" ? "h-8 w-8" : size === "md" ? "h-5 w-5" : "h-4 w-4",
        className,
      )}
      aria-hidden
    >
      OS
    </span>
  );
}

export function getOsDisplayLabel(
  osSymbol?: string,
  os?: string,
  platformHint?: string,
): string | undefined {
  const kind = resolveOsKind(osSymbol, os, undefined, platformHint);
  if (kind === "windows") return "Windows";
  if (kind === "linux") return "Linux";
  return undefined;
}
