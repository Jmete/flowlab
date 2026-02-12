"use client";

import * as React from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    const current = root.classList.contains("dark");
    setIsDark(current);
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const nextDark = !isDark;
    setIsDark(nextDark);
    root.classList.toggle("dark", nextDark);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm"
      aria-label="Toggle theme"
    >
      {isDark ? "Light" : "Dark"}
    </button>
  );
}
