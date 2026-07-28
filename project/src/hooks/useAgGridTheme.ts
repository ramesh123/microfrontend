import { useMemo } from "react";
import { useTheme } from "@/context/theme";
import { buildAgGridTheme } from "@/utils/agGridTheme";

/** Shared AG Grid theme synced with app appearance (including blue-dark, blue-dark-g, etc.). */
export function useAgGridTheme() {
  const { theme } = useTheme();
  const agTheme = useMemo(() => buildAgGridTheme(theme), [theme]);
  return { agTheme, theme };
}
