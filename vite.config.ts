import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";

const config = defineConfig({
  plugins: [
    // Override the event bus port to run several dev servers side by side (e.g. in worktrees)
    devtools({
      eventBusConfig: { port: Number(process.env.DEVTOOLS_EVENT_BUS_PORT) || undefined },
    }),
    process.env.NODE_ENV === "production" ? netlify() : null,
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
  ].filter(Boolean),
});

export default config;
