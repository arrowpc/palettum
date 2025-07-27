import { lazy, Suspense } from "react";
import MediaContainer from "@/components/media/media-container";
import { ThemeProvider } from "@/providers/theme-provider";
import { GitHubButton } from "@/components/buttons/github-button";
import { ThemeToggle } from "@/components/buttons/theme-toggle";
import PaletteManager from "@/components/palette/palette-manager";
import { useMediaStore } from "@/stores";
import Footer from "@/components/footer";

const SettingsPanel = lazy(
  () => import("@/components/settings/settings-panel"),
);
const ExportButton = lazy(() =>
  import("@/components/buttons/export-button").then((module) => ({
    default: module.ExportButton,
  })),
);

if (process.env.NODE_ENV === "development") {
  import("react-scan").then(({ scan }) => {
    scan({ enabled: true });
  });
}

function App() {
  const file = useMediaStore((state) => state.file);

  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <main className="max-w-2xl mx-auto min-h-screen flex flex-col gap-8 mt-8">
          <h1 className="text-3xl text-center">Palettum</h1>
          <div className="flex justify-between w-full items-center gap-8">
            <GitHubButton />
            <p className="text-center text-sm text-muted-foreground">
              Instantly style and recolor images, GIFs, and videos with your
              custom palette
            </p>
            <ThemeToggle />
          </div>
          <MediaContainer />
          <PaletteManager />
          {file && (
            <Suspense
              fallback={
                <div className="flex justify-center items-center">
                  Loading...
                </div>
              }
            >
              <SettingsPanel />
              <ExportButton />
            </Suspense>
          )}
          <Footer />
        </main>
      </ThemeProvider>
    </>
  );
}

export default App;
