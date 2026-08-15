import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agrishield ERP & Invoicing Portal",
  description: "Internal Business Management Platform for Agrishield Industries Pvt. Ltd.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
