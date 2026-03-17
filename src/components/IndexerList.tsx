import { useState, useEffect, useMemo } from "react";
import {
  fetchIndexerList,
  fetchAllClosedAllocations,
  type IndexerSummary,
} from "../utils/subgraph";
import { resolveEnsNames } from "../utils/ens";
import {
  weiToGrt,
  formatGrt,
  ppmToPercent,
  formatPct,
  calculateBulkApy,
  type IndexerApyData,
} from "../utils/calculations";

interface Props {
  onSelect: (address: string) => void;
  selectedId: string | null;
}

type SortCol = "delegated" | "cut" | "alloc" | "apy30" | "apy60" | "apy90";

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

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        // Step 1: Load indexer list
        const list = await fetchIndexerList();
        if (cancelled) return;
        setIndexers(list);
        setListLoading(false);

        // Step 2: Load bulk allocations for APY (in parallel with ENS)
        setApyLoading(true);
        setEnsLoading(true);

        const now = Math.floor(Date.now() / 1000);
        const since90 = now - 90 * 86400;

        const delegatedMap = new Map<string, number>();
        for (const idx of list) {
          delegatedMap.set(idx.id.toLowerCase(), weiToGrt(idx.delegatedTokens));
        }

        const [allocs, names] = await Promise.all([
          fetchAllClosedAllocations(since90),
          resolveEnsNames(list.map((i) => i.id)),
        ]);

        if (cancelled) return;

        const apy = calculateBulkApy(allocs, delegatedMap, now);
        setApyData(apy);
        setApyLoading(false);

        setEnsNames(names);
        setEnsLoading(false);
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
        <span className="list-count">{filtered.length} indexers</span>
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
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("apy30")}>
                30d APY{sortIcon("apy30")}
              </th>
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("apy60")}>
                60d APY{sortIcon("apy60")}
              </th>
              <th className="list-th-sortable list-th-apy" onClick={() => handleSort("apy90")}>
                90d APY{sortIcon("apy90")}
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
        APY calculated from actual delegator rewards on closed allocations.
        Uses current delegation as denominator — may differ if delegation changed significantly during the period.
      </div>
    </div>
  );
}
