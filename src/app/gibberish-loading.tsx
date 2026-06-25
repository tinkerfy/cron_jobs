"use client";

import { useState, useEffect, useCallback } from "react";

const verbs = [
  "Calibrating", "Synchronizing", "Optimizing", "Compiling", "Resolving",
  "Synthesizing", "Aligning", "Initializing", "Encrypting", "Buffering",
  "Indexing", "Negotiating", "Rendering", "Calculating", "Activating",
  "Defragmenting", "Generating", "Decrypting", "Compressing", "Validating",
];

const adjectives = [
  "Quantum", "Hyper", "Recursive", "Dynamic", "Virtual", "Nebulous",
  "Fractal", "Parallel", "Cosmic", "Adaptive", "Modular", "Infinite",
  "Elastic", "Temporal", "Nano", "Plasma", "Zorbix", "Schrumble",
];

const nouns = [
  "Flux Capacitor", "Matrix", "Node", "Cache", "Engine", "Array",
  "Protocol", "Pipeline", "Buffer", "Widget", "Kernel", "Router",
  "Spline", "Circuit", "Token", "Banana", "Pancake", "Pickle",
  "Hamster", "Waffle", "Fluxon", "Gorbital", "Quantarix", "Nebulon",
  "Fractal Bus", "Hyperflux", "Photon", "Quantum Breadcrumb",
  "Pancake Protocol", "Wobble", "Frobnicator", "Zorbix Channel",
];

function generatePhrase(): string {
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${verb} ${adj} ${noun}...`;
}

interface GibberishLoadingProps {
  active: boolean;
  label?: string;
}

export default function GibberishLoading({ active, label = "Loading" }: GibberishLoadingProps) {
  const [phrase, setPhrase] = useState(() => "Initializing Fluxon Matrix...");
  const [key, setKey] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setKey((k) => k + 1);
      setPhrase(generatePhrase());
      setVisible(true);
    } else {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const timer = setTimeout(() => {
      setPhrase((prev) => {
        let newPhrase = generatePhrase();
        let attempts = 0;
        while (newPhrase === prev && attempts < 20) {
          newPhrase = generatePhrase();
          attempts++;
        }
        return newPhrase;
      });
    }, 1500 + Math.random() * 1500);

    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return <div className="h-5" />;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 h-5"
    >
      <span className="sr-only">{label}, please wait.</span>
      <span className="text-xs text-[#8BAFAD] dark:text-slate-500 font-mono tabular-nums">
        {phrase}
      </span>
    </div>
  );
}
