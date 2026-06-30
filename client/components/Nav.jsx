'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname();
  const links = [
    { href: '/', label: 'Search' },
    { href: '/discover', label: 'Discover' },
    { href: '/watchlist', label: 'Watchlist' },
  ];

  return (
    <nav style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}
      className="flex items-center justify-between px-6 py-3 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 no-underline">
        <span style={{ color: 'var(--accent)' }} className="text-xl font-bold">◆</span>
        <span className="font-bold text-base" style={{ color: 'var(--text)' }}>
          Sonar
          <span style={{ color: 'var(--text-muted)' }} className="font-normal text-sm ml-1">LP Intelligence</span>
        </span>
      </Link>
      <div className="flex gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-4 py-2 rounded-lg text-sm font-medium no-underline transition-all"
            style={{
              background: path === l.href ? 'var(--accent-dim)' : 'transparent',
              color: path === l.href ? 'var(--accent-light)' : 'var(--text-muted)',
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
