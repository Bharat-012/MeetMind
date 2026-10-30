import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MeetMind — AI Meeting Intelligence & Organizational Memory',
  description: 'Enterprise AI Meeting Intelligence Platform powered by local speech recognition, Nemotron-3 diarization, and grounded retrieval.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-indigo-500/20 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
