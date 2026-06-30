'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { fmtUsd, fmtAge } from '@/components/utils';

const SORT_OPTIONS = [
  { label: 'Volume 24h', metric: 'volume', window: '24h' },
  { label: 'TVL', metric: 'tvl', window: '' },
  { label: 'Fee / TVL 24h', metric: 'fee_tvl', window: '24h' },
  { label: 'APR (24h)', metric: 'apr', window: '24h' },
  { label: 'Fees 24h', metric: 'fees', window: '24h' },
  { label: 'Newest', metric: 'created_at', window: '' },
];

const TVL_PRESETS = [
  { label: 'Any TVL', value: 0 },
  { label: '≥ $10k', value: 10000 },
  { label: '≥ $50k', value: 50000 },
  { label: '≥ $250k', value: 250000 },
  { label: '≥ $1M', value: 1000000 },
];

const PAGE_SIZE = 50;

function ftvlColor(v) {
  if (v == null) return 'var(--text-muted)';
  if (v >= 20) return 'var(--orange)'; // very high — often risky/short-lived
  if (v >= 2) return 'var(--green)';
  if (v >= 0.5) return '#86efac';
  return 'var(--text-muted)';
}

export default function DiscoverPage() {
  const router = useRouter();
  const [sortIdx, setSortIdx] = useState(0);
  const [minTvl, setMinTvl] = useState(50000);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback(async () => {
    const sort = SORT_OPTIONS[sortIdx];
    const params = new URLSearchParams({
      metric: sort.metric,
      order: 'desc',
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    if (sort.window) params.set('window', sort.window);
    if (minTvl > 0) params.set('min_tvl', String(minTvl));
    if (query.trim()) params.set('q', query.trim());

    setLoading(true);
    try {
      const res = await fetch('/api/discover?' + params.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to load pools');
      setData(json);
      setError(null);
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [sortIdx, minTvl, query, page]);

  // Debounce search; immediate for other controls.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, query ? 350 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [load, query]);

  // Filter/sort/search changes reset to page 1 (handled here, not in an effect).
  const changeSort = (v) => { setSortIdx(v); setPage(1); };
  const changeMinTvl = (v) => { setMinTvl(v); setPage(1); };
  const changeQuery = (v) => { setQuery(v); setPage(1); };

  const pools = data?.pools ?? [];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Discover Pools</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Scan all Meteora DLMM pools — rank by volume, fee/TVL, APR & more. Click a pool for the full analyzer.
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          className="input"
          placeholder="Search name / token / address…"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          spellCheck={false}
          style={{ flex: '1 1 220px', maxWidth: 320 }}
        />
        <Segmented
          options={SORT_OPTIONS.map((o, i) => ({ label: o.label, value: i }))}
          value={sortIdx}
          onChange={changeSort}
        />
        <select
          className="input"
          value={minTvl}
          onChange={(e) => changeMinTvl(Number(e.target.value))}
          style={{ width: 'auto', cursor: 'pointer' }}
        >
          {TVL_PRESETS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,17,23,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontSize: 14, color: 'var(--text-muted)' }}>
            ⏳ Loading…
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr className="table-header">
                <Th label="#" />
                <Th label="Pool" />
                <Th label="TVL" right />
                <Th label="Vol 24h" right />
                <Th label="Fees 24h" right />
                <Th label="Fee/TVL 24h" right />
                <Th label="APR" right />
                <Th label="Age" right />
                <Th label="" />
              </tr>
            </thead>
            <tbody>
              {pools.map((p, i) => (
                <tr
                  key={p.address}
                  onClick={() => router.push('/pool/' + p.address)}
                  className="transition-all"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)')}
                >
                  <td className="py-3 px-3 tabular-nums text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(page - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold" style={{ color: 'var(--text)' }}>{p.name}</span>
                      {p.bin_step != null && (
                        <span className="badge badge-purple text-xs">{p.bin_step}bps</span>
                      )}
                      {!(p.token_x_verified && p.token_y_verified) && (
                        <span className="badge badge-yellow text-xs" title="A token in this pair is unverified">⚠ unverified</span>
                      )}
                      {p.has_farm && <span className="badge badge-green text-xs">🌾 farm</span>}
                    </div>
                    <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                      {p.address.slice(0, 6)}…{p.address.slice(-4)}
                    </div>
                  </td>
                  <Td>{fmtUsd(p.tvl_usd, 0)}</Td>
                  <Td>{fmtUsd(p.volume_24h_usd, 0)}</Td>
                  <Td>{fmtUsd(p.fees_24h_usd, 0)}</Td>
                  <Td color={ftvlColor(p.fee_tvl_24h_pct)} bold>
                    {p.fee_tvl_24h_pct != null ? p.fee_tvl_24h_pct + '%' : '—'}
                  </Td>
                  <Td color={ftvlColor(p.fee_tvl_24h_pct)}>
                    {p.apr_pct != null ? p.apr_pct.toLocaleString() + '%' : '—'}
                  </Td>
                  <Td muted>{fmtAge(p.age_hours)}</Td>
                  <td className="py-3 px-3" style={{ color: 'var(--accent-light)' }}>→</td>
                </tr>
              ))}
              {!loading && pools.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    No pools match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {total.toLocaleString()} pools · page {data?.page ?? page} of {totalPages.toLocaleString()}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ fontSize: 13, opacity: page <= 1 || loading ? 0.5 : 1 }}
          >
            ← Prev
          </button>
          <button
            className="btn btn-secondary"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            style={{ fontSize: 13, opacity: page >= totalPages || loading ? 0.5 : 1 }}
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--accent-dim)' : 'transparent',
              color: active ? 'var(--accent-light)' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Th({ label, right }) {
  return (
    <th
      className="py-2 px-3 text-xs font-semibold select-none"
      style={{ color: 'var(--text-muted)', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap' }}
    >
      {label}
    </th>
  );
}

function Td({ children, color, muted, bold }) {
  return (
    <td
      className={'py-3 px-3 tabular-nums' + (bold ? ' font-semibold' : '')}
      style={{ textAlign: 'right', color: color ?? (muted ? 'var(--text-muted)' : 'var(--text)'), whiteSpace: 'nowrap' }}
    >
      {children}
    </td>
  );
}
