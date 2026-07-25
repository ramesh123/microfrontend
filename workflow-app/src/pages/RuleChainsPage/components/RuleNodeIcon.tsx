import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";

import "../rule-chain-material-ligature.css";

import { isThemeDarkAppearance, useTheme } from "@/context/theme";
import { API_BASE_URL } from "@/controllers/API/api";
import { cn } from "@/lib/utils";

/** Matches rule-chain `colorMode`: `*-dark`, `dark`, `blue-dark-g`, or `system` + prefers-color-scheme. */
function useFlowThemeIsDark(): boolean {
  const { theme } = useTheme();
  return useMemo(() => isThemeDarkAppearance(theme), [theme]);
}

/** Skip invert for known full-color assets (logos, CDN tiles). Everything else is treated as a dark silhouette in dark UI. */
function shouldKeepFullColorInDark(src: string): boolean {
  const lower = src.toLowerCase();
  if (lower.includes("amazonaws.com") || lower.includes("cloudfront.net")) return true;
  if (/(^|[/])brand[/]|logo\.(png|jpg|jpeg|webp|gif)(\?|$)/i.test(lower)) return true;
  return false;
}

/**
 * Resolve ThingsBoard / gateway `iconUrl` for `<img src>`.
 * Handles `data:`, absolute http(s), protocol-relative `//`, site-root `/…`, and paths under `/api`.
 */
export function resolveRuleNodeAssetUrl(iconUrl?: string | null): string | undefined {
  if (!iconUrl?.trim()) return undefined;
  const u = iconUrl.trim();
  if (u.startsWith("data:")) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("//")) {
    if (typeof window !== "undefined" && window.location?.protocol) {
      return `${window.location.protocol}${u}`;
    }
    return `https:${u}`;
  }
  if (u.startsWith("/")) return u;

  const trimmed = u.replace(/^\/+/, "");
  const base = API_BASE_URL.replace(/\/$/, "");

  // Avoid `/api/api/...` when gateway already prefixes with `api/`
  if (trimmed.startsWith("api/")) {
    return `/${trimmed}`;
  }

  // ThingsBoard-style static paths often work as site-root (proxy serves them).
  if (/rulenode|rule-node|rule_node|thingsboard/i.test(trimmed)) {
    return `/${trimmed}`;
  }

  return `${base}/${trimmed}`;
}

/** Slug variants ThingsBoard / Java icon names may use. */
function iconNameSlugCandidates(iconName: string): string[] {
  const raw = iconName
    .trim()
    .replace(/^mdi:/i, "")
    .replace(/^material_?symbols?_?(outlined|rounded)?_?/i, "")
    .replace(/^material_?icons?_?/i, "");

  const out: string[] = [];
  const pushSnake = (s: string) => {
    const snake = s
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    if (snake) out.push(snake);
    const flat = s.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    if (flat && flat !== snake) out.push(flat);
  };

  pushSnake(raw);
  // ThingsBoard enum style: `Icon.INPUT` or `org.thingsboard.rule.engine.filter.TbMsgTypeFilterNode`
  if (raw.includes(".")) {
    const tail = raw.split(".").pop()?.trim() ?? "";
    if (tail && tail !== raw) {
      pushSnake(tail.replace(/^Tb/i, "").replace(/Node$/i, ""));
    }
  }
  // ALL_CAPS enum
  if (/^[A-Z0-9_]+$/.test(raw)) {
    const lower = raw.toLowerCase();
    if (lower) out.push(lower);
  }

  return [...new Set(out.filter(Boolean))];
}

/** First Material Icons ligature string for ThingsBoard `icon` / segment fallback (underscore names). */
function pickFirstMaterialLigature(iconName?: string | null, fallbackMaterialIcon?: string | null): string | null {
  for (const raw of [iconName?.trim(), fallbackMaterialIcon?.trim()].filter(Boolean) as string[]) {
    const c = iconNameSlugCandidates(raw);
    if (c[0]) return c[0];
  }
  return null;
}

type MaterialFamily = "materialsymbolsoutlined" | "materialsymbolsrounded" | "materialicons";

function materialIconUrl(family: MaterialFamily, slug: string, size: "20px" | "24px" | "48px"): string {
  return `https://fonts.gstatic.com/s/i/short-term/release/${family}/${slug}/default/${size}.svg`;
}

/** Ordered list of CDN URLs to try for one logical icon name. */
function buildMaterialIconUrlList(iconName: string): string[] {
  const slugs = iconNameSlugCandidates(iconName);
  const families: MaterialFamily[] = ["materialsymbolsoutlined", "materialsymbolsrounded", "materialicons"];
  const sizes: ("20px" | "24px" | "48px")[] = ["24px", "48px", "20px"];
  const urls: string[] = [];
  for (const slug of slugs) {
    for (const family of families) {
      for (const size of sizes) {
        urls.push(materialIconUrl(family, slug, size));
      }
    }
  }
  return urls;
}

type RuleNodeIconProps = {
  iconUrl?: string | null;
  /** ThingsBoard `nodeDefinition.icon` (Material-style ligature, e.g. `input`, `filter_alt`). */
  iconName?: string | null;
  /** When API omits `iconName`, try this Material slug (e.g. segment default — not used for FLOW). */
  fallbackMaterialIcon?: string | null;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
};

/** ThingsBoard-style placeholder when no `iconUrl` / Material glyph applies (Flow palette default). */
function TbNodeIconPlaceholder({ className, style }: { className?: string; style?: CSSProperties }) {
  const isDark = useFlowThemeIsDark();
  return (
    <span
      style={style}
      className={cn(
        "inline-flex select-none items-center justify-center font-mono text-[11px] font-semibold leading-none tracking-tight",
        isDark ? "text-slate-300" : "text-slate-600",
        className,
      )}
      aria-hidden
    >
      {"<...>"}
    </span>
  );
}

/**
 * Prefer `iconUrl`, else Material CDN, else ligature.
 * Dark UI: `<img>` icons default to white (invert); a short allowlist preserves full-color logos.
 */
export function RuleNodeIcon({ iconUrl, iconName, fallbackMaterialIcon, className, imgClassName, style }: RuleNodeIconProps) {
  const isDark = useFlowThemeIsDark();
  const resolvedUrl = resolveRuleNodeAssetUrl(iconUrl);
  const [urlFailed, setUrlFailed] = useState(false);
  const ligature = useMemo(
    () => pickFirstMaterialLigature(iconName, fallbackMaterialIcon),
    [iconName, fallbackMaterialIcon],
  );
  const materialUrls = useMemo(() => {
    if (ligature) return [];
    const primary = iconName?.trim() ? buildMaterialIconUrlList(iconName.trim()) : [];
    const fb = fallbackMaterialIcon?.trim();
    const secondary = fb && fb !== iconName?.trim() ? buildMaterialIconUrlList(fb) : [];
    return [...new Set([...primary, ...secondary])];
  }, [iconName, fallbackMaterialIcon, ligature]);
  const [materialIndex, setMaterialIndex] = useState(0);

  /** Dark theme: black/dark silhouettes → light icons (`brightness-0` then `invert`). */
  const darkToneForSrc = useCallback(
    (src: string) => (isDark && !shouldKeepFullColorInDark(src) ? "brightness-0 invert opacity-90" : ""),
    [isDark],
  );

  useEffect(() => {
    setUrlFailed(false);
    setMaterialIndex(0);
  }, [iconName, iconUrl, fallbackMaterialIcon]);

  const onResolvedUrlError = useCallback(() => {
    setUrlFailed(true);
  }, []);

  const onMaterialError = useCallback(() => {
    setMaterialIndex((i) => i + 1);
  }, []);

  if (resolvedUrl && !urlFailed) {
    return (
      <img
        src={resolvedUrl}
        alt=""
        draggable={false}
        style={style}
        className={cn("object-contain", imgClassName, className, darkToneForSrc(resolvedUrl))}
        onError={onResolvedUrlError}
      />
    );
  }

  if (ligature) {
    return (
      <span
        style={style}
        className={cn(
          "mat-icon rule-chain-material-ligature notranslate material-icons mat-ligature-font mat-icon-no-color",
          className,
          imgClassName,
        )}
        aria-hidden
      >
        {ligature}
      </span>
    );
  }

  if (materialUrls.length > 0 && materialIndex < materialUrls.length) {
    const src = materialUrls[materialIndex];
    return (
      <img
        key={src}
        src={src}
        alt=""
        draggable={false}
        style={style}
        className={cn("object-contain", imgClassName, className, darkToneForSrc(src))}
        onError={onMaterialError}
      />
    );
  }

  return <TbNodeIconPlaceholder className={className} style={style} />;
}
