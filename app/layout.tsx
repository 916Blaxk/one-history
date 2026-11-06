import type { Metadata, Viewport } from 'next';
import { Cinzel, Cinzel_Decorative, Spectral } from 'next/font/google';
import { Toaster } from 'sonner';

const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cinzel' });
const cinzelDecorativa = Cinzel_Decorative({ subsets: ['latin'], weight: ['700'], variable: '--font-cinzel-decorativa' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-spectral' });

export const metadata: Metadata = {
  title: { default: 'One History', template: '%s · One History' },
  description: 'Fichas e campanhas do sistema de RPG One History.',
};

/* `cover` libera a área do entalhe do celular: os estilos já respeitam as margens seguras. */
export const viewport: Viewport = { themeColor: '#0b0e1a', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${cinzel.variable} ${cinzelDecorativa.variable} ${spectral.variable}`}>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
