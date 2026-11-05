import type { Metadata } from 'next';
import { Alegreya_Sans, Alegreya_Sans_SC, Grenze_Gotisch } from 'next/font/google';
import { Toaster } from 'sonner';

const grenze = Grenze_Gotisch({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-grenze' });
const alegreya = Alegreya_Sans({ subsets: ['latin'], weight: ['400', '500', '700'], style: ['normal', 'italic'], variable: '--font-alegreya' });
const alegreyaSc = Alegreya_Sans_SC({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-alegreya-sc' });

export const metadata: Metadata = {
  title: { default: 'One History', template: '%s · One History' },
  description: 'Fichas e campanhas do sistema de RPG One History.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${grenze.variable} ${alegreya.variable} ${alegreyaSc.variable}`}>
      <body>
        {children}
        <Toaster theme="system" position="bottom-center" richColors closeButton />
      </body>
    </html>
  );
}
