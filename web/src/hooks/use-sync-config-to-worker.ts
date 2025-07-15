import { useEffect } from "react";
import { useConfigStore } from "@/stores";
import { useRenderer } from "@/providers/renderer-provider";

export function useSyncConfigToWorker() {
  const config = useConfigStore((state) => state.config);
  const renderer = useRenderer();

  useEffect(() => {
    if (renderer) {
      renderer.setConfig(config);
    }
  }, [config, renderer]);
}
