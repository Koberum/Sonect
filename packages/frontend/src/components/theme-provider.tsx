import { createContext, useContext, useEffect, useState } from "react";
import {
  DEFAULT_THEME_TEMPLATE,
  THEME_TEMPLATE_STORAGE_KEY,
  isThemeTemplate,
  type ThemeTemplate,
} from "@/themes";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  template: ThemeTemplate;
  setTemplate: (template: ThemeTemplate) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  template: DEFAULT_THEME_TEMPLATE,
  setTemplate: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );
  const [template, setTemplateState] = useState<ThemeTemplate>(() => {
    const stored = localStorage.getItem(THEME_TEMPLATE_STORAGE_KEY);
    return isThemeTemplate(stored) ? stored : DEFAULT_THEME_TEMPLATE;
  });

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    window.document.documentElement.dataset.theme = template;
  }, [template]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    template,
    setTemplate: (template: ThemeTemplate) => {
      localStorage.setItem(THEME_TEMPLATE_STORAGE_KEY, template);
      setTemplateState(template);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
