import type { Metadata, Viewport } from 'next';
import { IM_Fell_English, IM_Fell_English_SC, Spectral } from 'next/font/google';
import { Toaster } from 'sonner';

/* Letra de livro impresso: nomes e títulos parecem gravados num tomo de academia, não num painel de aplicativo. */
const fell = IM_Fell_English({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-fell' });
const fellSc = IM_Fell_English_SC({ subsets: ['latin'], weight: '400', variable: '--font-fell-sc' });
const spectral = Spectral({ subsets: ['latin'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-spectral' });

export const metadata: Metadata = {
  title: { default: 'One History', template: '%s · One History' },
  description: 'Fichas e campanhas do sistema de RPG One History.',
};

/* `cover` libera a área do entalhe do celular: os estilos já respeitam as margens seguras. */
export const viewport: Viewport = { themeColor: '#100e0c', viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fell.variable} ${fellSc.variable} ${spectral.variable}`}>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
