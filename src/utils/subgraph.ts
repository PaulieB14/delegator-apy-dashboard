const SUBGRAPH_ID = import.meta.env.VITE_SUBGRAPH_ID || "";
const API_KEY = import.meta.env.VITE_GRAPH_API_KEY || "";
const SUBGRAPH_URL = API_KEY
  ? `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${SUBGRAPH_ID}`
  : `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`;

export async function querySubgraph<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors.map((e: { message: string }) => e.message).join(", "));
  }
  return json.data as T;
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
