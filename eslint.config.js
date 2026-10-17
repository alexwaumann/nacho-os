import { tanstackConfig } from "@tanstack/eslint-config";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "old_src/**",
      "convex/_generated/**",
      "dist/**",
      "node_modules/**",
      "ios/**",
      "*.config.js",
      "*.config.ts",
    ],
  },
  ...tanstackConfig,
  eslintConfigPrettier,
];
