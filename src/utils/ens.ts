const ENS_SUBGRAPH_ID = "5XqPmWe6gjyrJtFn9cLy237i4cWw2j9HcUJEXsP5qGtH";
const API_KEY = import.meta.env.VITE_GRAPH_API_KEY || "";
const ENS_URL = API_KEY
  ? `https://gateway.thegraph.com/api/${API_KEY}/subgraphs/id/${ENS_SUBGRAPH_ID}`
  : `https://gateway.thegraph.com/api/subgraphs/id/${ENS_SUBGRAPH_ID}`;

interface EnsDomain {
  name: string;
  resolvedAddress: { id: string };
}

export async function resolveEnsNames(
  addresses: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (addresses.length === 0) return results;

  // Batch in groups of 50 (subgraph handles _in queries well)
  const batchSize = 50;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const addrList = batch.map((a) => `"${a.toLowerCase()}"`).join(", ");

    try {
      const res = await fetch(ENS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `{
            domains(
              where: { resolvedAddress_in: [${addrList}] }
              first: 1000
            ) {
              name
              resolvedAddress { id }
            }
          }`,
        }),
      });
      const json = await res.json();
      const domains: EnsDomain[] = json.data?.domains || [];

      for (const domain of domains) {
        const addr = domain.resolvedAddress.id.toLowerCase();
        const existing = results.get(addr);
        // Prefer shorter .eth names (more likely to be the primary)
        if (
          !existing ||
          (domain.name.endsWith(".eth") &&
            domain.name.split(".").length === 2 &&
            domain.name.length < existing.length)
        ) {
          results.set(addr, domain.name);
        }
      }
    } catch {
      // Skip failed batch
    }
  }

  return results;
}
