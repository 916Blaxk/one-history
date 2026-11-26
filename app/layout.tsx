import type { Metadata, Viewport } from 'next';
import { Almendra, Cinzel, Spectral } from 'next/font/google';
import { Toaster } from 'sonner';
import { SCRIPT_TEMA } from '@/lib/temaScript';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cinzel' });
const almendra = Almendra({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-almendra' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-spectral' });

export const metadata: Metadata = {
  title: { default: 'One History', template: '%s · One History' },
  description: 'Fichas e campanhas do sistema de RPG One History.',
};

/* `cover` libera a área do entalhe do celular: os estilos já respeitam as margens seguras. */
export const viewport: Viewport = { themeColor: '#0b0e1a', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-tema="roxo" className={`${cinzel.variable} ${almendra.variable} ${spectral.variable}`} suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes de pintar. A CSP já libera script inline. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
