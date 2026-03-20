declare const process: { env?: Record<string, string | undefined> } | undefined;

function getEnv(key: string): string {
  // Node.js (scripts)
  if (typeof process !== "undefined" && process?.env?.[key]) return process.env[key]!;
  // Vite (browser)
  try { return (import.meta as any).env?.[key] || ""; } catch { return ""; }
}

const SUBGRAPH_ID = getEnv("VITE_SUBGRAPH_ID");
const API_KEY = getEnv("VITE_GRAPH_API_KEY");
const SUBGRAPH_URL = API_KEY
  ? `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`
  : `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`;

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delayMs = 2000
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;
    const body = await res.text();
    if (attempt < retries && (res.status >= 500 || res.status === 429)) {
      console.warn(`Subgraph request failed (HTTP ${res.status}), retry ${attempt}/${retries}...`);
      await new Promise((r) => setTimeout(r, delayMs * attempt));
      continue;
    }
    throw new Error(`Subgraph HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error("Subgraph request failed after retries");
}

export async function querySubgraph<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetchWithRetry(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  if (!text) {
    throw new Error("Subgraph returned empty response");
  }
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Subgraph returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join(", "));
  }
  return json.data as T;
}

export interface ActiveAllocationSummary {
  allocatedTokens: string;
  subgraphDeployment: {
    id: string;
    stakedTokens: string;
    signalledTokens: string;
    deniedAt: number | null;
  };
}

export interface IndexerSummary {
  id: string;
  delegatedTokens: string;
  stakedTokens: string;
  allocatedTokens: string;
  indexingRewardCut: number;
  allocationCount: number;
  allocations: ActiveAllocationSummary[];
  ensName?: string;
}

export interface IndexerData {
  id: string;
  stakedTokens: string;
  delegatedTokens: string;
  allocatedTokens: string;
  rewardsEarned: string;
  indexerIndexingRewards: string;
  delegatorIndexingRewards: string;
  indexingRewardCut: number;
  queryFeeCut: number;
  delegationExchangeRate: string;
  allocationCount: number;
  totalAllocationCount: string;
  ensName?: string;
}

export interface AllocationData {
  id: string;
  allocatedTokens: string;
  indexingRewards: string;
  indexingIndexerRewards: string;
  indexingDelegatorRewards: string;
  createdAt: number;
  closedAt: number;
  indexingRewardCutAtClose: number | null;
  subgraphDeployment: {
    id: string;
  };
}

// Lightweight allocation for bulk APY calculation (no deployment details)
export interface AllocationSummary {
  id: string;
  indexer: { id: string };
  indexingDelegatorRewards: string;
  closedAt: number;
}

export async function fetchIndexerList(): Promise<IndexerSummary[]> {
  const allIndexers: IndexerSummary[] = [];
  let skip = 0;

  while (true) {
    const { indexers } = await querySubgraph<{ indexers: IndexerSummary[] }>(`{
      indexers(
        first: 100
        skip: ${skip}
        orderBy: delegatedTokens
        orderDirection: desc
        where: { allocationCount_gt: 0, delegatedTokens_gt: "0" }
      ) {
        id
        delegatedTokens
        stakedTokens
        allocatedTokens
        indexingRewardCut
        allocationCount
        allocations(first: 1000, orderBy: allocatedTokens, orderDirection: desc, where: {status: Active}) {
          allocatedTokens
          subgraphDeployment {
            id
            stakedTokens
            signalledTokens
            deniedAt
          }
        }
      }
    }`);

    allIndexers.push(...indexers);
    if (indexers.length < 100) break;
    skip += 100;
    if (skip >= 500) break;
  }

  return allIndexers;
}

// Bulk fetch ALL closed allocations in the last 90 days across all indexers
// Returns only the fields needed for APY calculation
export async function fetchAllClosedAllocations(
  sinceTimestamp: number
): Promise<AllocationSummary[]> {
  const all: AllocationSummary[] = [];
  let lastId = "";

  while (true) {
    const { allocations } = await querySubgraph<{
      allocations: AllocationSummary[];
    }>(`{
      allocations(
        where: {
          status: Closed
          closedAt_gte: ${sinceTimestamp}
          id_gt: "${lastId}"
        }
        orderBy: id
        orderDirection: asc
        first: 1000
      ) {
        id
        indexer { id }
        indexingDelegatorRewards
        closedAt
      }
    }`);

    all.push(...allocations);
    if (allocations.length < 1000) break;
    lastId = allocations[allocations.length - 1].id;
  }

  return all;
}

export async function fetchIndexer(address: string): Promise<IndexerData | null> {
  const { indexer } = await querySubgraph<{ indexer: IndexerData | null }>(`{
    indexer(id: "${address.toLowerCase()}") {
      id
      stakedTokens
      delegatedTokens
      allocatedTokens
      rewardsEarned
      indexerIndexingRewards
      delegatorIndexingRewards
      indexingRewardCut
      queryFeeCut
      delegationExchangeRate
      allocationCount
      totalAllocationCount
    }
  }`);
  return indexer;
}

export interface NetworkData {
  totalTokensAllocated: string;
  totalDelegatedTokens: string;
  totalTokensSignalled: string;
  networkGRTIssuancePerBlock: string;
  totalSupply: string;
  delegationRatio: number;
}

export async function fetchNetworkData(): Promise<NetworkData> {
  const { graphNetwork } = await querySubgraph<{ graphNetwork: NetworkData }>(`{
    graphNetwork(id: "1") {
      totalTokensAllocated
      totalDelegatedTokens
      totalTokensSignalled
      networkGRTIssuancePerBlock
      totalSupply
      delegationRatio
    }
  }`);
  return graphNetwork;
}

export async function fetchClosedAllocations(
  indexerAddress: string,
  sinceTimestamp: number
): Promise<AllocationData[]> {
  const allAllocations: AllocationData[] = [];
  let lastId = "";

  while (true) {
    const { allocations } = await querySubgraph<{ allocations: AllocationData[] }>(`{
      allocations(
        where: {
          indexer: "${indexerAddress.toLowerCase()}"
          status: Closed
          closedAt_gte: ${sinceTimestamp}
          id_gt: "${lastId}"
        }
        orderBy: id
        orderDirection: asc
        first: 1000
      ) {
        id
        allocatedTokens
        indexingRewards
        indexingIndexerRewards
        indexingDelegatorRewards
        createdAt
        closedAt
        indexingRewardCutAtClose
        subgraphDeployment { id }
      }
    }`);

    allAllocations.push(...allocations);
    if (allocations.length < 1000) break;
    lastId = allocations[allocations.length - 1].id;
  }

  return allAllocations;
}
