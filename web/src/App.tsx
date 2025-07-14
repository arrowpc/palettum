import MediaContainer from "@/components/media/media-container";
import { useSyncConfigToWorker } from "@/hooks/use-sync-config-to-worker";
import { ThemeProvider } from "@/providers/theme-provider";
import { GitHubButton } from "@/components/buttons/github-button";
import { ThemeToggle } from "@/components/buttons/theme-toggle";
import PaletteManager from "@/components/palette/palette-manager";
import SettingsPanel from "@/components/settings/settings-panel";
import { ExportButton } from "@/components/buttons/export-button";
import { useMediaStore } from "@/store";
import Footer from "@/components/footer";

import("react-scan").then(({ scan }) => {
  scan({ enabled: true });
});

function App() {
  useSyncConfigToWorker();
  const file = useMediaStore((state) => state.file);

  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <main className="max-w-2xl mx-auto min-h-screen flex flex-col gap-8 mt-8">
          <h1 className="text-3xl text-center">Palettum</h1>
          <div className="flex justify-between w-full items-center gap-8">
            <GitHubButton />
            <p className="text-center text-sm text-muted-foreground">
              Instantly style and recolor images, GIFs, and videos with your custom palette
            </p>
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
          <Footer />
        </main>
      </ThemeProvider>
    </>
  );
}

export default App;
