import { useEffect } from "react";
import { useConfigStore } from "@/store";
import { useRenderer } from "@/providers/renderer-provider";

export function useSyncConfigToWorker() {
  const config = useConfigStore((state) => state.config);
  const renderer = useRenderer();

  useEffect(() => {
    if (renderer) {
      console.log(config);
      renderer.setConfig(config);
    }
  }, [config, renderer]);
}
