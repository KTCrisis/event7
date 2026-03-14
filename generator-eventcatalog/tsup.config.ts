import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  clean: true,
  sourcemap: true,
  target: "node18",
  outDir: "dist",
});