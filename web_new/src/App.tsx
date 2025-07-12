import MediaContainer from "@/components/media/media-container";
import { useSyncConfigToWorker } from "@/hooks/use-sync-config-to-worker";
import { ThemeProvider } from "@/providers/theme-provider";
import { GitHubButton } from "@/components/buttons/github-button";
import { ThemeToggle } from "@/components/buttons/theme-toggle";
import PaletteManager from "@/components/palette/palette-manager";
import SettingsPanel from "@/components/settings/settings-panel";
import { ExportButton } from "@/components/buttons/export-button";
import { useMediaStore } from "@/store";

import("react-scan").then(({ scan }) => {
  scan({ enabled: true });
});

function App() {
  useSyncConfigToWorker();
  const file = useMediaStore((state) => state.file);

  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <main className="max-w-2xl mx-auto min-h-screen flex flex-col gap-8">
          <div className="flex justify-between w-full items-center">
            <GitHubButton />
            <h1>Palettum</h1>
            <ThemeToggle />
          </div>
          <MediaContainer />
          <PaletteManager />
          {file && (
            <>
              <SettingsPanel />
              <ExportButton />
            </>
          )}
        </main>
      </ThemeProvider>
    </>
  );
}

export default App;
