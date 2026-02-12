"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

const THEME_KEY = "flowlab-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const persisted = window.localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = persisted ? persisted === "dark" : systemPrefersDark;
    root.classList.toggle("dark", useDark);
    setIsDark(useDark);
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const nextDark = !isDark;
    setIsDark(nextDark);
    root.classList.toggle("dark", nextDark);
    window.localStorage.setItem(THEME_KEY, nextDark ? "dark" : "light");
  }

  return (
    <Button type="button" onClick={toggleTheme} variant="outline" size="sm" aria-label="Toggle theme">
      Theme {isDark ? "Dark" : "Light"}
    </Button>
  );
}
