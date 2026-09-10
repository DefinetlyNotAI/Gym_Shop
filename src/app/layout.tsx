import type { Metadata } from "next";
import "./globals.css";
import{SimulationSwitcher}from"@/components/simulation-switcher";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gym Shop",
  description: "Gym apparel and accessories in Jordan",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body><SimulationSwitcher/>{children}</body>
    </html>
  );
}
