import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "@/App.tsx";
import { RendererProvider } from "@/providers/renderer-provider.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RendererProvider>
      <App />
    </RendererProvider>
  </StrictMode>,
);
