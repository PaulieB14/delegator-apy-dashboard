import type { WindowStats } from "../utils/calculations";
import { formatGrt, formatPct } from "../utils/calculations";

interface Props {
  windows: WindowStats[];
  delegatedGrt: number;
}

export function ApyTable({ windows, delegatedGrt }: Props) {
  return (
    <div className="apy-section">
      <h2>Delegator APY (Actual On-Chain Rewards)</h2>
      <p className="apy-subtitle">
        Based on closed allocations from the Graph Network Arbitrum subgraph.
        Rewards already reflect the indexer's reward cut.
      </p>
      <table className="apy-table">
        <thead>
          <tr>
            <th>Window</th>
            <th>Delegator APY</th>
            <th>Delegator Rewards</th>
            <th>Total Rewards</th>
            <th>Allocations Closed</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((w) => (
            <tr key={w.label}>
              <td>{w.label}</td>
              <td className="apy-value">{formatPct(w.delegatorApy)}</td>
              <td>{formatGrt(w.delegatorRewards)} GRT</td>
              <td>{formatGrt(w.totalRewards)} GRT</td>
              <td>{w.allocationsClosed}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="apy-breakdown">
        <h3>Reward Breakdown</h3>
        <table className="apy-table">
          <thead>
            <tr>
              <th>Window</th>
              <th>Delegator Share</th>
              <th>Indexer Share</th>
              <th>Delegator %</th>
              <th>Indexer %</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => {
              const delegatorPct =
                w.totalRewards > 0
                  ? (w.delegatorRewards / w.totalRewards) * 100
                  : 0;
              const indexerPct =
                w.totalRewards > 0
                  ? (w.indexerRewards / w.totalRewards) * 100
                  : 0;
              return (
                <tr key={w.label}>
                  <td>{w.label}</td>
                  <td>{formatGrt(w.delegatorRewards)} GRT</td>
                  <td>{formatGrt(w.indexerRewards)} GRT</td>
                  <td>{formatPct(delegatorPct)}</td>
                  <td>{formatPct(indexerPct)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="formula-note">
        <strong>Formula:</strong> Delegator APY = (Delegator Rewards /{" "}
        {formatGrt(delegatedGrt)} GRT) * (365 / days) * 100
      </div>
    </div>
  );
}
