import { useState } from "react";
import type { WindowStats } from "../utils/calculations";
import { weiToGrt, formatGrt, ppmToPercent, formatPct } from "../utils/calculations";

interface Props {
  windows: WindowStats[];
}

export function AllocationsList({ windows }: Props) {
  const [selectedWindow, setSelectedWindow] = useState(0);
  const window = windows[selectedWindow];

  const sorted = [...window.allocations].sort(
    (a, b) => b.closedAt - a.closedAt
  );

  return (
    <div className="allocations-section">
      <h2>Closed Allocations</h2>
      <div className="window-tabs">
        {windows.map((w, i) => (
          <button
            key={w.label}
            className={i === selectedWindow ? "active" : ""}
            onClick={() => setSelectedWindow(i)}
          >
            {w.label} ({w.allocationsClosed})
          </button>
        ))}
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
                      : "—"}
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
