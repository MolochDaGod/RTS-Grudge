import { useEffect } from "react";
import VibeConsole from "@/admin/vibe/VibeConsole";
import { useConsoleOverlay, isConsoleFocused } from "@/admin/vibe/useConsole";

// In-game VIBE console overlay. Mounts on top of the active game scene
// when the user presses backtick (`). While open, it dims the world and
// suspends gameplay keybinds by intercepting key events at the window
// capture phase. Closes on Escape (handled inside VibeConsole).
export default function VibeOverlay() {
  const { open, toggle, setOpen } = useConsoleOverlay();

  // Backtick toggles. Captured at window level so it works no matter what
  // has focus. We deliberately don't toggle on backtick when an input/
  // textarea has focus other than ours, to avoid hijacking text entry.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Backquote") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (!open && (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable)) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true } as any);
  }, [open, toggle]);

  // While the console is focused, swallow key events at capture so drei
  // KeyboardControls and our movement listeners don't see them.
  useEffect(() => {
    if (!open) return;
    const swallow = (e: KeyboardEvent) => {
      if (!isConsoleFocused()) return;
      // Let Escape bubble so VibeConsole's own escape handler can run
      // (it closes the palette, sessions modal, or the overlay itself).
      // Swallow everything else so drei KeyboardControls and gameplay
      // listeners don't see it while the user is typing.
      if (e.key === "Escape") return;
      e.stopPropagation();
    };
    window.addEventListener("keydown", swallow, { capture: true });
    window.addEventListener("keyup", swallow, { capture: true });
    return () => {
      window.removeEventListener("keydown", swallow, { capture: true } as any);
      window.removeEventListener("keyup", swallow, { capture: true } as any);
    };
  }, [open]);

  if (!open) return null;
  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0,
          background: "rgba(5,5,12,0.35)", pointerEvents: "none", zIndex: 9998,
        }}
      />
      <VibeConsole variant="overlay" onClose={() => setOpen(false)} />
    </>
  );
}
