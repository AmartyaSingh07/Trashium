import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "**/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // trashium-app/ is a separate nested project with its own eslint config — don't lint it from root.
    "trashium-app/**",
    // Vendored agent/skill tooling — not app source; don't lint (removes ~132 files of noise).
    ".claude/**",
    ".agents/**",
  ]),
]);

export default eslintConfig;
