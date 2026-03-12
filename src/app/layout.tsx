import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PasswordGate from "@/components/PasswordGate";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Semper Dashboard",
  description: "Dashboard financiero integrado con Shopify y Stripe",
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: { url: '/logo.png', type: 'image/png' },
    shortcut: '/logo.png',
  },
  openGraph: {
    title: 'Semper Dashboard',
    description: 'Dashboard financiero Semper',
    images: [{ url: '/logo.png', width: 132, height: 132 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        <PasswordGate>{children}</PasswordGate>
      </body>
    </html>
  );
}
