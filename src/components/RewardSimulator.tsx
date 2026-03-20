import { useState, useEffect, useMemo } from "react";
import {
  weiToGrt,
  formatGrt,
  formatPct,
  ppmToPercent,
  type IndexerApyData,
} from "../utils/calculations";
import { getCached, setCache } from "../utils/cache";
import type { IndexerSummary } from "../utils/subgraph";

type Period = "30" | "60" | "90";

interface SimResult {
  indexer: IndexerSummary;
  name: string;
  delegated: number;
  cut: number;
  rewards: number;
  rewardRate: number;
  userRewards: number;
  apy: number;
  estApy: number;
  allocsClosed: number;
}

interface CachedData {
  indexers: IndexerSummary[];
  apyData: Record<string, IndexerApyData>;
  ensNames: Record<string, string>;
}

export function RewardSimulator() {
  const [indexers, setIndexers] = useState<IndexerSummary[]>([]);
  const [apyData, setApyData] = useState<Map<string, IndexerApyData>>(new Map());
  const [ensNames, setEnsNames] = useState<Map<string, string>>(new Map());
  const [dataLoading, setDataLoading] = useState(true);

  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<Period>("90");
  const [showTop, setShowTop] = useState(20);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Try localStorage cache first
      const cached = getCached<CachedData>("indexer_list");
      if (cached) {
        setIndexers(cached.indexers);
        setApyData(new Map(Object.entries(cached.apyData)));
        setEnsNames(new Map(Object.entries(cached.ensNames)));
        setDataLoading(false);
        return;
      }

      // Try static data.json
      try {
        const res = await fetch("/data.json");
        if (!res.ok) throw new Error("No data.json");
        const payload = await res.json();
        if (cancelled) return;
        if (payload.indexers && payload.apyData) {
          setIndexers(payload.indexers);
          setApyData(new Map(Object.entries(payload.apyData)));
          setEnsNames(new Map(Object.entries(payload.ensNames || {})));
          // Cache it
          setCache("indexer_list", {
            indexers: payload.indexers,
            apyData: payload.apyData,
            ensNames: payload.ensNames || {},
          });
        }
      } catch {
        // Data not available
      }
      if (!cancelled) setDataLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  const grtAmount = parseFloat(amount) || 0;
  const days = parseInt(period);

  const results = useMemo(() => {
    if (grtAmount <= 0) return [];

    return indexers
      .map((indexer) => {
        const id = indexer.id.toLowerCase();
        const apy = apyData.get(id);
        if (!apy) return null;

        const delegated = weiToGrt(indexer.delegatedTokens);
        if (delegated <= 0) return null;

        const rewards = period === "30" ? apy.rewards30 : period === "60" ? apy.rewards60 : apy.rewards90;
        const allocsClosed = period === "30" ? apy.allocs30 : period === "60" ? apy.allocs60 : apy.allocs90;
        const apyVal = period === "30" ? apy.apy30 : period === "60" ? apy.apy60 : apy.apy90;

        if (rewards <= 0) return null;

        const rewardRate = rewards / delegated;
        const userRewards = grtAmount * rewardRate;

        return {
          indexer,
          name: ensNames.get(id) || `${indexer.id.slice(0, 8)}...${indexer.id.slice(-6)}`,
          delegated,
          cut: ppmToPercent(indexer.indexingRewardCut),
          rewards,
          rewardRate,
          userRewards,
          apy: apyVal,
          estApy: apy.estApy,
          allocsClosed,
        };
      })
      .filter((x): x is SimResult => x !== null)
      .sort((a, b) => b.userRewards - a.userRewards);
  }, [indexers, apyData, ensNames, grtAmount, period]);

  const displayResults = results.slice(0, showTop);

  if (dataLoading) {
    return (
      <div className="simulator-section">
        <div className="loading">
          <span className="spinner large" />
          <span>Loading indexer data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="simulator-section">
      <div className="simulator-header">
        <h2 className="simulator-title">Reward Simulator</h2>
        <p className="simulator-subtitle">
          See what you would have earned based on actual closed allocations
        </p>
      </div>

      <div className="simulator-disclaimer">
        Past performance is not a guarantee of future results. Actual returns depend on
        future allocations, network conditions, signal distribution, and indexer behavior.
        This is a historical "what-if" based on real on-chain data.
      </div>

      <div className="simulator-inputs">
        <div className="simulator-input-group">
          <label className="simulator-label">Delegation Amount (GRT)</label>
          <div className="simulator-input-wrapper">
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, "");
                setAmount(v);
              }}
              placeholder="e.g. 100,000"
              className="simulator-input"
            />
            <span className="simulator-input-suffix">GRT</span>
          </div>
          <div className="simulator-presets">
            {[10000, 50000, 100000, 500000, 1000000].map((v) => (
              <button
                key={v}
                className="simulator-preset"
                onClick={() => setAmount(String(v))}
              >
                {formatGrt(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="simulator-input-group">
          <label className="simulator-label">Time Period</label>
          <div className="simulator-period-btns">
            {(["30", "60", "90"] as Period[]).map((p) => (
              <button
                key={p}
                className={`simulator-period-btn ${period === p ? "active" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p} days
              </button>
            ))}
          </div>
        </div>
      </div>

      {grtAmount > 0 && results.length > 0 && (
        <>
          <div className="simulator-summary">
            <div className="simulator-summary-item">
              <span className="simulator-summary-label">Your Delegation</span>
              <span className="simulator-summary-value">{formatGrt(grtAmount)} GRT</span>
            </div>
            <div className="simulator-summary-item">
              <span className="simulator-summary-label">Best Return ({days}d)</span>
              <span className="simulator-summary-value reward-highlight">
                +{formatGrt(results[0].userRewards)} GRT
              </span>
            </div>
            <div className="simulator-summary-item">
              <span className="simulator-summary-label">Median Return ({days}d)</span>
              <span className="simulator-summary-value">
                +{formatGrt(results[Math.floor(results.length / 2)]?.userRewards || 0)} GRT
              </span>
            </div>
          </div>

          <div className="simulator-table-wrapper">
            <table className="simulator-table">
              <thead>
                <tr>
                  <th className="sim-th-rank">#</th>
                  <th>Indexer</th>
                  <th className="sim-th-right">Cut</th>
                  <th className="sim-th-right">Delegated</th>
                  <th className="sim-th-right">Pool Rewards ({days}d)</th>
                  <th className="sim-th-right">Your Rewards</th>
                  <th className="sim-th-right">{days}d APY</th>
                  <th className="sim-th-right hide-mobile">Est. APR</th>
                  <th className="sim-th-right hide-mobile">Allocs</th>
                </tr>
              </thead>
              <tbody>
                {displayResults.map((r, i) => (
                  <tr key={r.indexer.id} className="sim-row">
                    <td className="sim-td-rank">{i + 1}</td>
                    <td className="sim-td-name">
                      <span className="sim-name">{r.name}</span>
                    </td>
                    <td className="sim-td-right">
                      <span className={r.cut >= 100 ? "cut-high" : r.cut >= 50 ? "cut-med" : "cut-low"}>
                        {formatPct(r.cut)}
                      </span>
                    </td>
                    <td className="sim-td-right">{formatGrt(r.delegated)}</td>
                    <td className="sim-td-right">{formatGrt(r.rewards)}</td>
                    <td className="sim-td-right sim-td-reward">
                      +{r.userRewards.toFixed(2)} GRT
                    </td>
                    <td className="sim-td-right sim-td-apy">{formatPct(r.apy)}</td>
                    <td className="sim-td-right hide-mobile sim-td-est">{formatPct(r.estApy)}</td>
                    <td className="sim-td-right hide-mobile">{r.allocsClosed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {results.length > showTop && (
            <button
              className="simulator-show-more"
              onClick={() => setShowTop((n) => n + 20)}
            >
              Show more ({results.length - showTop} remaining)
            </button>
          )}
        </>
      )}

      {grtAmount > 0 && results.length === 0 && (
        <div className="simulator-empty">
          No indexers with rewards data for this period.
        </div>
      )}
    </div>
  );
}
