'use client';
import { useState } from 'react';
import Link from 'next/link';
import { fmtAddr, fmtUsd, fmtPct, fmtAge } from './utils';

const SORT_KEYS = ['share_pct', 'age_hours', 'unclaimed_fees_raw', 'position_count'];

function InRangeBadge({ inRange }) {
  if (inRange === true) return <span className="badge badge-green">✅ IN RANGE</span>;
  if (inRange === 'partial') return <span className="badge badge-yellow">⚡ PARTIAL</span>;
  if (inRange === false) return <span className="badge badge-orange">⚠️ OOR</span>;
  return <span className="badge badge-gray">—</span>;
}

export default function LPerTable({ lpers = [], poolAddress }) {
  const [sortKey, setSortKey] = useState('share_pct');
  const [sortDir, setSortDir] = useState('desc');

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  }

  const sorted = [...lpers].sort((a, b) => {
    const av = a[sortKey] ?? -Infinity;
    const bv = b[sortKey] ?? -Infinity;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  if (!lpers.length) {
    return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>No LP positions found.</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr className="table-header">
            <Th label="Wallet" />
            <Th label="Share %" sortKey="share_pct" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <Th label="Positions" sortKey="position_count" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <Th label="Status" />
            <Th label="Fees (raw)" sortKey="unclaimed_fees_raw" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <Th label="Age" sortKey="age_hours" current={sortKey} dir={sortDir} onSort={toggleSort} />
            <Th label="" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((lp, i) => (
            <tr
              key={lp.wallet}
              style={{
                borderBottom: '1px solid var(--border)',
                background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)',
              }}
            >
              <td className="py-3 px-4 font-mono text-xs">
                <CopyAddr addr={lp.wallet} />
              </td>
              <td className="py-3 px-4 font-semibold tabular-nums">
                {lp.share_pct != null ? lp.share_pct.toFixed(2) + '%' : '—'}
              </td>
              <td className="py-3 px-4 tabular-nums text-center">
                {lp.position_count}
              </td>
              <td className="py-3 px-4">
                <InRangeBadge inRange={lp.in_range} />
              </td>
              <td className="py-3 px-4 font-mono text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {lp.unclaimed_fees_raw > 0 ? lp.unclaimed_fees_raw.toLocaleString() : '—'}
              </td>
              <td className="py-3 px-4 tabular-nums text-sm" style={{ color: 'var(--text-muted)' }}>
                {fmtAge(lp.age_hours)}
              </td>
              <td className="py-3 px-4">
                <Link href={`/wallet/${lp.wallet}`} className="btn btn-ghost text-xs py-1 px-3">
                  Profile →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ label, sortKey, current, dir, onSort }) {
  const active = current === sortKey;
  return (
    <th
      className="py-2 px-4 text-left text-xs font-semibold select-none"
      style={{
        color: active ? 'var(--accent-light)' : 'var(--text-muted)',
        cursor: sortKey ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
      onClick={() => sortKey && onSort?.(sortKey)}
    >
      {label} {active && (dir === 'desc' ? '↓' : '↑')}
    </th>
  );
}

function CopyAddr({ addr }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(addr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <span
      onClick={copy}
      className="cursor-pointer"
      title={addr}
      style={{ color: copied ? 'var(--green)' : 'var(--text-muted)' }}
    >
      {copied ? '✓ copied' : fmtAddr(addr)}
    </span>
  );
}
