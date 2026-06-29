'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import PositionCard from '@/components/PositionCard';
import { fmtUsd, fmtAddr, fmtAge, pnlClass, scoreColor } from '@/components/utils';

export default function WalletPage({ params }) {
  const { address } = use(params);
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [labelInput, setLabelInput] = useState('');
  const [notesInput, setNotesInput] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [sortMode, setSortMode] = useState('pnl');

  useEffect(() => {
    setLoading(true);
    fetch('/api/wallet/' + address + '/positions')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address]);

  async function saveToWatchlist() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, label: labelInput || fmtAddr(address), notes: notesInput }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save');
      setSaved(true);
      setShowSaveForm(false);
      setSaveMsg('✅ Saved to watchlist!');
    } catch (e) {
      setSaveMsg('⚠️ ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error) return <PageError error={error} address={address} />;

  const { positions = [], summary = {}, sol_balance } = data ?? {};

  const sortedPositions = [...positions].sort((a, b) => {
    if (sortMode === 'pnl') return (b.real_pnl_usd ?? -Infinity) - (a.real_pnl_usd ?? -Infinity);
    if (sortMode === 'fees') return (b.fees_earned_usd ?? 0) - (a.fees_earned_usd ?? 0);
    if (sortMode === 'age') return (b.age_hours ?? 0) - (a.age_hours ?? 0);
    if (sortMode === 'value') return (b.current_usd ?? 0) - (a.current_usd ?? 0);
    return 0;
  });

  // Chart data (top 10 by abs pnl)
  const chartData = [...positions]
    .filter((p) => p.real_pnl_usd != null)
    .sort((a, b) => Math.abs(b.real_pnl_usd) - Math.abs(a.real_pnl_usd))
    .slice(0, 10)
    .map((p, i) => ({
      name: p.pool_name ? p.pool_name.slice(0, 10) : `Pos ${i + 1}`,
      pnl: p.real_pnl_usd,
    }));

  const winRate = summary.win_rate;
  const netPnl = summary.net_pnl_usd;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 16px' }}>
      {/* Back */}
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom: 20, fontSize: 13 }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>LP Profiler</h1>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{address}</div>
          {sol_balance != null && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              SOL balance: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{sol_balance.toFixed(4)} SOL</span>
            </div>
          )}
        </div>
        <div>
          {!saved && !showSaveForm && (
            <button onClick={() => setShowSaveForm(true)} className="btn btn-primary" style={{ fontSize: 13 }}>
              + Save to Watchlist
            </button>
          )}
          {saved && (
            <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>✅ In Watchlist</span>
          )}
        </div>
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div className="card" style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Save to Watchlist</div>
          <input className="input" placeholder="Label (e.g. 'Whale A')" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} />
          <input className="input" placeholder="Notes (optional)" value={notesInput} onChange={(e) => setNotesInput(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveToWatchlist} disabled={saving} className="btn btn-primary" style={{ fontSize: 13 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowSaveForm(false)} className="btn btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
          </div>
        </div>
      )}

      {saveMsg && (
        <div style={{ fontSize: 13, color: saveMsg.startsWith('✅') ? 'var(--green)' : 'var(--red)', marginBottom: 16 }}>
          {saveMsg}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Positions', value: summary.total_positions ?? '—' },
          {
            label: 'Net PnL',
            value: netPnl != null ? fmtUsd(netPnl) : '—',
            color: netPnl != null ? (netPnl >= 0 ? 'var(--green)' : 'var(--red)') : undefined,
          },
          { label: 'Total Fees', value: fmtUsd(summary.total_fees_usd), color: '#86efac' },
          {
            label: 'Win Rate',
            value: winRate != null ? winRate.toFixed(0) + '%' : '—',
            color: winRate != null ? scoreColor(winRate) : undefined,
          },
          { label: 'Avg Hold', value: fmtAge(summary.avg_hold_hours) },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* PnL Bar Chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>
            PnL per Position (top {chartData.length})
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barCategoryGap="20%">
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => '$' + v.toFixed(0)} width={55} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-muted)' }}
                formatter={(v) => [fmtUsd(v), 'PnL']}
              />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pnl >= 0 ? 'var(--green)' : 'var(--red)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sort controls */}
      {positions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>Sort:</span>
          {['pnl', 'fees', 'age', 'value'].map((m) => (
            <button
              key={m}
              onClick={() => setSortMode(m)}
              className="btn"
              style={{
                fontSize: 12,
                padding: '4px 10px',
                background: sortMode === m ? 'var(--accent-dim)' : 'var(--card)',
                border: `1px solid ${sortMode === m ? 'var(--accent)' : 'var(--border)'}`,
                color: sortMode === m ? 'var(--accent-light)' : 'var(--text-muted)',
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Positions */}
      {sortedPositions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
          No active positions found for this wallet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedPositions.map((pos, i) => (
            <PositionCard key={pos.position_address ?? i} position={pos} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageLoader() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 16px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
      <div>Loading wallet data…</div>
    </div>
  );
}

function PageError({ error, address }) {
  return (
    <div style={{ maxWidth: 600, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
      <div style={{ color: 'var(--red)', marginBottom: 8 }}>{error}</div>
      <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{address}</div>
      <Link href="/" className="btn btn-secondary" style={{ display: 'inline-flex', marginTop: 16 }}>
        ← Back to Search
      </Link>
    </div>
  );
}
