import MediaContainer from "./components/media/media-container";
import Strength from "./components/settings/blend/Strength";
import Quality from "./components/settings/general/Quality";
import { useSyncConfigToWorker } from "./hooks/useSyncConfigToWorker";

import("react-scan").then(({ scan }) => {
  scan({ enabled: true });
});

function App() {
  useSyncConfigToWorker();
  return (
    <>
      <main className="max-w-2xl mx-auto min-h-screen">
        <p>Hello!</p>
        <MediaContainer />
        <Quality />
        <Strength />
      </main>
    </>
  );
}

export default App;
