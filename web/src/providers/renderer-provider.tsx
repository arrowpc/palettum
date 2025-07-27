import {
  type PropsWithChildren,
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
} from "react";
import { wrap, type Remote } from "comlink";
import { type RendererAPI } from "@/workers/render";

type API = Remote<RendererAPI>;

interface RendererContextType {
  renderer: API | null;
  initRenderer: () => Promise<void>;
}

const RendererCtx = createContext<RendererContextType | null>(null);

export function RendererProvider({ children }: PropsWithChildren) {
  const apiRef = useRef<API | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const initRenderer = useCallback(async () => {
    if (isInitialized) return;

    const worker = new Worker(new URL("@/workers/render.ts", import.meta.url), {
      type: "module",
    });
    apiRef.current = wrap<RendererAPI>(worker);

    await apiRef.current.init();
    setIsInitialized(true);
  }, [isInitialized]);

  useEffect(() => {
    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        // Worker currently relies on the garbage collector to be terminated which isn't great but works for now
      }
    };
  }, []);

  return (
    <RendererCtx.Provider value={{ renderer: apiRef.current, initRenderer }}>
      {children}
    </RendererCtx.Provider>
  );
}

export function useRenderer() {
  const ctx = useContext(RendererCtx);
  if (!ctx) throw new Error("useRenderer must be inside <RendererProvider>");
  return ctx;
}
