import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buildy — AI Website Builder",
  description: "Describe your business. Get a beautiful website in 15 seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
