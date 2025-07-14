import { useEffect } from "react";

export const useLockBodyScroll = (locked: boolean) => {
  useEffect(() => {
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
};
