import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { DashboardLayout } from "@/components";
import { DateRangeProvider } from "@/contexts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GPT Finance",
  description: "Dashboard financiero para métricas SaaS",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-invoke-path") || headersList.get("x-pathname") || "";
  const isLoginPage = pathname === "/login" || pathname.startsWith("/login");

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isLoginPage ? (
          children
        ) : (
          <DateRangeProvider>
            <DashboardLayout>
              {children}
            </DashboardLayout>
          </DateRangeProvider>
        )}
      </body>
    </html>
  );
}
