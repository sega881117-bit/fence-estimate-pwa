import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Смета забора',
  description: 'Автономный калькулятор предварительной сметы забора.',
  manifest: './manifest.webmanifest',
  icons: { icon: [{ url: './fence-icon.svg', type: 'image/svg+xml', sizes: 'any' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
