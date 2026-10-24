import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MARINE X DURUGISTA — Our clans, in focus",
  description: "Follow Marine and Durugista: members, loot rankings, current war, Capital Raids, and Clan Games.",
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
