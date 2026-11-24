import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// base "./" makes every asset path relative, so the same build works at
// /<app>/ on the self-hosted server, on GitHub Pages, and at the root on Netlify.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
