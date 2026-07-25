import { cn } from "@/lib/utils";

export const SourceSplitterIcon = ({ className, ...props }: any) => (
  <svg
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    width="64"
    height="64"
    viewBox="0 0 64 64"
    preserveAspectRatio="xMidYMid meet"
    className={className}
    {...props}
  >
    {/* Source Node (Left) - Outlined */}
    <rect
      x="3"
      y="20"
      width="18"
      height="24"
      rx="2"
      fill="none"
      stroke="#000000"
      strokeWidth="3"
    />

    {/* Destination Nodes (Right) - Outlined */}
    <rect
      x="43"
      y="4"
      width="18"
      height="14"
      rx="2"
      fill="none"
      stroke="#000000"
      strokeWidth="3"
    />
    <rect
      x="43"
      y="25"
      width="18"
      height="14"
      rx="2"
      fill="none"
      stroke="#000000"
      strokeWidth="3"
    />
    <rect
      x="43"
      y="46"
      width="18"
      height="14"
      rx="2"
      fill="none"
      stroke="#000000"
      strokeWidth="3"
    />

    {/* Connection Lines (Splitting 1 Source into 3 Destinations) */}
    <path
      d="M21 32 H32 V11 H43 M32 32 H43 M32 32 V53 H43"
      fill="none"
      stroke="#000000"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);