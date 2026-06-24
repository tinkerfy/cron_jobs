"use client";

import { useEffect } from "react";

export default function ThemeInitializer() {
  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    const theme = stored === "dark" || stored === "light" ? stored :
      window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    localStorage.setItem("theme", theme);
  }, []);

  return null;
}
