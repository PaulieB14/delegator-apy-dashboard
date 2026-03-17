import { useState, useEffect, useMemo } from "react";
import {
  fetchIndexerList,
  fetchAllClosedAllocations,
  fetchNetworkData,
  type IndexerSummary,
} from "../utils/subgraph";
import { resolveEnsNames } from "../utils/ens";
import {
  weiToGrt,
  formatGrt,
  ppmToPercent,
  formatPct,
  calculateBulkApy,
  calculateEstimatedApy,
  type IndexerApyData,
} from "../utils/calculations";
import {
  getCached,
  setCache,
  getCacheAge,
  formatCacheAge,
  clearCache,
} from "../utils/cache";

interface CachedData {
  indexers: IndexerSummary[];
  apyData: Record<string, IndexerApyData>;
  ensNames: Record<string, string>;
}

interface Props {
  onSelect: (address: string) => void;
  selectedId: string | null;
}

type SortCol = "delegated" | "cut" | "alloc" | "apy30" | "apy60" | "apy90" | "est";

export function IndexerList({ onSelect, selectedId }: Props) {
  const [indexers, setIndexers] = useState<IndexerSummary[]>([]);
  const [ensNames, setEnsNames] = useState<Map<string, string>>(new Map());
  const [apyData, setApyData] = useState<Map<string, IndexerApyData>>(new Map());
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [apyLoading, setApyLoading] = useState(false);
  const [ensLoading, setEnsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<SortCol>("apy30");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [cacheAge, setCacheAge] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Check cache first
      const cached = getCached<CachedData>("indexer_list");
      if (cached) {
        setIndexers(cached.indexers);
        setApyData(new Map(Object.entries(cached.apyData)));
        setEnsNames(new Map(Object.entries(cached.ensNames)));
        setListLoading(false);
        setCacheAge(getCacheAge("indexer_list"));
        return;
      }

      try {
        // Step 1: Load indexer list
        const list = await fetchIndexerList();
        if (cancelled) return;
        setIndexers(list);
        setListLoading(false);

        // Step 2: Load bulk allocations + ENS + network data in parallel
        setApyLoading(true);
        setEnsLoading(true);

        const now = Math.floor(Date.now() / 1000);
        const since90 = now - 90 * 86400;

        const delegatedMap = new Map<string, number>();
        for (const idx of list) {
          delegatedMap.set(idx.id.toLowerCase(), weiToGrt(idx.delegatedTokens));
        }

        const [allocs, names, network] = await Promise.all([
          fetchAllClosedAllocations(since90),
          resolveEnsNames(list.map((i) => i.id)),
          fetchNetworkData(),
        ]);

        if (cancelled) return;

        // Calculate actual APY from allocations
        const apy = calculateBulkApy(allocs, delegatedMap, now);

        // Add estimated APY for each indexer
        for (const idx of list) {
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

        setApyData(apy);
        setApyLoading(false);
        setEnsNames(names);
        setEnsLoading(false);

        // Cache the result
        const cachePayload: CachedData = {
          indexers: list,
          apyData: Object.fromEntries(apy),
          ensNames: Object.fromEntries(names),
        };
        setCache("indexer_list", cachePayload);
        setCacheAge(0);
      } catch {
        if (!cancelled) {
          setListLoading(false);
          setApyLoading(false);
          setEnsLoading(false);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = () => {
    clearCache();
    setCacheAge(null);
    setListLoading(true);
    setApyLoading(false);
    setEnsLoading(false);
    setApyData(new Map());
    setEnsNames(new Map());
    // Re-trigger effect
    window.location.reload();
  };

  const filtered = useMemo(() => {
    let list = indexers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => {
        const name = ensNames.get(i.id.toLowerCase()) || "";
        return i.id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
      });
    }

    return [...list].sort((a, b) => {
      let diff = 0;
      const aApy = apyData.get(a.id.toLowerCase());
      const bApy = apyData.get(b.id.toLowerCase());

      switch (sortBy) {
        case "delegated":
          diff = Number(BigInt(a.delegatedTokens) - BigInt(b.delegatedTokens));
          break;
        case "cut":
          diff = a.indexingRewardCut - b.indexingRewardCut;
          break;
        case "alloc":
          diff = a.allocationCount - b.allocationCount;
          break;
        case "apy30":
          diff = (aApy?.apy30 || 0) - (bApy?.apy30 || 0);
          break;
        case "apy60":
          diff = (aApy?.apy60 || 0) - (bApy?.apy60 || 0);
          break;
        case "apy90":
          diff = (aApy?.apy90 || 0) - (bApy?.apy90 || 0);
          break;
        case "est":
          diff = (aApy?.estApy || 0) - (bApy?.estApy || 0);
          break;
      }
      return sortDir === "desc" ? -diff : diff;
    });
  }, [indexers, ensNames, apyData, search, sortBy, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sortIcon = (col: string) => {
    if (sortBy !== col) return "";
    return sortDir === "desc" ? " \u2193" : " \u2191";
  };

  if (listLoading) {
    return (
      <div className="list-loading">
        <span className="spinner large" />
        <span>Loading indexers...</span>
      </div>
    );
  }

  return (
    <div className="indexer-list-section">
      <div className="list-toolbar">
        <div className="list-search-wrapper">
          <svg className="selector-icon" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or address..."
            className="list-search"
          />
          {ensLoading && <span className="ens-badge">resolving ENS...</span>}
          {apyLoading && <span className="ens-badge apy-badge">calculating APY...</span>}
        </div>
        <div className="list-toolbar-right">
          {cacheAge !== null && (
            <span className="cache-info">
              {cacheAge === 0 ? "Just updated" : `Cached ${formatCacheAge(cacheAge)}`}
            </span>
          )}
          <button className="refresh-btn" onClick={handleRefresh} title="Force refresh data">
            &#8635;
          </button>
          <span className="list-count">{filtered.length} indexers</span>
        </div>
      </div>

      <div className="list-table-wrapper">
        <table className="list-table">
          <thead>
            <tr>
              <th className="list-th-rank">#</th>
              <th className="list-th-name">Indexer</th>
              <th className="list-th-sortable" onClick={() => handleSort("delegated")}>
                Delegated{sortIcon("delegated")}
              </th>
              <th className="list-th-sortable" onClick={() => handleSort("cut")}>
                Cut{sortIcon("cut")}
              </th>
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("est")}>
                Est. APY{sortIcon("est")}
              </th>
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("apy30")}>
                30d{sortIcon("apy30")}
              </th>
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("apy60")}>
                60d{sortIcon("apy60")}
              </th>
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("apy90")}>
                90d{sortIcon("apy90")}
              </th>
              <th className="list-th-sortable hide-mobile" onClick={() => handleSort("alloc")}>
                Alloc{sortIcon("alloc")}
              </th>
              <th className="list-th-action"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((indexer, i) => {
              const name = ensNames.get(indexer.id.toLowerCase());
              const delegated = weiToGrt(indexer.delegatedTokens);
              const cut = ppmToPercent(indexer.indexingRewardCut);
              const apy = apyData.get(indexer.id.toLowerCase());
              const isSelected = selectedId === indexer.id;

              return (
                <tr
                  key={indexer.id}
                  className={`list-row ${isSelected ? "list-row-selected" : ""}`}
                  onClick={() => onSelect(indexer.id)}
                >
                  <td className="list-td-rank">{i + 1}</td>
                  <td className="list-td-name">
                    <span className="list-name">
                      {name || `${indexer.id.slice(0, 8)}...${indexer.id.slice(-6)}`}
                    </span>
                    {name && (
                      <span className="list-addr">
                        {indexer.id.slice(0, 8)}...{indexer.id.slice(-4)}
                      </span>
                    )}
                  </td>
                  <td className="list-td-num">{formatGrt(delegated)}</td>
                  <td className="list-td-num">
                    <span className={cut >= 100 ? "cut-high" : cut >= 50 ? "cut-med" : "cut-low"}>
                      {formatPct(cut)}
                    </span>
                  </td>
                  <td className="list-td-apy">
                    {apyLoading ? (
                      <span className="apy-placeholder">...</span>
                    ) : apy ? (
                      <span className="apy-cell est">{formatPct(apy.estApy)}</span>
                    ) : (
                      <span className="apy-placeholder">-</span>
                    )}
                  </td>
                  <td className="list-td-apy">
                    {apyLoading ? (
                      <span className="apy-placeholder">...</span>
                    ) : apy ? (
                      <span className="apy-cell">{formatPct(apy.apy30)}</span>
                    ) : (
                      <span className="apy-placeholder">-</span>
                    )}
                  </td>
                  <td className="list-td-apy">
                    {apyLoading ? (
                      <span className="apy-placeholder">...</span>
                    ) : apy ? (
                      <span className="apy-cell">{formatPct(apy.apy60)}</span>
                    ) : (
                      <span className="apy-placeholder">-</span>
                    )}
                  </td>
                  <td className="list-td-apy">
                    {apyLoading ? (
                      <span className="apy-placeholder">...</span>
                    ) : apy ? (
                      <span className="apy-cell">{formatPct(apy.apy90)}</span>
                    ) : (
                      <span className="apy-placeholder">-</span>
                    )}
                  </td>
                  <td className="list-td-num hide-mobile">{indexer.allocationCount}</td>
                  <td className="list-td-action">
                    <span className="list-arrow">&#8250;</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="list-footer">
        <strong>Est. APY</strong> = projected from current network issuance &amp; allocation share.
        <strong>30/60/90d</strong> = actual delegator rewards from closed allocations.
        Data cached for 24h — click refresh to update.
      </div>
    </div>
  );
}
