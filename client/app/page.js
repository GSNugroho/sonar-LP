'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PoolCard from '@/components/PoolCard';

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [recentSearches, setRecentSearches] = useState(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('sonar_recent') ?? '[]'); } catch { return []; }
  });

  const isAddress = (q) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.trim());

  async function handleSearch(e) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    if (!isAddress(q)) {
      setError('Please enter a valid Solana address (base58, 32-44 chars).');
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/pool/' + q);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      setResult({ address: q, data });

      const updated = [q, ...recentSearches.filter((a) => a !== q)].slice(0, 8);
      setRecentSearches(updated);
      localStorage.setItem('sonar_recent', JSON.stringify(updated));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function clearRecent() {
    setRecentSearches([]);
    localStorage.removeItem('sonar_recent');
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 52, color: 'var(--accent)', marginBottom: 12 }}>◆</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Sonar LP Intelligence
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 8, fontSize: 15 }}>
          Analyze Meteora DLMM pools, research LPers, and monitor your watchlist.
        </p>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="input"
          placeholder="Enter Meteora DLMM pool address (base58)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          spellCheck={false}
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="btn btn-primary"
          style={{ flexShrink: 0, padding: '10px 24px', opacity: loading || !query.trim() ? 0.6 : 1 }}
        >
          {loading ? '⏳' : '→ Analyze'}
        </button>
      </form>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {result && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Result
          </div>
          <PoolCard address={result.address} data={result.data} />
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => router.push('/pool/' + result.address)} className="btn btn-primary">
              Open Full Analyzer →
            </button>
          </div>
        </div>
      )}

      {recentSearches.length > 0 && !result && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Recent Searches</div>
            <button onClick={clearRecent} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {recentSearches.map((addr) => (
              <button
                key={addr}
                onClick={() => setQuery(addr)}
                style={{ textAlign: 'left', padding: '10px 14px', borderRadius: 8, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'monospace', fontSize: 13 }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                {addr}
              </button>
            ))}
          </div>
        </div>
      )}

      {!result && recentSearches.length === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 32 }}>
          {[
            { icon: '📊', title: 'Pool Analyzer', desc: 'Composite score, fee/TVL, entry timing, yield projection' },
            { icon: '👥', title: 'LP Profiler', desc: "Track any wallet's positions, PnL, fees earned, win rate" },
            { icon: '📋', title: 'Watchlist', desc: 'Monitor saved wallets with live refresh & browser alerts' },
          ].map((f) => (
            <div key={f.title} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{f.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
