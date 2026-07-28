export type PreviewContainerStyle = {
  backgroundColor: string;
  color: string;
  padding: string;
  margin: string;
  borderRadius: string;
  boxShadow: string;
};

type CardStyleConfig = {
  backgroundColor: string;
  textColor: string;
  padding: string;
  margin: string;
  borderRadius: string;
  dropShadow: boolean;
};

export function parseWidgetStyleJson(json: string): Record<string, string> {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value == null) continue;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        out[key] = String(value);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function buildWidgetStyleJsonFromConfig(config: CardStyleConfig): string {
  const style: Record<string, string> = {};
  if (config.backgroundColor) style.backgroundColor = config.backgroundColor;
  if (config.textColor) style.color = config.textColor;
  if (config.padding) style.padding = config.padding;
  if (config.margin) style.margin = config.margin;
  if (config.borderRadius) style.borderRadius = config.borderRadius;
  if (config.dropShadow) {
    style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  }
  return Object.keys(style).length > 0 ? JSON.stringify(style, null, 2) : "{}";
}

export function resolvePreviewContainerStyle(
  config: CardStyleConfig,
  widgetStyleJson: string,
): PreviewContainerStyle {
  const fromJson = parseWidgetStyleJson(widgetStyleJson);

  const backgroundColor =
    fromJson.backgroundColor ?? (config.backgroundColor || "transparent");
  const color = fromJson.color ?? (config.textColor || "inherit");
  const padding = fromJson.padding ?? (config.padding || "0px");
  const margin = fromJson.margin ?? (config.margin || "0px");
  const borderRadius = fromJson.borderRadius ?? (config.borderRadius || "0px");

  let boxShadow = fromJson.boxShadow ?? "";
  if (!boxShadow && config.dropShadow) {
    boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
  }

  return {
    backgroundColor,
    color,
    padding,
    margin,
    borderRadius,
    boxShadow,
  };
}
