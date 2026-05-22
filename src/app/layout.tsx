import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CommitGenius — AI Commit Message Generator",
  description: "Generate perfect git commit messages from your code diffs using AI. Powered by Xiaomi MiMo.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-dark-900 text-dark-100 antialiased">
        {children}
      </body>
    </html>
  );
}
