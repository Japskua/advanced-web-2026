// One ESLint configuration for every project in the repository.
// Run it from the repository root with `bun run lint`.
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/uploads/**", "**/data/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Allow intentionally unused arguments when they start with an underscore,
      // e.g. `(_req: Request) => ...`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Back-end code runs on Bun.
  {
    files: ["**/*-api/**/*.ts", "week-01/**/*.ts"],
    languageOptions: { globals: { ...globals.node, Bun: "readonly" } },
  },
  // Front-end code runs in the browser and uses React hooks.
  {
    files: ["**/*.tsx", "**/*-client/**/*.ts", "week-03/**/*.ts", "week-09/**/*.ts"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // The plain-JavaScript front-end of week 2.
  {
    files: ["week-02/**/public/**/*.js"],
    languageOptions: { globals: globals.browser, sourceType: "script" },
  },
);
