import { Toaster } from "sonner";

/** Toast host — no next-themes dependency. */
export function ForgeToaster() {
  return (
    <Toaster
      theme="dark"
      position="bottom-right"
      richColors
      closeButton
    />
  );
}