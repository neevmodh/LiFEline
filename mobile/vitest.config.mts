// Unit tests for the app's pure logic (game layer, prizes, formatting). Screens are checked by
// type-checking and by driving the web build; these cover the rules and their edge cases.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("../web/src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts"] },
});
