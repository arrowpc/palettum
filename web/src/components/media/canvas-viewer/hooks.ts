import { useCallback, useRef } from "react";
import { useDebounceCallback } from "usehooks-ts";
import type { TapEvent } from "./types";

export function useContinuousTap(
  singleTap: (e: TapEvent) => void,
  doubleTap: (e: TapEvent) => void,
) {
  const continuousClick = useRef(0);
  const debounceTap = useDebounceCallback((e: TapEvent) => {
    continuousClick.current = 0;
    singleTap(e);
  }, 300);

  return useCallback(
    (e: TapEvent) => {
      continuousClick.current += 1;
      debounceTap(e);
      if (continuousClick.current >= 2) {
        debounceTap.cancel();
        continuousClick.current = 0;
        doubleTap(e);
      }
    },
    [debounceTap, doubleTap],
  );
}
