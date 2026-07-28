export type WidgetPreviewThemeChrome = {
  canvasBackground: string;
  canvasColor: string;
  titleBorder: string;
  cardBackground: string;
  frameBorder: string;
  frameShadow: string;
};

/** Resolved theme colors for iframe preview chrome (matches app CSS variables). */
export function getWidgetPreviewThemeChrome(isDark: boolean): WidgetPreviewThemeChrome {
  if (typeof document === "undefined") {
    return isDark
      ? {
          canvasBackground: "rgb(15, 23, 42)",
          canvasColor: "rgb(226, 232, 240)",
          titleBorder: "rgba(255, 255, 255, 0.12)",
          cardBackground: "rgb(30, 41, 59)",
          frameBorder: "rgba(96, 165, 250, 0.35)",
          frameShadow: "0 12px 40px rgba(59, 130, 246, 0.2), 0 0 0 1px rgba(96, 165, 250, 0.2)",
        }
      : {
          canvasBackground: "rgb(248, 250, 252)",
          canvasColor: "rgb(15, 23, 42)",
          titleBorder: "rgba(0, 0, 0, 0.08)",
          cardBackground: "rgb(255, 255, 255)",
          frameBorder: "rgba(37, 99, 235, 0.2)",
          frameShadow: "0 12px 36px rgba(37, 99, 235, 0.12), 0 0 0 1px rgba(37, 99, 235, 0.15)",
        };
  }

  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none;";
  probe.style.backgroundColor = "var(--background)";
  probe.style.color = "var(--foreground)";
  probe.style.border = "1px solid var(--border)";
  document.documentElement.appendChild(probe);
  const styles = getComputedStyle(probe);
  probe.style.backgroundColor = "var(--card)";
  const cardBackground = getComputedStyle(probe).backgroundColor;
  probe.style.color = "var(--primary)";
  const primaryColor = getComputedStyle(probe).color;
  probe.remove();

  const frameBorder = withAlpha(primaryColor, isDark ? 0.34 : 0.22);
  const glowColor = withAlpha(primaryColor, isDark ? 0.24 : 0.14);

  return {
    canvasBackground: styles.backgroundColor,
    canvasColor: styles.color,
    titleBorder: styles.borderColor,
    cardBackground,
    frameBorder,
    frameShadow: `0 14px 42px ${glowColor}, 0 0 0 1px ${frameBorder}`,
  };
}

function withAlpha(rgbOrColor: string, alpha: number): string {
  const match = rgbOrColor.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  }
  return `rgba(37, 99, 235, ${alpha})`;
}

/** Whether preview should use bundle artwork instead of raw template HTML. */
export function isStandardTbWidget(widgetType: string, htmlCode: string): boolean {
  return (
    widgetType !== "static" ||
    !htmlCode.trim() ||
    htmlCode.includes("<tb-") ||
    htmlCode.includes("<canvas")
  );
}

export function resolveWidgetPreviewContent(
  htmlCode: string,
  widgetType: string,
  artworkUrl?: string,
): string {
  if (isStandardTbWidget(widgetType, htmlCode) && artworkUrl) {
    const escapedUrl = artworkUrl.replace(/"/g, "&quot;");
    return `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; background: transparent;">
      <img src="${escapedUrl}" style="max-width: 90%; max-height: 90%; object-fit: contain; display: block;" alt="" />
    </div>`;
  }
  return htmlCode;
}

export function canRenderWidgetPreview(
  htmlCode: string,
  widgetType: string,
  artworkUrl?: string,
): boolean {
  if (isStandardTbWidget(widgetType, htmlCode)) {
    return Boolean(artworkUrl);
  }
  return htmlCode.trim().length > 0;
}
