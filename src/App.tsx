import { IndexerSelector } from "./components/IndexerSelector";
import { IndexerOverview } from "./components/IndexerOverview";
import { ApyTable } from "./components/ApyTable";
import { AllocationsList } from "./components/AllocationsList";
import { useIndexerData } from "./hooks/useIndexerData";
import "./App.css";

function App() {
  const { data, loading, error, load } = useIndexerData();

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-mark">
          <img src="/graph-logo.jpg" alt="Graph Protocol" className="logo-img" />
        </div>
        <h1>Delegator APY</h1>
        <p className="header-subtitle">
          Real delegator returns from on-chain data
        </p>
        <div className="header-badge">Graph Network Arbitrum</div>
      </header>

      <IndexerSelector onSelect={load} loading={loading} />

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading">
          <span className="spinner large" />
          <span>Fetching on-chain reward data...</span>
        </div>
      )}

      {data && (
        <div className="results fade-in">
          <section className="indexer-header">
            <div className="indexer-name">
              {data.indexer.ensName || `${data.indexer.id.slice(0, 10)}...${data.indexer.id.slice(-8)}`}
            </div>
            <code className="indexer-address">{data.indexer.id}</code>
          </section>
          <IndexerOverview data={data} />
          <ApyTable windows={data.windows} delegatedGrt={data.delegatedGrt} />
          <AllocationsList windows={data.windows} />
          <footer className="app-footer">
            Data sourced from closed allocations on the Graph Network Arbitrum subgraph.
            Delegator rewards shown are post-cut (already reflect the indexer's reward cut).
          </footer>
        </div>
      )}
    </div>
  );
}

export default App;
