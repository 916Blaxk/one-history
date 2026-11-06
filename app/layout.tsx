import type { Metadata } from 'next';
import { Alegreya, Alegreya_SC, Almendra } from 'next/font/google';
import { Toaster } from 'sonner';

const almendra = Almendra({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-almendra' });
const alegreya = Alegreya({ subsets: ['latin'], weight: ['400', '500', '700'], style: ['normal', 'italic'], variable: '--font-alegreya' });
const alegreyaSc = Alegreya_SC({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-alegreya-sc' });

export const metadata: Metadata = {
  title: { default: 'One History', template: '%s · One History' },
  description: 'Fichas e campanhas do sistema de RPG One History.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${almendra.variable} ${alegreya.variable} ${alegreyaSc.variable}`}>
      <body>
        {children}
        <Toaster theme="dark" position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
