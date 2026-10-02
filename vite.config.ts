import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: ["es2020", "chrome87", "edge88", "firefox78", "safari14"],
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("react")) return "react";
        },
      },
    },
  },
});
