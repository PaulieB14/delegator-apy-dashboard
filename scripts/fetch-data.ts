import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  fetchIndexerList,
  fetchAllClosedAllocations,
  fetchNetworkData,
  type IndexerSummary,
} from "../src/utils/subgraph";
import { resolveEnsNames } from "../src/utils/ens";
import {
  weiToGrt,
  calculateBulkApy,
  calculateEstimatedApy,
  type IndexerApyData,
} from "../src/utils/calculations";

async function main() {
  console.log("Fetching indexer list...");
  const indexers = await fetchIndexerList();
  console.log(`Found ${indexers.length} indexers`);

  const now = Math.floor(Date.now() / 1000);
  const since90 = now - 90 * 86400;

  const delegatedMap = new Map<string, number>();
  for (const idx of indexers) {
    delegatedMap.set(idx.id.toLowerCase(), weiToGrt(idx.delegatedTokens));
  }

  console.log("Fetching allocations, ENS names, and network data...");
  const [allocs, ensNames, network] = await Promise.all([
    fetchAllClosedAllocations(since90),
    resolveEnsNames(indexers.map((i) => i.id)),
    fetchNetworkData(),
  ]);
  console.log(`Fetched ${allocs.length} closed allocations`);

  // Calculate APY
  const apy = calculateBulkApy(allocs, delegatedMap, now);

  // Add estimated APY
  for (const idx of indexers) {
    const id = idx.id.toLowerCase();
    const existing = apy.get(id);
    const estApy = calculateEstimatedApy(idx, network);
    if (existing) {
      existing.estApy = estApy;
    } else {
      apy.set(id, {
        apy30: 0, apy60: 0, apy90: 0,
        rewards30: 0, rewards60: 0, rewards90: 0,
        allocs30: 0, allocs60: 0, allocs90: 0,
        estApy,
      });
    }
  }

  const payload = {
    updatedAt: new Date().toISOString(),
    indexers,
    apyData: Object.fromEntries(apy),
    ensNames: Object.fromEntries(ensNames),
  };

  const outPath = resolve(import.meta.dirname, "../public/data.json");
  writeFileSync(outPath, JSON.stringify(payload));
  console.log(`Wrote ${(JSON.stringify(payload).length / 1024).toFixed(0)}KB to ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
