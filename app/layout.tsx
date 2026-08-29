import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Смета забора',
  description: 'Автономный калькулятор предварительной сметы забора.',
  manifest: '/manifest.webmanifest',
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
