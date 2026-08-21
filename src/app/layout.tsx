import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Discord's real typeface ("gg sans") is proprietary; Inter is the closest
// free match in weight and letterforms -- Fredoka's rounded/playful look
// worked for the old jungle theme but fights the real-Discord palette.
const inter = Inter({
  variable: "--font-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MacaCall 🐵",
  description: "Chame o bando pra caçar banana em call de voz, vídeo e tela",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
