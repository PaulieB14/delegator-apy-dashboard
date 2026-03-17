import { useState } from "react";
import { IndexerList } from "./components/IndexerList";
import { IndexerOverview } from "./components/IndexerOverview";
import { ApyTable } from "./components/ApyTable";
import { AllocationsList } from "./components/AllocationsList";
import { useIndexerData } from "./hooks/useIndexerData";
import "./App.css";

function App() {
  const { data, loading, error, load } = useIndexerData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "detail">("list");

  const handleSelect = (address: string) => {
    setSelectedId(address);
    setView("detail");
    load(address);
  };

  const handleBack = () => {
    setView("list");
    setSelectedId(null);
  };

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

      {view === "list" && (
        <IndexerList onSelect={handleSelect} selectedId={selectedId} />
      )}

      {view === "detail" && (
        <div className="detail-view fade-in">
          <button className="back-btn" onClick={handleBack}>
            <span className="back-arrow">&#8249;</span>
            Back to indexers
          </button>

          {error && <div className="error">{error}</div>}

          {loading && (
            <div className="loading">
              <span className="spinner large" />
              <span>Fetching on-chain reward data...</span>
            </div>
          )}

          {data && (
            <>
              <section className="indexer-header">
                <div className="indexer-name">
                  {data.indexer.ensName || `${data.indexer.id.slice(0, 10)}...${data.indexer.id.slice(-8)}`}
                </div>
                <code className="indexer-address">{data.indexer.id}</code>
              </section>
              <IndexerOverview data={data} />
              <ApyTable windows={data.windows} delegatedGrt={data.delegatedGrt} />
              <AllocationsList indexerAddress={data.indexer.id} />
              <footer className="app-footer">
                Data sourced from closed allocations on the Graph Network Arbitrum subgraph.
                Delegator rewards are post-cut. APY uses current delegation as denominator —
                if delegation changed significantly, actual returns per delegator may vary.
              </footer>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
