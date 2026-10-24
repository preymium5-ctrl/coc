import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raidroom — Your village, in focus",
  description: "Look up your Clash of Clans village, track your progress, and explore recent and ranked battles.",
  icons: {
    icon: "/assets/favicon.svg",
    shortcut: "/assets/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
