import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({

   plugins: [
      react(),
      tailwindcss(),
      VitePWA({
         disable: true,
         strategies: "injectManifest",
         srcDir: "src",
         filename: "null.ts",
         //   filename: "service-worker.ts",
         registerType: 'prompt', // Ask user first
         workbox: {
            cleanupOutdatedCaches: true, // This clears old hashes immediately
            skipWaiting: true,
            clientsClaim: true,
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
         },
         includeAssets: [
            "favicon.ico",
            "apple-touch-icon.png",
            "mask-icon.svg",
         ],
         manifest: {
            name: "Wordle Variant: 4-5-6 Challenge",
            short_name: "WordleVariant",
            description: "Daily word challenge with 4, 5, and 6 letter words",
            theme_color: "#121213",
            background_color: "#121213",
            display: "standalone",
            icons: [
               {
                  src: "pwa_192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any",
               },
               {
                  src: "pwa_512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
               },
            ],
         },
         devOptions: {
            enabled: true, // Allows testing PWA features in dev mode
         },
      }),
   ],
});
