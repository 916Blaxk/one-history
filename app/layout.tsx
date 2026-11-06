import type { Metadata, Viewport } from 'next';
import { Cinzel, Inter } from 'next/font/google';
import { Toaster } from 'sonner';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cinzel' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'One History', template: '%s · One History' },
  description: 'Fichas e campanhas do sistema de RPG One History.',
};

/* `cover` libera a área do entalhe do celular: os estilos já respeitam as margens seguras. */
export const viewport: Viewport = { themeColor: '#0b0e1a', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${inter.variable}`}>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
