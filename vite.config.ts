import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
   resolve: {
      alias: {
         "@": path.resolve(process.cwd(), "./src"),
      },
   },
   plugins: [
      react(),
      tailwindcss(),
   ],
   build: {
      cssCodeSplit: true,
      sourcemap: false,
      rollupOptions: {
         output: {
            codeSplitting: true,
            manualChunks(id) {
               if (id.includes("src/data")) {
                  return "data-layer";
               }
               if (id.includes("node_modules")) {
                  if (id.includes("react") || id.includes("scheduler") || id.includes("react-dom"))
                     return "vendor-react-core";
                  if (id.includes("@supabase")) return "vendor-supabase";
                  if (id.includes("@tanstack/react-query")) return "vendor-query";
                  if (id.includes("framer-motion")) return "vendor-framer";
                  if (id.includes("lucide-react")) return "vendor-icons";
                  if (id.includes("agora-rtc-sdk-ng")) return "vendor-agora";
                  return "vendor-utils";
               }
               if (id.includes("src/lib/game-logic")) {
                  return "game-logic";
               }
            },
         },
      },
      chunkSizeWarningLimit: 600, // Lower limit to encourage better splitting
   },
});
