import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JARVIS Swap",
    short_name: "JARVIS Swap",
    description: "Sui-first swap, liquidity, token, bridge and analytics interface for JARVIS.",
    start_url: "/swap",
    display: "standalone",
    background_color: "#F7F9FC",
    theme_color: "#0B1730",
    icons: [{ src: "/brand/jarvis-logo-light.jpeg", sizes: "1536x1536", type: "image/jpeg" }],
  };
}
