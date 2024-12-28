export interface Color {
  r: number;
  g: number;
  b: number;
}

export interface Palette {
  id: string;
  name: string;
  colors: Color[];
  source?: string;
}
