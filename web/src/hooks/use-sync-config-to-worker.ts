import { useEffect } from "react";
import { useRenderer } from "@/providers/renderer-provider";
import { useConfigStore } from "@/stores";

export function useSyncConfigToWorker() {
  const renderer = useRenderer();

  useEffect(() => {
    if (!renderer) return;

    // Sync initial config
    renderer.setConfig(useConfigStore.getState().config);

    // Subscribe to any store change, pull out config manually
    const unsubscribe = useConfigStore.subscribe((state) => {
      renderer.setConfig(state.config);
    });

    return unsubscribe;
  }, [renderer]);
}
