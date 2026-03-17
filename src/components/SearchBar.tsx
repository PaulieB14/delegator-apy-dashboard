import { useState } from "react";

interface Props {
  onSearch: (address: string) => void;
  loading: boolean;
}

export function SearchBar({ onSearch, loading }: Props) {
  const [input, setInput] = useState(
    "0x0058223c6617cca7ce76fc929ec9724cd43d4542"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && /^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      onSearch(trimmed);
    }
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Enter indexer address (0x...)"
        disabled={loading}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Loading..." : "Analyze"}
      </button>
    </form>
  );
}
