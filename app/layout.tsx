import './globals.css';
import type { Metadata, Viewport } from 'next';
export const metadata: Metadata = { title: 'MiFi Data', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'MiFi Data', statusBarStyle: 'default' }, icons: { icon: '/icon.svg', apple: '/icon.svg' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#C6F432' };
export default function Root({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
