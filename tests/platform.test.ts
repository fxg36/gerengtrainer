import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => ({
  platform: "android",
  write: vi.fn(),
  share: vi.fn(),
  listen: vi.fn(),
  minimize: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => native.platform !== "web",
    getPlatform: () => native.platform,
  },
}));
vi.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: native.write },
  Directory: { Cache: "CACHE" },
  Encoding: { UTF8: "utf8" },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: native.share } }));
vi.mock("@capacitor/app", () => ({
  App: { addListener: native.listen, minimizeApp: native.minimize },
}));
vi.mock("@capacitor/browser", () => ({ Browser: { open: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  native.platform = "android";
  native.write.mockResolvedValue({ uri: "file:///cache/exports/backup.json" });
  native.share.mockResolvedValue({});
  native.listen.mockResolvedValue({ remove: native.remove });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("native file export", () => {
  it("exports the original UTF-8 backup through a restricted cache file, never as a text message", async () => {
    const { exportText } = await import("../src/platform");
    const backup = JSON.stringify({
      word: "verlegen – Gefühl",
      checksum: "unchanged",
    });
    expect(await exportText(backup, "einfach-englisch.json")).toBe("shared");
    const options = native.write.mock.calls[0][0];
    expect(options).toMatchObject({
      data: backup,
      encoding: "utf8",
      directory: "CACHE",
    });
    expect(options.path).toMatch(/^exports\/[^/]+\/einfach-englisch.json$/);
    expect(native.share).toHaveBeenCalledWith(
      expect.objectContaining({ files: ["file:///cache/exports/backup.json"] }),
    );
    expect(native.share.mock.calls[0][0]).not.toHaveProperty("text");
  });
  it("does not report a cancelled share as a saved backup", async () => {
    native.share.mockRejectedValueOnce(new Error("Share canceled"));
    const { exportText } = await import("../src/platform");
    await expect(exportText("{}", "backup.json")).rejects.toThrow(
      "nicht geteilt",
    );
  });
  it("does not open the share sheet when the device cannot write the backup", async () => {
    native.write.mockRejectedValueOnce(new Error("Kein Speicherplatz"));
    const { exportText } = await import("../src/platform");
    await expect(exportText("{}", "backup.json")).rejects.toThrow(
      "Kein Speicherplatz",
    );
    expect(native.share).not.toHaveBeenCalled();
  });
  it("rejects file paths outside the export directory", async () => {
    const { exportText } = await import("../src/platform");
    await expect(exportText("{}", "../state.json")).rejects.toThrow(
      "Dateiname",
    );
    expect(native.write).not.toHaveBeenCalled();
  });
});

describe("Android back navigation", () => {
  it("closes the top dialog before navigating or minimizing the app", async () => {
    const dialog = new EventTarget();
    const cancel = vi.fn();
    dialog.addEventListener("cancel", cancel);
    vi.stubGlobal("document", {
      querySelectorAll: () => ({ length: 1, item: () => dialog }),
    });
    const { listenForNativeBack } = await import("../src/platform");
    const navigate = vi.fn(() => false);
    const dispose = listenForNativeBack(navigate);
    native.listen.mock.calls[0][1]();
    expect(cancel).toHaveBeenCalledOnce();
    expect(navigate).not.toHaveBeenCalled();
    expect(native.minimize).not.toHaveBeenCalled();
    dispose();
    await Promise.resolve();
    expect(native.remove).toHaveBeenCalledOnce();
  });
  it("minimizes only at the home screen and ignores late callbacks after unmount", async () => {
    vi.stubGlobal("document", {
      querySelectorAll: () => ({ length: 0, item: () => null }),
    });
    const { listenForNativeBack } = await import("../src/platform");
    const navigate = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const dispose = listenForNativeBack(navigate);
    const back = native.listen.mock.calls[0][1];
    back();
    expect(native.minimize).not.toHaveBeenCalled();
    back();
    expect(native.minimize).toHaveBeenCalledOnce();
    dispose();
    back();
    expect(navigate).toHaveBeenCalledTimes(2);
  });
  it("leaves browser and iOS navigation alone", async () => {
    native.platform = "ios";
    const { listenForNativeBack } = await import("../src/platform");
    listenForNativeBack(vi.fn())();
    expect(native.listen).not.toHaveBeenCalled();
  });
});
