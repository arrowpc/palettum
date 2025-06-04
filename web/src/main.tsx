import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ShaderProvider } from "./ShaderContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ShaderProvider>
      <App />
    </ShaderProvider>
  </StrictMode>,
);
