import { test, expect } from "@playwright/test";
import path from "node:path";

// Real native web bundle, mocked OS bridge. Device/SDK testing is still required.
test.use({ serviceWorkers: "block" });
for (const platform of ["android", "ios"]) {
  test(`${platform} bundle uses native exports and links without browser installation prompts`, async ({
    page,
  }) => {
    const root = path.resolve("dist-native");
    await page.route("http://127.0.0.1:4173/**", async (route) => {
      const pathname = decodeURIComponent(
        new URL(route.request().url()).pathname,
      );
      const file = path.resolve(
        root,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (!file.startsWith(root + path.sep))
        throw new Error("Invalid asset path");
      await route.fulfill({ path: file });
    });
    await page.addInitScript((platform) => {
      const win = window as any;
      if (platform === "android") win.androidBridge = {};
      else win.webkit = { messageHandlers: { bridge: {} } };
      win.nativeCalls = [];
      win.nativeBack = () => {};
      win.Capacitor = {
        PluginHeaders: [
          {
            name: "App",
            methods: [
              { name: "addListener", rtype: "callback" },
              { name: "removeListener", rtype: "promise" },
              { name: "minimizeApp", rtype: "promise" },
            ],
          },
          {
            name: "Filesystem",
            methods: [{ name: "writeFile", rtype: "promise" }],
          },
          { name: "Share", methods: [{ name: "share", rtype: "promise" }] },
          { name: "Browser", methods: [{ name: "open", rtype: "promise" }] },
        ],
        nativeCallback: (
          _plugin: string,
          method: string,
          options: any,
          callback: () => void,
        ) => {
          if (method === "addListener" && options.eventName === "backButton")
            win.nativeBack = callback;
          return "listener-1";
        },
        nativePromise: async (plugin: string, method: string, options: any) => {
          win.nativeCalls.push({ plugin, method, options });
          if (plugin === "Filesystem")
            return { uri: "file:///cache/exports/backup.json" };
          if (plugin === "Share" && win.cancelShare)
            throw new Error("Share canceled");
          return {};
        },
      };
    }, platform);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass("native-app");
    await page
      .getByRole("button", { name: "Daten & Einstellungen", exact: true })
      .click();
    await expect(
      page.getByText("Lokaler App-Speicher", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Dauerhaften Speicher anfragen" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Installationshinweis" }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Lernstand speichern / teilen" })
      .click();
    await expect(page.getByRole("status")).toContainText("Teilen-Dialog");
    const calls = await page.evaluate(() => (window as any).nativeCalls);
    const backup = JSON.parse(
      calls.find((call: any) => call.plugin === "Filesystem").options.data,
    );
    expect(backup.format).toBe("wortnah-backup");
    expect(
      calls.find((call: any) => call.plugin === "Share").options.files,
    ).toEqual(["file:///cache/exports/backup.json"]);
    await page.evaluate(() => {
      (window as any).cancelShare = true;
    });
    await page
      .getByRole("button", { name: "Lernstand speichern / teilen" })
      .click();
    await expect(page.getByRole("status")).toContainText("nicht geteilt");
    await page
      .getByRole("button", { name: "Über die App", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Über Einfach Englisch" });
    await dialog.getByRole("link", { name: /Roediger/ }).click();
    expect(
      await page.evaluate(() =>
        (window as any).nativeCalls.some(
          (call: any) => call.plugin === "Browser",
        ),
      ),
    ).toBe(true);
    if (platform === "android") {
      await page.evaluate(() => (window as any).nativeBack());
      await expect(dialog).toHaveCount(0);
      await page.evaluate(() => (window as any).nativeBack());
      await expect(
        page.getByRole("heading", { name: "Dein Lernheft." }),
      ).toBeVisible();
      await page.evaluate(() => (window as any).nativeBack());
      expect(
        await page.evaluate(() =>
          (window as any).nativeCalls.some(
            (call: any) => call.method === "minimizeApp",
          ),
        ),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
