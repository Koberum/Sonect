import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.ts"],
    ignores: ["**/*.d.ts", "drizzle.config.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Essential TypeScript rules
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-floating-promises": "warn",

      // Node.js and common rules
      "no-console": process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-process-exit": "off",
    },
  },
  {
    // Special config for drizzle.config.ts which is not in src/
    files: ["drizzle.config.ts"],
    languageOptions: {
      ecmaVersion: 2020,
      parserOptions: {
        // Don't use project reference for config files outside src/
        // Instead rely on file resolution and built-in types
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Override or disable certain rules for config file
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);
