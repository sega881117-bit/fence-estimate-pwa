import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Смета забора',
  description: 'Автономный калькулятор предварительной сметы забора.',
  manifest: './manifest.webmanifest',
  icons: {
    icon: [{ url: './fence-icon.png?v=3', type: 'image/png', sizes: '64x64' }],
    shortcut: './fence-icon.png?v=3',
    apple: [{ url: './apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png' }],
  },
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
