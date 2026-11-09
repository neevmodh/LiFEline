import type { MetadataRoute } from "next";

// Lets citizens install LiFEline on their phone's home screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LiFEline: Mission LiFE companion",
    short_name: "LiFEline",
    description: "Track your household footprint, act at the right time, and see what rooftop solar would save.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8f4",
    theme_color: "#1f7a4d",
    lang: "en-IN",
    categories: ["lifestyle", "utilities", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log an action", url: "/actions" },
      { name: "Rooftop solar check", url: "/solar" },
    ],
  };
}
