import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "股癌 Podcast 文字稿",
  description: "Gooaye 股癌 Podcast 自動轉錄文字稿",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
