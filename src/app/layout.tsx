import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/context";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: { default: "JARVIS Swap", template: "%s · JARVIS Swap" },
  description: "Sui-first swap, liquidity, token, bridge and analytics interface for JARVIS.",
  applicationName: "JARVIS Swap",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/brand/jarvis-logo-light.jpeg", apple: "/brand/jarvis-logo-light.jpeg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F7FB" },
    { media: "(prefers-color-scheme: dark)", color: "#07101F" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><AppProviders><AppShell>{children}</AppShell></AppProviders></body></html>;
}
