import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Sinal AI Sales OS',
  description: 'AI-first SDR and Revenue Intelligence platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
