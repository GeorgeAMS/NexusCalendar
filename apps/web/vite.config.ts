import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    port: 5173,
    strictPort: false,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      // Custom SSR wrapper (error page for swallowed h3 500s).
      server: { entry: "server" },
    }),
    // react's vite plugin must come after Start's plugin
    viteReact(),
    nitro(),
  ],
});
