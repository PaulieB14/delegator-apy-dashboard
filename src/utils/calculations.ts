import type { AllocationData, AllocationSummary, NetworkData, IndexerSummary } from "./subgraph";

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

// APY for a single window from lightweight allocation summaries
export interface ApyWindow {
  days: number;
  delegatorRewardsGrt: number;
  apy: number;
  allocationsClosed: number;
}

// Per-indexer APY data calculated from bulk allocations
export interface IndexerApyData {
  apy30: number;
  apy60: number;
  apy90: number;
  estApy: number; // estimated current APY from network params
  rewards30: number;
  rewards60: number;
  rewards90: number;
  allocs30: number;
  allocs60: number;
  allocs90: number;
}

// Estimated APR using signal-weighted per-allocation rewards
// Matches the Graphtronauts formula: for each active allocation,
// dailyRewards = issuancePerDay * (deploymentSignal / totalSignal) * (allocTokens / deploymentStaked)
// Then: delegatorAPR = (1 - cut) * sumDailyRewards / delegated * 365 * 100
const BLOCKS_PER_DAY_ETHEREUM = 7200; // 86400s / 12s

export function calculateEstimatedApy(
  indexer: IndexerSummary,
  network: NetworkData
): number {
  if (!indexer.allocations?.length) return 0;

  const delegated = Number(BigInt(indexer.delegatedTokens)) / 1e18;
  if (delegated <= 0) return 0;

  const issuancePerBlock = Number(BigInt(network.networkGRTIssuancePerBlock)) / 1e18;
  const dailyIssuance = issuancePerBlock * BLOCKS_PER_DAY_ETHEREUM;
  const totalSignal = Number(BigInt(network.totalTokensSignalled)) / 1e18;
  const rewardCut = indexer.indexingRewardCut / 1_000_000;

  if (totalSignal <= 0) return 0;

  // Sum daily rewards across all active allocations (signal-weighted)
  let totalDailyRewards = 0;
  for (const alloc of indexer.allocations) {
    if (alloc.subgraphDeployment.deniedAt || alloc.allocatedTokens === "0") continue;

    const allocTokens = Number(BigInt(alloc.allocatedTokens)) / 1e18;
    const deploymentStaked = Number(BigInt(alloc.subgraphDeployment.stakedTokens)) / 1e18;
    const deploymentSignal = Number(BigInt(alloc.subgraphDeployment.signalledTokens)) / 1e18;

    if (deploymentStaked <= 0) continue;

    const signalRatio = deploymentSignal / totalSignal;
    const stakeRatio = allocTokens / deploymentStaked;
    totalDailyRewards += dailyIssuance * signalRatio * stakeRatio;
  }

  // Delegator daily rewards = (1 - cut) * total daily rewards
  const delegatorDailyRewards = (1 - rewardCut) * totalDailyRewards;

  // APR = delegator daily / delegated * 365 * 100
  const apr = (delegatorDailyRewards / delegated) * 365 * 100;
  return apr < 0 || isNaN(apr) ? 0 : apr;
}

export function calculateBulkApy(
  allocations: AllocationSummary[],
  indexerDelegatedTokens: Map<string, number>,
  now: number
): Map<string, IndexerApyData> {
  const cutoff30 = now - 30 * 86400;
  const cutoff60 = now - 60 * 86400;

  // Group rewards by indexer and window
  const data = new Map<
    string,
    { r30: number; r60: number; r90: number; a30: number; a60: number; a90: number }
  >();

  for (const alloc of allocations) {
    const indexerId = alloc.indexer.id.toLowerCase();
    const rewards = weiToGrt(alloc.indexingDelegatorRewards);

    if (!data.has(indexerId)) {
      data.set(indexerId, { r30: 0, r60: 0, r90: 0, a30: 0, a60: 0, a90: 0 });
    }
    const d = data.get(indexerId)!;

    // 90-day window (all allocations are within 90 days)
    d.r90 += rewards;
    d.a90 += 1;

    if (alloc.closedAt >= cutoff60) {
      d.r60 += rewards;
      d.a60 += 1;
    }
    if (alloc.closedAt >= cutoff30) {
      d.r30 += rewards;
      d.a30 += 1;
    }
  }

  const results = new Map<string, IndexerApyData>();

  for (const [indexerId, d] of data) {
    const delegated = indexerDelegatedTokens.get(indexerId) || 0;
    if (delegated <= 0) continue;

    results.set(indexerId, {
      apy30: (d.r30 / delegated) * (365 / 30) * 100,
      apy60: (d.r60 / delegated) * (365 / 60) * 100,
      apy90: (d.r90 / delegated) * (365 / 90) * 100,
      estApy: 0, // filled in later with network data
      rewards30: d.r30,
      rewards60: d.r60,
      rewards90: d.r90,
      allocs30: d.a30,
      allocs60: d.a60,
      allocs90: d.a90,
    });
  }

  return results;
}

// Detailed window stats (for drill-in detail view)
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
