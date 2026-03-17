import { useState, useEffect, useRef, useMemo } from "react";
import { fetchIndexerList, type IndexerSummary } from "../utils/subgraph";
import { resolveEnsNames } from "../utils/ens";
import { weiToGrt, formatGrt, ppmToPercent, formatPct } from "../utils/calculations";

interface Props {
  onSelect: (address: string) => void;
  loading: boolean;
}

export function IndexerSelector({ onSelect, loading }: Props) {
  const [indexers, setIndexers] = useState<IndexerSummary[]>([]);
  const [ensNames, setEnsNames] = useState<Map<string, string>>(new Map());
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [ensLoading, setEnsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchIndexerList()
      .then((list) => {
        setIndexers(list);
        setListLoading(false);
        // Resolve ENS names in background
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return indexers;
    const q = search.toLowerCase();
    return indexers.filter((i) => {
      const name = ensNames.get(i.id.toLowerCase()) || "";
      return i.id.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });
  }, [indexers, ensNames, search]);

  const handleSelect = (addr: string) => {
    const name = ensNames.get(addr.toLowerCase());
    setSearch(name || addr);
    setIsOpen(false);
    onSelect(addr);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = search.trim();
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setIsOpen(false);
      onSelect(trimmed);
    }
  };

  return (
    <div className="selector-container" ref={dropdownRef}>
      <form onSubmit={handleManualSubmit} className="selector-form">
        <div className="selector-input-wrapper">
          <svg className="selector-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={listLoading ? "Loading indexers..." : "Search by ENS name or address..."}
            disabled={loading || listLoading}
            className="selector-input"
          />
          {ensLoading && <span className="ens-badge">resolving ENS...</span>}
          <button type="submit" disabled={loading} className="selector-btn">
            {loading ? (
              <span className="spinner" />
            ) : (
              "Analyze"
            )}
          </button>
        </div>
      </form>

      {isOpen && filtered.length > 0 && (
        <div className="dropdown">
          <div className="dropdown-header">
            <span>{filtered.length} indexers with active allocations</span>
          </div>
          <div className="dropdown-list">
            {filtered.slice(0, 50).map((indexer) => {
              const name = ensNames.get(indexer.id.toLowerCase());
              const delegated = weiToGrt(indexer.delegatedTokens);
              const cut = ppmToPercent(indexer.indexingRewardCut);
              return (
                <button
                  key={indexer.id}
                  className="dropdown-item"
                  onClick={() => handleSelect(indexer.id)}
                >
                  <div className="dropdown-item-main">
                    <span className="dropdown-item-name">
                      {name || `${indexer.id.slice(0, 8)}...${indexer.id.slice(-6)}`}
                    </span>
                    {name && (
                      <span className="dropdown-item-addr">
                        {indexer.id.slice(0, 8)}...{indexer.id.slice(-4)}
                      </span>
                    )}
                  </div>
                  <div className="dropdown-item-stats">
                    <span className="dropdown-stat">
                      <span className="dropdown-stat-label">Delegated</span>
                      <span className="dropdown-stat-value">{formatGrt(delegated)}</span>
                    </span>
                    <span className="dropdown-stat">
                      <span className="dropdown-stat-label">Cut</span>
                      <span className="dropdown-stat-value">{formatPct(cut)}</span>
                    </span>
                    <span className="dropdown-stat">
                      <span className="dropdown-stat-label">Alloc</span>
                      <span className="dropdown-stat-value">{indexer.allocationCount}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
