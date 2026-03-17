import type { AllocationData } from "./subgraph";

export function weiToGrt(wei: string): number {
  return Number(BigInt(wei)) / 1e18;
}

export function formatGrt(grt: number): string {
  if (grt >= 1_000_000) return `${(grt / 1_000_000).toFixed(2)}M`;
  if (grt >= 1_000) return `${(grt / 1_000).toFixed(1)}K`;
  return grt.toFixed(2);
}

export function formatPct(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

export function ppmToPercent(ppm: number): number {
  return (ppm / 1_000_000) * 100;
}

export interface WindowStats {
  label: string;
  days: number;
  delegatorRewards: number;
  indexerRewards: number;
  totalRewards: number;
  delegatorApy: number;
  totalAllocatedTokens: number;
  allocationsClosed: number;
  allocations: AllocationData[];
}

export function calculateWindowStats(
  allocations: AllocationData[],
  delegatedTokens: number,
  days: number,
  label: string,
  now: number
): WindowStats {
  const cutoff = now - days * 86400;
  const filtered = allocations.filter((a) => a.closedAt >= cutoff);

  const delegatorRewards = filtered.reduce(
    (sum, a) => sum + weiToGrt(a.indexingDelegatorRewards),
    0
  );
  const indexerRewards = filtered.reduce(
    (sum, a) => sum + weiToGrt(a.indexingIndexerRewards),
    0
  );
  const totalRewards = filtered.reduce(
    (sum, a) => sum + weiToGrt(a.indexingRewards),
    0
  );
  const totalAllocatedTokens = filtered.reduce(
    (sum, a) => sum + weiToGrt(a.allocatedTokens),
    0
  );

  const delegatorApy =
    delegatedTokens > 0
      ? (delegatorRewards / delegatedTokens) * (365 / days) * 100
      : 0;

  return {
    label,
    days,
    delegatorRewards,
    indexerRewards,
    totalRewards,
    delegatorApy,
    totalAllocatedTokens,
    allocationsClosed: filtered.length,
    allocations: filtered,
  };
}
