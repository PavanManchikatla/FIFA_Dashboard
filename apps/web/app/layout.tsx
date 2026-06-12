import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WC26 // Continental Chaos Board',
  description:
    'A live, funny, interactive dashboard for the 2026 FIFA World Cup with a real ML win-probability engine. $0 infrastructure.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
