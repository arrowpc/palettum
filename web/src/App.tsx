import { lazy, Suspense } from "react";
import { ThemeProvider } from "@/providers/theme-provider";
import { useMediaStore } from "@/stores";

const MediaContainer = lazy(() => import("@/components/media/media-container"));
const PaletteManager = lazy(
  () => import("@/components/palette/palette-manager"),
);
const SettingsPanel = lazy(
  () => import("@/components/settings/settings-panel"),
);
const ExportButton = lazy(() =>
  import("@/components/buttons/export-button").then((module) => ({
    default: module.ExportButton,
  })),
);
const GitHubButton = lazy(() =>
  import("@/components/buttons/github-button").then((module) => ({
    default: module.GitHubButton,
  })),
);
const ThemeToggle = lazy(() =>
  import("@/components/buttons/theme-toggle").then((module) => ({
    default: module.ThemeToggle,
  })),
);
const Footer = lazy(() => import("@/components/footer"));

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
            <Suspense fallback={null}>
              <GitHubButton />
            </Suspense>
            <p className="text-center text-sm text-muted-foreground">
              Instantly style and recolor images, GIFs, and videos with your
              custom palette
            </p>
            <Suspense fallback={null}>
              <ThemeToggle />
            </Suspense>
          </div>
          <Suspense
            fallback={
              <div className="flex justify-center items-center">Loading...</div>
            }
          >
            <MediaContainer />
          </Suspense>
          <Suspense fallback={null}>
            <PaletteManager />
          </Suspense>
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
          <Suspense fallback={null}>
            <Footer />
          </Suspense>
        </main>
      </ThemeProvider>
    </>
  );
}

export default App;
