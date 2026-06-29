'use client';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LPerTable from '@/components/LPerTable';
import { fmtUsd, fmtPct, fmtAddr, scoreColor, pctColor } from '@/components/utils';

function ScoreGauge({ score }) {
  if (score == null) return null;
  const color = scoreColor(score);
  const pct = score;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path d="M10 65 A50 50 0 0 1 110 65" fill="none" stroke="var(--border)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M10 65 A50 50 0 0 1 110 65"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 157} 157`}
        />
      </svg>
      <div style={{ marginTop: -32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>/ 100</div>
      </div>
    </div>
  );
}

function PriceChangeRow({ priceChange }) {
  if (!priceChange) return null;
  const windows = [
    { label: 'm5', val: priceChange.m5 },
    { label: 'h1', val: priceChange.h1 },
    { label: 'h6', val: priceChange.h6 },
    { label: 'h24', val: priceChange.h24 },
  ];
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {windows.map(({ label, val }) => (
        <div key={label}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: pctColor(val), fontVariantNumeric: 'tabular-nums' }}>
            {val != null ? fmtPct(val) : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatGrid({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
      {items.map(({ label, value, sub, color }) => (
        <div key={label}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
      ))}
    </div>
  );
}

function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;
  const entries = Object.entries(breakdown).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, val]) => {
        const isNeg = val < 0;
        const pct = Math.min(Math.abs(val) / 35 * 100, 100);
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', width: 130, flexShrink: 0 }}>
              {key.replace(/_/g, ' ')}
            </div>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                width: pct + '%',
                height: '100%',
                background: isNeg ? 'var(--red)' : 'var(--accent)',
                borderRadius: 4,
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, width: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: isNeg ? 'var(--red)' : 'var(--green)' }}>
              {val > 0 ? '+' : ''}{val}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PoolPage({ params }) {
  const { address } = use(params);
  const router = useRouter();

  const [poolData, setPoolData] = useState(null);
  const [lpers, setLpers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lpersLoading, setLpersLoading] = useState(false);
  const [showLpers, setShowLpers] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/pool/' + address)
      .then((r) => r.json())
      .then((d) => {
        if (d.error && !d.pool && !d.dexscreener) throw new Error(d.error);
        setPoolData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [address]);

  async function loadLpers() {
    setLpersLoading(true);
    setShowLpers(true);
    try {
      const res = await fetch('/api/pool/' + address + '/lpers');
      const data = await res.json();
      setLpers(data);
    } catch (e) {
      setLpers({ error: e.message });
    } finally {
      setLpersLoading(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error) return <PageError error={error} address={address} />;

  const { pool, score, score_breakdown, dexscreener, token, lp_depth, entry_timing, yield_projection } = poolData ?? {};

  const buys = dexscreener?.txns_h1?.buys ?? 0;
  const sells = dexscreener?.txns_h1?.sells ?? 0;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      {/* Back */}
      <button onClick={() => router.back()} className="btn btn-ghost" style={{ marginBottom: 20, fontSize: 13 }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
            {pool?.name ?? 'Pool Analyzer'}
          </h1>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {address}
          </div>
          {dexscreener?.dex_url && (
            <a href={dexscreener.dex_url} target="_blank" rel="noopener" style={{ fontSize: 12, color: 'var(--accent-light)', marginTop: 4, display: 'inline-block' }}>
              View on DexScreener ↗
            </a>
          )}
        </div>
        <ScoreGauge score={score} />
      </div>

      {/* Entry timing alert */}
      {entry_timing && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          marginBottom: 20,
          background: entry_timing.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${entry_timing.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: entry_timing.ok ? 'var(--green)' : 'var(--red)',
          fontSize: 13,
          fontWeight: 500,
        }}>
          {entry_timing.ok ? '✅' : '⛔'} {entry_timing.reason}
        </div>
      )}

      {/* Error partial */}
      {(poolData?.errors?.pool || poolData?.errors?.dexscreener) && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
          ⚠️ Partial data — {poolData.errors.pool && `Meteora: ${poolData.errors.pool}`}
          {poolData.errors.pool && poolData.errors.dexscreener && ' | '}
          {poolData.errors.dexscreener && `DexScreener: ${poolData.errors.dexscreener}`}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        {/* DexScreener momentum */}
        {dexscreener && (
          <div className="card">
            <SectionTitle>Price Momentum</SectionTitle>
            <PriceChangeRow priceChange={dexscreener.price_change} />
            <div style={{ marginTop: 16 }}>
              <StatGrid items={[
                { label: 'Price USD', value: dexscreener.price_usd ? '$' + Number(dexscreener.price_usd).toPrecision(6) : '—' },
                { label: 'Liquidity', value: fmtUsd(dexscreener.liquidity_usd, 0) },
                { label: 'Pair Age', value: dexscreener.pair_age_hours != null ? (dexscreener.pair_age_hours / 24).toFixed(1) + 'd' : '—' },
              ]} />
            </div>
          </div>
        )}

        {/* Buy/Sell pressure */}
        {dexscreener && (
          <div className="card">
            <SectionTitle>Buy/Sell Pressure (h1)</SectionTitle>
            <BuySellBar buys={buys} sells={sells} buyPct={dexscreener.buy_pressure_pct} />
            <div style={{ marginTop: 16 }}>
              <StatGrid items={[
                { label: 'Buys h1', value: buys, color: 'var(--green)' },
                { label: 'Sells h1', value: sells, color: 'var(--red)' },
                { label: 'Buy %', value: dexscreener.buy_pressure_pct != null ? dexscreener.buy_pressure_pct.toFixed(1) + '%' : '—' },
              ]} />
            </div>
          </div>
        )}

        {/* TVL & Fees */}
        {pool && (
          <div className="card">
            <SectionTitle>Pool Metrics</SectionTitle>
            <StatGrid items={[
              { label: 'TVL', value: fmtUsd(pool.tvl_usd, 0) },
              { label: 'Vol 24h', value: fmtUsd(pool.volume_24h_usd, 0) },
              { label: 'Fee Rate', value: pool.fee_rate_bps ? pool.fee_rate_bps / 100 + 'bps' : '—' },
              { label: 'Bin Step', value: pool.bin_step ?? '—' },
              { label: 'Active Bin', value: pool.active_bin_id ?? '—' },
            ]} />
          </div>
        )}

        {/* LP Depth */}
        <div className="card">
          <SectionTitle>LP Depth</SectionTitle>
          <StatGrid items={[
            { label: 'Open Positions', value: lp_depth?.open_positions ?? '—' },
            { label: 'Active %', value: lp_depth?.active_pct != null ? lp_depth.active_pct + '%' : '—' },
            { label: 'Unique LPs', value: lp_depth?.unique_lps ?? '—' },
            { label: 'Churn %', value: lp_depth?.lp_churn_pct != null ? lp_depth.lp_churn_pct + '%' : '—' },
          ]} />
        </div>

        {/* Yield Projection */}
        {yield_projection && (
          <div className="card">
            <SectionTitle>Yield Projection <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(1% TVL share)</span></SectionTitle>
            <StatGrid items={[
              { label: 'Est Daily', value: fmtUsd(yield_projection.est_daily_usd), color: 'var(--green)' },
              { label: 'APR', value: yield_projection.apr_pct != null ? yield_projection.apr_pct.toFixed(1) + '%' : '—', color: 'var(--accent-light)' },
            ]} />
          </div>
        )}

        {/* Score Breakdown */}
        {score_breakdown && (
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <SectionTitle>Score Breakdown</SectionTitle>
            <ScoreBreakdown breakdown={score_breakdown} />
          </div>
        )}
      </div>

      {/* LPers section */}
      <div className="card" style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <SectionTitle style={{ marginBottom: 0 }}>Liquidity Providers</SectionTitle>
          {!showLpers && (
            <button onClick={loadLpers} className="btn btn-primary" style={{ fontSize: 13 }}>
              View LPers →
            </button>
          )}
        </div>
        {showLpers && lpersLoading && <Spinner />}
        {showLpers && lpers && !lpers.error && (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <Chip label="Open" value={lpers.open_positions} />
              <Chip label="Active" value={lpers.active_positions} />
              <Chip label="Active %" value={lpers.active_pct + '%'} color="var(--green)" />
              <Chip label="Unique LPs" value={lpers.unique_lps} />
            </div>
            <LPerTable lpers={lpers.lpers} poolAddress={address} />
          </>
        )}
        {showLpers && lpers?.error && (
          <div style={{ color: 'var(--red)', fontSize: 13 }}>Error: {lpers.error}</div>
        )}
      </div>
    </div>
  );
}

function BuySellBar({ buys, sells, buyPct }) {
  const pct = buyPct ?? (buys + sells > 0 ? buys / (buys + sells) * 100 : 50);
  return (
    <div>
      <div style={{ borderRadius: 6, overflow: 'hidden', height: 12, background: 'rgba(239,68,68,0.3)' }}>
        <div style={{ width: pct + '%', height: '100%', background: 'var(--green)', transition: 'width 0.3s' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
        <span style={{ color: 'var(--green)' }}>Buys {pct.toFixed(0)}%</span>
        <span style={{ color: 'var(--red)' }}>{(100 - pct).toFixed(0)}% Sells</span>
      </div>
    </div>
  );
}

function Chip({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '6px 12px', fontSize: 12 }}>
      <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>{label}</span>
      <span style={{ fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children, style }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12, ...style }}>
      {children}
    </div>
  );
}

function PageLoader() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 16px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
      <div>Loading pool data…</div>
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

function Spinner() {
  return <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Loading…</div>;
}
