'use client';
import Link from 'next/link';
import { fmtUsd, fmtPct, pctColor, scoreColor } from './utils';

function PriceStrip({ priceChange }) {
  if (!priceChange) return null;
  const windows = [
    { label: 'm5', val: priceChange.m5 },
    { label: 'h1', val: priceChange.h1 },
    { label: 'h6', val: priceChange.h6 },
    { label: 'h24', val: priceChange.h24 },
  ];
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {windows.map(({ label, val }) => (
        <span key={label} className="text-xs font-mono" style={{ color: pctColor(val) }}>
          <span style={{ color: 'var(--text-muted)', marginRight: 2 }}>{label}</span>
          {val != null ? fmtPct(val) : '—'}
        </span>
      ))}
    </div>
  );
}

export default function PoolCard({ address, data, compact = false }) {
  const { pool, score, dexscreener, entry_timing } = data ?? {};

  return (
    <Link href={`/pool/${address}`} className="no-underline block">
      <div
        className="card transition-all cursor-pointer"
        style={{ borderColor: 'var(--border)' }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
                {pool?.name ?? 'Unknown Pool'}
              </span>
              {pool?.bin_step && (
                <span className="badge badge-purple text-xs">{pool.bin_step}bps</span>
              )}
              {entry_timing && (
                <span className={`badge ${entry_timing.ok ? 'badge-green' : 'badge-red'} text-xs`}>
                  {entry_timing.ok ? '✅ Entry OK' : '⛔ Avoid'}
                </span>
              )}
            </div>
            <div className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
              {address.slice(0, 8)}…{address.slice(-6)}
            </div>
            {!compact && <PriceStrip priceChange={dexscreener?.price_change} />}
          </div>

          {/* Score gauge */}
          {score != null && (
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className="text-3xl font-bold tabular-nums"
                style={{ color: scoreColor(score) }}
              >
                {score}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>score</div>
            </div>
          )}
        </div>

        {!compact && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            <Stat label="TVL" value={fmtUsd(pool?.tvl_usd ?? dexscreener?.liquidity_usd, 0)} />
            <Stat label="Vol 24h" value={fmtUsd(pool?.volume_24h_usd, 0)} />
            <Stat label="Buy Press" value={
              dexscreener?.buy_pressure_pct != null
                ? dexscreener.buy_pressure_pct.toFixed(1) + '%'
                : '—'
            } />
          </div>
        )}
      </div>
    </Link>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );
}
