import { useState, useEffect, useMemo } from "react";
import { fetchIndexerList, type IndexerSummary } from "../utils/subgraph";
import { resolveEnsNames } from "../utils/ens";
import { weiToGrt, formatGrt, ppmToPercent, formatPct } from "../utils/calculations";

interface Props {
  onSelect: (address: string) => void;
  selectedId: string | null;
}

export function IndexerList({ onSelect, selectedId }: Props) {
  const [indexers, setIndexers] = useState<IndexerSummary[]>([]);
  const [ensNames, setEnsNames] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [ensLoading, setEnsLoading] = useState(false);
  const [sortBy, setSortBy] = useState<"delegated" | "cut" | "alloc">("delegated");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchIndexerList()
      .then((list) => {
        setIndexers(list);
        setListLoading(false);
        setEnsLoading(true);
        resolveEnsNames(list.map((i) => i.id))
          .then((names) => {
            setEnsNames(names);
            setEnsLoading(false);
          })
          .catch(() => setEnsLoading(false));
      })
      .catch(() => setListLoading(false));
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
      }
      return sortDir === "desc" ? -diff : diff;
    });
  }, [indexers, ensNames, search, sortBy, sortDir]);

  const handleSort = (col: "delegated" | "cut" | "alloc") => {
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
                Reward Cut{sortIcon("cut")}
              </th>
              <th className="list-th-sortable" onClick={() => handleSort("alloc")}>
                Allocations{sortIcon("alloc")}
              </th>
              <th className="list-th-action"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((indexer, i) => {
              const name = ensNames.get(indexer.id.toLowerCase());
              const delegated = weiToGrt(indexer.delegatedTokens);
              const cut = ppmToPercent(indexer.indexingRewardCut);
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
                  <td className="list-td-num">{formatGrt(delegated)} GRT</td>
                  <td className="list-td-num">
                    <span className={cut >= 100 ? "cut-high" : cut >= 50 ? "cut-med" : "cut-low"}>
                      {formatPct(cut)}
                    </span>
                  </td>
                  <td className="list-td-num">{indexer.allocationCount}</td>
                  <td className="list-td-action">
                    <span className="list-arrow">&#8250;</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
