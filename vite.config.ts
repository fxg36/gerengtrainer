import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
export default defineConfig(({ mode }) => ({
  resolve:
    mode === "native"
      ? {
          alias: {
            "virtual:pwa-register/react": fileURLToPath(
              new URL("./src/native-sw.ts", import.meta.url),
            ),
          },
        }
      : undefined,
  plugins: [
    react(),
    ...(mode === "native"
      ? []
      : [
          VitePWA({
            registerType: "prompt",
            includeAssets: ["icon.svg", "icon-192.png", "icon-512.png"],
            manifest: {
              name: "Einfach Englisch",
              short_name: "Einfach Englisch",
              description:
                "Englisch im Alltag sicher nutzen. Wortschatz und Grammatik mit Text üben – offline und ohne Konto.",
              lang: "de",
              id: "/",
              start_url: "/",
              scope: "/",
              display: "standalone",
              background_color: "#f1ecdf",
              theme_color: "#25375b",
              icons: [
                { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
                {
                  src: "/icon-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "any maskable",
                },
              ],
            },
            workbox: {
              clientsClaim: true,
              globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2,json,txt}"],
              maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
              navigateFallback: "/index.html",
              cleanupOutdatedCaches: true,
            },
          }),
        ]),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    outDir: mode === "native" ? "dist-native" : "dist",
  },
}));
