import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import Navigation from '@/components/Navigation';
import SiteFooter from '@/components/SiteFooter';
import { faviconPath } from '@/content/assetPaths';
import '@/styles/global.scss';

export const metadata: Metadata = {
  title: { default: 'Ninad Patil · Full-Stack & AI Engineer', template: '%s · Ninad Patil' },
  description: 'The engineering portfolio of Ninad Patil, focused on full-stack applications and AI-powered experiences.',
  icons: { icon: { url: faviconPath, type: 'image/png' } },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body id="top">
        <a className="skip" href="#main">Skip to content</a>
        <Navigation />
        <main id="main" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
