import { useEffect, useState } from "react";

export const useColorCycle = (
  length: number,
  enabled: boolean,
  interval = 500,
) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || length <= 1) return;

    const id = setInterval(() => setIndex((i) => (i + 1) % length), interval);

    return () => clearInterval(id);
  }, [length, enabled, interval]);

  return index;
};
