import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SITE_URL } from '@/lib/seo/hreflang';
// Note: KaTeX CSS moved to markdown page layouts for performance (P0)

// Viewport configuration for mobile-first optimization
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  colorScheme: 'light dark',
};

// P0-6: Use centralized SITE_URL from lib/seo/hreflang
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Quantum Nexus LNK｜連結社群的數位解決方案',
  description: '打造連接社群與尖端數位服務的科技平台。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
