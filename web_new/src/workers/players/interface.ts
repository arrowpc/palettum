export interface Player {
  init(): Promise<void> | void;
  play(): void;
  pause(): void;
  seek(t: number): void; // ms
  dispose(): Promise<void>;
}
