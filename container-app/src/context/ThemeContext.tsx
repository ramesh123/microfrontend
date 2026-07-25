import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ContainerTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ContainerTheme;
  setTheme: (theme: ContainerTheme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "container-app-theme";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Container-level light/dark theme, independent of workflow-app's own
 * (much larger) theme context. Applies a `.dark` class to <html>, matching
 * the CSS-variable convention in src/index.css.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ContainerTheme>(
    () => (localStorage.getItem(STORAGE_KEY) as ContainerTheme) || "light",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useContainerTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useContainerTheme must be used within a ThemeProvider");
  }
  return context;
}
