import type { IndexerDashboard } from "../hooks/useIndexerData";
import { formatGrt, formatPct } from "../utils/calculations";

interface Props {
  data: IndexerDashboard;
}

export function IndexerOverview({ data }: Props) {
  return (
    <div className="overview-grid">
      <div className="stat-card">
        <span className="stat-label">Own Stake</span>
        <span className="stat-value">{formatGrt(data.stakedGrt)} GRT</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Delegated</span>
        <span className="stat-value">{formatGrt(data.delegatedGrt)} GRT</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Allocated</span>
        <span className="stat-value">{formatGrt(data.allocatedGrt)} GRT</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Reward Cut</span>
        <span className="stat-value">{formatPct(data.rewardCutPct)}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Active Allocations</span>
        <span className="stat-value">{data.indexer.allocationCount}</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Exchange Rate</span>
        <span className="stat-value">
          {Number(data.indexer.delegationExchangeRate).toFixed(4)}
        </span>
      </div>
    </div>
  );
}
