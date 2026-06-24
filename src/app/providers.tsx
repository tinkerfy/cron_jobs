"use client";

import { ThemeProvider as TProvider } from "./theme-context";
import Home from "./page";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <TProvider>{children}</TProvider>;
}

export default function App() {
  return (
    <ThemeProvider>
      <Home />
    </ThemeProvider>
  );
}
