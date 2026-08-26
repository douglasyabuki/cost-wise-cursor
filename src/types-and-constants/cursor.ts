export type CursorUsagePool = "cursor-models" | "other-models";
export interface CursorModelPrice {
  model: string;
  modelUrl: string | null;
  provider: string;
  usagePool: CursorUsagePool;
  inputPerMillion: number;
  cacheWritePerMillion: number | null;
  cacheReadPerMillion: number | null;
  outputPerMillion: number;
  notes: string | null;
  /**
   * Whether this base model requires Max Mode on legacy request-based plans.
   */
  requiresLegacyMaxMode: boolean;
}
