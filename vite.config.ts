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
         registerType: "autoUpdate", // Automatically update the SW when new content is available
         includeAssets: [
            "favicon.ico",
            "apple-touch-icon.png",
            "mask-icon.svg",
         ],
         manifest: {
            name: "Wordle Variant: 4-5-6 Challenge",
            short_name: "WordleVariant",
            description: "Daily word challenge with 4, 5, and 6 letter words",
            theme_color: "#030712",
            background_color: "#030712",
            display: "standalone",
            icons: [
               {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "any",
               },
               {
                  src: "pwa-512x512.png",
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
