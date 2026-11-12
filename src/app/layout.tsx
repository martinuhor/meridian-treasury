import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: `${siteConfig.name} · Treasury & Invoicing`,
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
