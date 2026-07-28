import type { JSX, ReactElement, ReactNode } from "react";

export type newFlowModalPropsType = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export type IconComponentProps = {
  name: string;
  className?: string;
  iconColor?: string;
  onClick?: () => void;
  stroke?: string;
  strokeWidth?: number;
  id?: string;
  skipFallback?: boolean;
  dataTestId?: string;
  size?: number;
};

export type modalHeaderType = {
  children: ReactNode;
  description?: string | JSX.Element | null;
  clampDescription?: number;
};

export type ShadToolTipType = {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  content?: ReactNode | null;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  asChild?: boolean;
  children?: ReactElement;
  delayDuration?: number;
  styleClasses?: string;
  avoidCollisions?: boolean;
};