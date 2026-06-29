'use client';
import Link from 'next/link';
import { fmtUsd, fmtPct, fmtAge, pnlClass } from './utils';

function InRangeBadge({ inRange }) {
  if (inRange === true) return <span className="badge badge-green">✅ IN RANGE</span>;
  if (inRange === false) return <span className="badge badge-orange">⚠️ OOR</span>;
  return <span className="badge badge-gray">—</span>;
}

export default function PositionCard({ position }) {
  const {
    pool_address,
    pool_name,
    bin_step,
    in_range,
    deposited_usd,
    current_usd,
    fees_earned_usd,
    il_usd,
    real_pnl_usd,
    real_pnl_pct,
    age_hours,
  } = position;

  return (
    <div className="card" style={{ gap: 0 }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
              {pool_name ?? 'Unknown Pool'}
            </span>
            {bin_step && (
              <span className="badge badge-purple text-xs">{bin_step}bps</span>
            )}
            <InRangeBadge inRange={in_range} />
          </div>
          {pool_address && (
            <Link
              href={`/pool/${pool_address}`}
              className="text-xs font-mono no-underline"
              style={{ color: 'var(--accent-light)' }}
            >
              {pool_address.slice(0, 8)}…{pool_address.slice(-6)} →
            </Link>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {real_pnl_usd != null ? (
            <>
              <div className={`font-bold text-lg ${pnlClass(real_pnl_usd)}`}>
                {real_pnl_usd >= 0 ? '+' : ''}{fmtUsd(real_pnl_usd)}
              </div>
              {real_pnl_pct != null && (
                <div className={`text-xs ${pnlClass(real_pnl_pct)}`}>
                  {fmtPct(real_pnl_pct)}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>PnL n/a</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Stat label="Deposited" value={fmtUsd(deposited_usd)} />
        <Stat label="Current" value={fmtUsd(current_usd)} />
        <Stat label="Fees Earned" value={fmtUsd(fees_earned_usd)} highlight />
        <Stat label="IL" value={il_usd != null ? fmtUsd(il_usd) : '—'} pnl={il_usd} />
      </div>

      <div className="mt-3 text-xs flex gap-4" style={{ color: 'var(--text-muted)' }}>
        {age_hours != null && <span>⏱ {fmtAge(age_hours)} old</span>}
        {position.lower_bin != null && (
          <span>Bins: {position.lower_bin} – {position.upper_bin}</span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight, pnl }) {
  const color = pnl != null
    ? pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-muted)'
    : highlight ? '#86efac' : 'var(--text)';

  return (
    <div>
      <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}
