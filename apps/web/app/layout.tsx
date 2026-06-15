import type { Metadata } from 'next';
import './globals.css';
import { ThemeToggle } from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'WC26 // Continental Chaos Board',
  description:
    'A live, funny, interactive dashboard for the 2026 FIFA World Cup with a real ML win-probability engine. $0 infrastructure.',
};

// Set the saved theme before first paint to avoid a flash of the default theme.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('wc26-theme')||'holo';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="holo" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <ThemeToggle />
      </body>
    </html>
  );
}
