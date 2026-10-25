// The app: installable from the browser's menu
import type { APIRoute } from "astro";
import { LIBRARY } from "../lib/library";

export const GET: APIRoute = () => new Response(`${JSON.stringify({
  name: "The Bookshelf", short_name: "Bookshelf", description: `A free library of ${LIBRARY.length} classics.`,
  start_url: "./", scope: "./", display: "standalone", background_color: "#3b308f", theme_color: "#ffd24a",
  icons: [{ src: "image/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "image/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "image/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
}, null, 2)}\n`, { headers: { "Content-Type": "application/manifest+json" } });
