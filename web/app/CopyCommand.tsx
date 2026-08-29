"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "copied" | "failed";

const LABEL: Record<State, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Copy failed",
};

export default function CopyCommand({ command }: { command: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clicking again restarts the countdown instead of stacking timers, and an
  // unmount cancels it rather than setting state on a gone component.
  function reset() {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      // Clipboard is unavailable (insecure origin, denied permission). Say so
      // — a button that silently does nothing reads as broken.
      setState("failed");
    }
    reset();
  }

  return (
    <div className="command">
      <p className="command__text">
        <span className="command__prompt">$ </span>
        <code>{command}</code>
      </p>
      <button type="button" className="command__copy" onClick={copy}>
        <span aria-live="polite">{LABEL[state]}</span>
      </button>
    </div>
  );
}
