import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME } from "@/lib/app";
import "./globals.css";

/** Onest — современный гротеск с хорошей кириллицей (переменный шрифт, все начертания). */
const onest = Onest({
  subsets: ["cyrillic", "latin"],
  variable: "--font-onest",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_SHORT_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_SHORT_NAME,
  appleWebApp: { capable: true, title: APP_SHORT_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Цвет строки состояния = цвет верхней панели приложения (--surface).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#121826" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`${onest.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
