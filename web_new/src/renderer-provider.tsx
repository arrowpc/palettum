import {
  type PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { wrap, type Remote } from "comlink";
import { type RendererAPI, type MediaInfo } from "./workers/render";

type API = Remote<RendererAPI>;

const RendererCtx = createContext<API | null>(null);

export function RendererProvider({ children }: PropsWithChildren) {
  const apiRef = useRef<API | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const worker = new Worker(new URL("./workers/render.ts", import.meta.url), {
      type: "module",
    });
    apiRef.current = wrap<RendererAPI>(worker);

    apiRef.current.init().then(() => setReady(true));

    return () => {
      apiRef.current?.dispose();
      worker.terminate();
    };
  }, []);

  return (
    <RendererCtx.Provider value={apiRef.current}>
      {ready ? children : null}
    </RendererCtx.Provider>
  );
}

export function useRenderer() {
  const ctx = useContext(RendererCtx);
  if (!ctx) throw new Error("useRenderer must be inside <RendererProvider>");
  return ctx;
}
