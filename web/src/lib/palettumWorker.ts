let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (res: any) => void>();
let workerInitializationPromise: Promise<void> | null = null;

function createNewWorker() {
  const newWorker = new Worker(new URL("../worker.ts", import.meta.url), {
    type: "module",
  });
  newWorker.onmessage = (e) => {
    const { id, status, result, error } = e.data;
    const cb = pending.get(id);
    if (cb) {
      cb({ status, result, error });
      pending.delete(id);
    }
  };
  return newWorker;
}

function getWorker() {
  if (!worker) {
    console.log("palettumWorker: Creating new Web Worker.");
    worker = createNewWorker();
  }
  return worker;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (worker) {
      console.log("palettumWorker: HMR disposing old worker.");
      worker.terminate();
    }
    worker = null;
    pending.clear();
  });
}

export function initializeWorker(): Promise<void> {
  if (!workerInitializationPromise) {
    console.log("palettumWorker: Queuing worker initialization.");
    workerInitializationPromise = new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, ({ status, error }) => {
        if (status === "success") {
          console.log("palettumWorker: Worker successfully primed.");
          resolve();
        } else {
          console.error("palettumWorker: Worker priming failed.", error);
          reject(new Error(error || "Unknown worker error during init"));
        }
      });
      // Get the worker (creates if not exists) and post the init message
      getWorker().postMessage({ id, type: "init" });
    });
  }
  return workerInitializationPromise;
}

export function load(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, ({ status, error }) => {
      if (status === "success") resolve();
      else reject(new Error(error || "Unknown worker error during load"));
    });
    getWorker().postMessage({ id, type: "load", bytes });
  });
}

export function clear(): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, ({ status, error }) => {
      if (status === "success") resolve();
      else reject(new Error(error || "Unknown worker error during clear"));
    });
    getWorker().postMessage({ id, type: "clear" });
  });
}

export function palettify(config: any): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, ({ status, result, error }) => {
      if (status === "success") resolve(result);
      else reject(new Error(error || "Unknown worker error during palettify"));
    });
    getWorker().postMessage({ id, type: "palettify", config });
  });
}
