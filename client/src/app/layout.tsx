import type { Metadata } from "next";
import "./globals.css";
import { ClientWrapper } from "../components/ClientWrapper";

export const metadata: Metadata = {
  title: "Scalable Comment System",
  description: "A highly scalable comment system with real-time notifications",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
