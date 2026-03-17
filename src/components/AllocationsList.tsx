import { useState, useCallback } from "react";
import { fetchClosedAllocations, type AllocationData } from "../utils/subgraph";
import { weiToGrt, formatGrt, ppmToPercent, formatPct } from "../utils/calculations";

interface Props {
  indexerAddress: string;
}

export function AllocationsList({ indexerAddress }: Props) {
  const [allocations, setAllocations] = useState<AllocationData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedWindow, setSelectedWindow] = useState(0);

  const windows = [
    { label: "30 Day", days: 30 },
    { label: "60 Day", days: 60 },
    { label: "90 Day", days: 90 },
  ];

  const loadAllocations = useCallback(async () => {
    setLoading(true);
    setExpanded(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const since = now - 90 * 86400;
      const allocs = await fetchClosedAllocations(indexerAddress, since);
      setAllocations(allocs);
    } catch {
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, [indexerAddress]);

  if (!expanded) {
    return (
      <div className="allocations-section">
        <button className="expand-allocs-btn" onClick={loadAllocations}>
          <span className="expand-icon">&#9662;</span>
          View Closed Allocations
          <span className="expand-hint">Loads detailed per-allocation data</span>
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="allocations-section">
        <div className="loading" style={{ padding: "32px" }}>
          <span className="spinner" />
          <span>Loading allocations...</span>
        </div>
      </div>
    );
  }

  if (!allocations || allocations.length === 0) {
    return (
      <div className="allocations-section">
        <h2>Closed Allocations</h2>
        <p style={{ color: "var(--text-muted)", padding: "16px 0" }}>
          No closed allocations found in the last 90 days.
        </p>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const currentWindow = windows[selectedWindow];
  const cutoff = now - currentWindow.days * 86400;
  const filtered = allocations.filter((a) => a.closedAt >= cutoff);
  const sorted = [...filtered].sort((a, b) => b.closedAt - a.closedAt);

  return (
    <div className="allocations-section">
      <h2>Closed Allocations</h2>
      <div className="window-tabs">
        {windows.map((w, i) => {
          const count = allocations.filter(
            (a) => a.closedAt >= now - w.days * 86400
          ).length;
          return (
            <button
              key={w.label}
              className={i === selectedWindow ? "active" : ""}
              onClick={() => setSelectedWindow(i)}
            >
              {w.label} ({count})
            </button>
          );
        })}
      </div>
      <div className="allocations-table-wrapper">
        <table className="apy-table allocations-table">
          <thead>
            <tr>
              <th>Closed</th>
              <th>Duration</th>
              <th>Allocated</th>
              <th>Total Rewards</th>
              <th>Delegator Rewards</th>
              <th>Cut at Close</th>
              <th>Deployment</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const duration = Math.round(
                (a.closedAt - a.createdAt) / 86400
              );
              return (
                <tr key={a.id}>
                  <td>{new Date(a.closedAt * 1000).toLocaleDateString()}</td>
                  <td>{duration}d</td>
                  <td>{formatGrt(weiToGrt(a.allocatedTokens))} GRT</td>
                  <td>{formatGrt(weiToGrt(a.indexingRewards))} GRT</td>
                  <td>{formatGrt(weiToGrt(a.indexingDelegatorRewards))} GRT</td>
                  <td>
                    {a.indexingRewardCutAtClose != null
                      ? formatPct(ppmToPercent(a.indexingRewardCutAtClose))
                      : "\u2014"}
                  </td>
                  <td className="deployment-id">
                    {a.subgraphDeployment.id.slice(0, 10)}...
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
