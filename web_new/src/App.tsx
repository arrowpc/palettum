import MediaContainer from "@/components/media/media-container";
import { useSyncConfigToWorker } from "@/hooks/useSyncConfigToWorker";
import { ThemeProvider } from "@/components/theme-provider";
import PaletteManager from "./components/palette/palette-manager";

import("react-scan").then(({ scan }) => {
  scan({ enabled: true });
});

function App() {
  useSyncConfigToWorker();
  return (
    <>
      <main className="max-w-2xl mx-auto min-h-screen">
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <MediaContainer />
          <PaletteManager />
        </ThemeProvider>
      </main>
    </>
  );
}

export default App;
