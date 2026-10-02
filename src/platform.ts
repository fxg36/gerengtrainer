import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export const isNative = Capacitor.isNativePlatform();

export async function exportText(
  text: string,
  name: string,
  type = "application/json",
) {
  if (isNative) {
    if (!/^[\w.-]+$/.test(name)) throw new Error("Ungültiger Dateiname.");
    // Only this cache directory is exposed by the native file provider. Keep the
    // file while recipients are reading it; no broad storage permission needed.
    const file = await Filesystem.writeFile({
      path: `exports/${crypto.randomUUID()}/${name}`,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    try {
      await Share.share({
        title: "Einfach Englisch – Export",
        files: [file.uri],
        dialogTitle: "Datei speichern oder teilen",
      });
    } catch {
      throw new Error(
        "Die Datei wurde nicht geteilt. Du kannst den Export erneut öffnen.",
      );
    }
    return "shared" as const;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded" as const;
}

export function listenForNativeBack(onBack: () => boolean) {
  if (Capacitor.getPlatform() !== "android") return () => {};
  let disposed = false;
  const listener = App.addListener("backButton", () => {
    if (disposed) return;
    const dialogs =
      document.querySelectorAll<HTMLDialogElement>("dialog[open]");
    const dialog = dialogs.item(dialogs.length - 1);
    if (dialog) {
      dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
    } else if (!onBack()) {
      void App.minimizeApp();
    }
  });
  return () => {
    disposed = true;
    void listener.then((handle) => handle.remove());
  };
}

export function listenForNativeLinks(onError: (message: string) => void) {
  if (!isNative) return () => {};
  const handler = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (!anchor) return;
    const url = new URL(anchor.href, location.href);
    if (!/^https?:$/.test(url.protocol) || url.origin === location.origin)
      return;
    event.preventDefault();
    void Browser.open({ url: url.href }).catch(() =>
      onError("Der Link konnte nicht geöffnet werden."),
    );
  };
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}
