import { useState, useCallback } from "react";
import {
  fetchIndexer,
  fetchClosedAllocations,
  type IndexerData,
  type AllocationData,
} from "../utils/subgraph";
import { resolveEnsNames } from "../utils/ens";
import {
  calculateWindowStats,
  weiToGrt,
  type WindowStats,
} from "../utils/calculations";

export interface IndexerDashboard {
  indexer: IndexerData;
  delegatedGrt: number;
  stakedGrt: number;
  allocatedGrt: number;
  rewardCutPct: number;
  windows: WindowStats[];
}

export function useIndexerData() {
  const [data, setData] = useState<IndexerDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const [indexer, ensNames] = await Promise.all([
        fetchIndexer(address),
        resolveEnsNames([address]),
      ]);

      if (!indexer) {
        setError("Indexer not found. Make sure the address is correct and has active allocations.");
        return;
      }

      indexer.ensName = ensNames.get(address.toLowerCase());

      // Fetch allocations for the detail view APY breakdown
      const now = Math.floor(Date.now() / 1000);
      const sinceTimestamp = now - 90 * 86400;

      const allocations: AllocationData[] = await fetchClosedAllocations(
        address,
        sinceTimestamp
      );

      const delegatedGrt = weiToGrt(indexer.delegatedTokens);
      const stakedGrt = weiToGrt(indexer.stakedTokens);
      const allocatedGrt = weiToGrt(indexer.allocatedTokens);
      const rewardCutPct = (indexer.indexingRewardCut / 1_000_000) * 100;

      const windows = [
        calculateWindowStats(allocations, delegatedGrt, 30, "30 Day", now),
        calculateWindowStats(allocations, delegatedGrt, 60, "60 Day", now),
        calculateWindowStats(allocations, delegatedGrt, 90, "90 Day", now),
      ];

      setData({
        indexer,
        delegatedGrt,
        stakedGrt,
        allocatedGrt,
        rewardCutPct,
        windows,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, load };
}
