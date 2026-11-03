// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { readFile } from "node:fs/promises";

const githubPages = process.env['GITHUB_PAGES'] === "true";
const base = githubPages ? `/${(process.env['VITE_BASE_PATH'] ?? "").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/") : "/";

export default defineConfig({
  vite: { base, ...(githubPages ? { publicDir: ".output/pages-public" } : {}) },
  ...(githubPages ? { nitro: false } : {}),
  plugins: githubPages ? [{
    name: "github-pages-local-media",
    enforce: "pre" as const,
    async load(id: string) {
      if (!id.endsWith(".asset.json")) return;
      const pointer = JSON.parse(await readFile(id, "utf8"));
      return JSON.stringify({ ...pointer, url: `${base}${pointer.url.replace(/^\//, "")}` });
    },
  }] : [],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    ...(githubPages ? {
      router: { basepath: base === "/" ? "/" : base.slice(0, -1) },
      spa: { enabled: true },
      prerender: { enabled: true, autoStaticPathsDiscovery: false, crawlLinks: false, failOnError: true },
      sitemap: { enabled: false },
    } : {}),
  },
});
