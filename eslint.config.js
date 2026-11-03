import { tanstackConfig } from "@tanstack/eslint-config";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      // The Expo app has its own ESLint config (apps/mobile/eslint.config.js)
      "apps/**",
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
  {
    // `@shared/*` is a path alias (tsconfig.json), not an npm scope
    settings: { "import/internal-regex": "^@shared/" },
  },
  eslintConfigPrettier,
];
