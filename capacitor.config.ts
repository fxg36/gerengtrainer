import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.einfachenglisch.trainer",
  appName: "Einfach Englisch",
  webDir: "dist-native",
  backgroundColor: "#f1ecdf",
  // Bundle the entire course. Never point a store build at a development server.
  android: { allowMixedContent: false, minWebViewVersion: 111 },
  server: { errorPath: "webview-update.html" },
  ios: { contentInset: "never" },
  plugins: {
    SystemBars: { insetsHandling: "css", style: "LIGHT", hidden: false },
    Keyboard: { resize: "native", resizeOnFullScreen: true },
  },
};

export default config;
