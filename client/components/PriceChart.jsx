'use client';
import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { fmtUsd } from './utils';

const TFS = ['1h', '4h', '12h', '24h'];

function fmtTick(ts, tf) {
  const d = new Date(ts);
  if (tf === '1h' || tf === '4h') {
    return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:00`;
  }
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
}

function fmtPrice(v) {
  if (v == null) return '—';
  return '$' + Number(v).toPrecision(v >= 1 ? 6 : 4);
}

function ChartTooltip({ active, payload, tf }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{fmtTick(p.ts, tf)} UTC</div>
      <div style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Close {fmtPrice(p.price)}</div>
      <div style={{ color: 'var(--text-muted)' }}>Vol {fmtUsd(p.volume, 0)}</div>
    </div>
  );
}

export default function PriceChart({ address }) {
  const [tf, setTf] = useState('24h');
  const [candles, setCandles] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/pool/${address}/ohlcv?tf=${tf}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) throw new Error(d.error);
        setCandles(
          (d.candles ?? []).map((c) => ({ ts: c.ts, price: c.c, volume: c.v }))
        );
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [address, tf]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <SectionLabel>Price &amp; Volume</SectionLabel>
        <div style={{ display: 'inline-flex', gap: 4, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
          {TFS.map((t) => {
            const active = t === tf;
            return (
              <button
                key={t}
                onClick={() => setTf(t)}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent-light)' : 'var(--text-muted)',
                }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>⏳ Loading chart…</div>
      ) : error ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Chart unavailable: {error}</div>
      ) : !candles?.length ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No candle data.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={candles} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#2a2d3e" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="ts"
              tickFormatter={(v) => fmtTick(v, tf)}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              stroke="#2a2d3e"
              minTickGap={24}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              domain={['auto', 'auto']}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              stroke="#2a2d3e"
              width={56}
              tickFormatter={(v) => (v >= 1 ? '$' + v.toFixed(2) : '$' + Number(v).toPrecision(3))}
            />
            <YAxis yAxisId="vol" orientation="left" hide domain={[0, (max) => max * 4]} />
            <Tooltip content={<ChartTooltip tf={tf} />} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
            <Bar yAxisId="vol" dataKey="volume" fill="#2a3550" radius={[2, 2, 0, 0]} />
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#priceFill)"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
      {children}
    </div>
  );
}
