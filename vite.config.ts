import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";

const config = defineConfig({
  resolve: {
    // Resolve the `@/*` alias from tsconfig.json natively (replaces vite-tsconfig-paths)
    tsconfigPaths: true,
  },
  server: {
    // Allow the Tailscale MagicDNS hostname so `tailscale serve` can proxy to the dev server
    allowedHosts: [".ts.net"],
  },
  plugins: [
    // Override the event bus port to run several dev servers side by side (e.g. in worktrees)
    devtools({
      eventBusConfig: { port: Number(process.env.DEVTOOLS_EVENT_BUS_PORT) || undefined },
    }),
    // HTTPS=1 serves over HTTPS with a self-signed cert, since iOS only allows the mic on HTTPS
    process.env.HTTPS ? basicSsl() : null,
    tailwindcss(),
    // SPA mode prerenders a single shell (`dist/client/_shell.html`) at build time. Netlify serves
    // `dist/client` as static files and rewrites every other path to the shell (`public/_redirects`).
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ].filter(Boolean),
});

export default config;
