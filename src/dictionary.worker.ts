import type { DictionaryWord } from "./domain";
import { searchDictionary } from "./dictionary";
let entries: DictionaryWord[] = [];
let loading: Promise<void> | null = null;
async function load() {
  const response = await fetch("/dictionary/manifest.json");
  if (!response.ok) throw new Error("Wörterbuch konnte nicht geladen werden.");
  const manifest = (await response.json()) as {
    schemaVersion: number;
    files: string[];
    count: number;
  };
  if (manifest.schemaVersion !== 2)
    throw new Error(
      "Bitte aktualisiere die App, um das kompakte Wörterbuch zu laden.",
    );
  const rows: DictionaryWord[][] = [];
  for (let i = 0; i < manifest.files.length; i += 4) {
    const batch = await Promise.all(
      manifest.files.slice(i, i + 4).map(async (file) => {
        const response = await fetch(file);
        if (!response.ok)
          throw new Error(
            "Ein Wörterbuchpaket fehlt. Bitte einmal online laden.",
          );
        return response.json() as Promise<DictionaryWord[]>;
      }),
    );
    rows.push(...batch);
    postMessage({
      type: "progress",
      progress: Math.min(
        100,
        Math.round(((i + 4) / manifest.files.length) * 100),
      ),
    });
  }
  entries = rows.flat();
}
onmessage = async (
  event: MessageEvent<{ query: string; pos: string; requestId: number }>,
) => {
  const { query, pos, requestId } = event.data;
  try {
    if (!loading)
      loading = load().catch((e) => {
        loading = null;
        throw e;
      });
    await loading;
    postMessage({
      type: "result",
      requestId,
      ...searchDictionary(entries, query, pos),
    });
  } catch (e) {
    postMessage({
      type: "error",
      requestId,
      message: e instanceof Error ? e.message : "Wörterbuchfehler",
    });
  }
};
