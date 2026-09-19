import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Honours the "@/*" path alias from tsconfig.json.
    tsconfigPaths: true,
    alias: {
      // `server-only` throws when imported outside a React Server Component
      // environment; alias it away so server modules can be unit tested.
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
