import { useEffect } from "react";

export const useOutsideClick = (
  ref: React.RefObject<HTMLElement>,
  handler: () => void,
  enabled = true,
) => {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [enabled, handler, ref]);
};
