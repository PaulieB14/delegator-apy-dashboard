import { SearchBar } from "./components/SearchBar";
import { IndexerOverview } from "./components/IndexerOverview";
import { ApyTable } from "./components/ApyTable";
import { AllocationsList } from "./components/AllocationsList";
import { useIndexerData } from "./hooks/useIndexerData";
import "./App.css";

function App() {
  const { data, loading, error, load } = useIndexerData();

  return (
    <div className="app">
      <header>
        <h1>Graph Delegator APY</h1>
        <p className="header-subtitle">
          Actual delegator returns from on-chain reward data — Graph Network
          Arbitrum
        </p>
      </header>

      <SearchBar onSearch={load} loading={loading} />

      {error && <div className="error">{error}</div>}

      {loading && (
        <div className="loading">
          Fetching on-chain data from Graph Network...
        </div>
      )}

      {data && (
        <>
          <section className="indexer-header">
            <code className="indexer-address">{data.indexer.id}</code>
          </section>
          <IndexerOverview data={data} />
          <ApyTable windows={data.windows} delegatedGrt={data.delegatedGrt} />
          <AllocationsList windows={data.windows} />
        </>
      )}
    </div>
  );
}

export default App;
