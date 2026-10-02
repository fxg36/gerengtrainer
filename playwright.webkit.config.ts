import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Browser-engine coverage only; this does not replace Safari or iOS device tests.
export default defineConfig(base, {
  outputDir: ".local/release-audit-webkit-results",
  use: { browserName: "webkit", channel: undefined },
});
