import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionWarmer } from "@/components/SessionWarmer";
import { ConfirmProvider } from "@/components/ConfirmDialog";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Blikon Drive",
  description: "Almacenamiento de archivos Blikon",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-gray-50 text-gray-900 font-sans">
        <SessionWarmer />
        <ConfirmProvider>
          {children}
        </ConfirmProvider>
      </body>
    </html>
  );
}
