import type { MetadataRoute } from "next";

/**
 * PWA web app manifest (Next 16 metadata convention -> served at /manifest.webmanifest).
 * Colors use the Trashium brand palette: espresso theme, cream/linen background.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trashium - Incentivized Waste Management",
    short_name: "Trashium",
    description:
      "Schedule recyclables pickups, earn Green Credits, and track your eco impact across West Bengal.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F4EFE3",
    theme_color: "#2A2218",
    categories: ["utilities", "lifestyle", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
