import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  site: "https://crazyshout.github.io",
  base: isGitHubPages ? "/paper-digest" : "/",
  output: "static",
  outDir: "./dist",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()]
  }
});
