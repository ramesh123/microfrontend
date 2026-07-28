import React, { Suspense, forwardRef, memo } from "react";
import type { IconComponentProps } from "@/types/components";
import { getNodeIcon } from "@/utils/styleUtils";
import { cn } from "@/lib/utils";

import { useCallback, useEffect, useState, useRef } from "react";

export const ForwardedIconComponent = memo(
  forwardRef(
    (
      {
        name,
        className,
        iconColor,
        stroke,
        strokeWidth,
        id = "",
        skipFallback = false,
        dataTestId = "",
        size = 24,
      }: IconComponentProps,
      ref,
    ) => {
      const [iconError, setIconError] = useState(false);
      const [TargetIcon, setTargetIcon] = useState<any>(null);
      const loadedIconName = useRef<string | null>(null);

      useEffect(() => {
        // Only load/reload the icon when the name changes
        if (loadedIconName.current !== name) {
          loadedIconName.current = name;
          setIconError(false);
          setTargetIcon(null);

          // Load the icon if we have a name
          if (name && typeof name === "string") {
            getNodeIcon(name)
              .then((component) => {
                setTargetIcon(component);
              })
              .catch((error) => {
                console.error(`Error loading icon ${name}:`, error);
                setIconError(true);
              });
          }
        }
      }, [name]);

      const style = {
        strokeWidth: strokeWidth ?? 1.5,
        ...(stroke && { stroke: stroke }),
        ...(iconColor && { color: iconColor, stroke: stroke }),
      };

      // Handler for when the Suspense component throws
      const handleError = useCallback(() => {
        setIconError(true);
      }, []);

      if (!TargetIcon || iconError) {
        // Return a placeholder div or null depending on settings
        return skipFallback ? null : (
          <div
            className={cn(className, "flex items-center justify-center")}
            data-testid={
              dataTestId
                ? dataTestId
                : id
                  ? `${id}-placeholder`
                  : `icon-placeholder`
            }
          />
        );
      }

      return (
        <Suspense fallback={skipFallback ? undefined : <div className={className} />}>
          <ErrorBoundary onError={handleError}>
            {TargetIcon?.render || TargetIcon?._payload ? (
              <TargetIcon
                className={className}
                style={style}
                ref={ref}
                size={size}
                data-testid={
                  dataTestId
                    ? dataTestId
                    : id
                      ? `${id}-${name}`
                      : `icon-${name}`
                }
              />
            ) : (
              <div
                className={className}
                style={style}
                data-testid={
                  dataTestId
                    ? dataTestId
                    : id
                      ? `${id}-${name}`
                      : `icon-${name}`
                }
              >
                {TargetIcon}
              </div>
            )}
          </ErrorBoundary>
        </Suspense>
      );
    },
  ),
);

// Simple error boundary component for catching lazy load errors
class ErrorBoundary extends React.Component<{
  children: React.ReactNode;
  onError: () => void;
}> {
  componentDidCatch(_error: any) {
    this.props.onError();
  }

  render() {
    return this.props.children;
  }
}

export default ForwardedIconComponent;
