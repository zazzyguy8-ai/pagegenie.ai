import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PageGenie — AI Website Builder",
  description: "Type your idea. Get a website in seconds. AI builds a complete site — download it, host it anywhere.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
