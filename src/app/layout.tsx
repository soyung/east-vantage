import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'East Vantage — East Asia OSINT Dashboard',
  description:
    'Real-time open-source intelligence dashboard for the Taiwan Strait and Korean peninsula.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#05070d] text-zinc-100">{children}</body>
    </html>
  );
}
