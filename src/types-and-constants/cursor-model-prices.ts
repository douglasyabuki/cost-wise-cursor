export interface CursorModelPrice {
  model: string;
  modelUrl: string | null;
  provider: string;
  inputPerMillion: number;
  cacheWritePerMillion: number | null;
  cacheReadPerMillion: number | null;
  outputPerMillion: number;
  notes: string | null;
}
