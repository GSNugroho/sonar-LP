import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Sonar LP Intelligence Dashboard",
  description: "Read-only research & monitoring tool for Meteora DLMM liquidity pools on Solana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="text-center py-4 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
          Sonar LP Intelligence Dashboard — read-only research tool. Not financial advice.
        </footer>
      </body>
    </html>
  );
}

