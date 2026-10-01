import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { searchDictionary } from "../src/dictionary";
import type { DictionaryWord } from "../src/domain";

const manifest = JSON.parse(
  readFileSync("public/dictionary/manifest.json", "utf8"),
);
const words: DictionaryWord[] = manifest.files.flatMap((file: string) =>
  JSON.parse(readFileSync("public" + file, "utf8")),
);
const key = (word: string) =>
  word.normalize("NFKC").replace(/’/g, "'").toLowerCase();

describe("Compact dictionary", () => {
  it("ships a reduced catalogue with unique headwords and no stale shards", () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(words.length).toBe(manifest.words);
    expect(words.length).toBeLessThan(10000);
    expect(words.length).toBeGreaterThan(6000);
    expect(new Set(words.map((word) => key(word.word))).size).toBe(
      words.length,
    );
    expect(words.reduce((sum, word) => sum + word.senses.length, 0)).toBe(
      manifest.count,
    );
    expect(
      readdirSync("public/dictionary")
        .filter((name) => name.startsWith("part-"))
        .sort(),
    ).toEqual(
      manifest.files.map((file: string) => file.split("/").pop()).sort(),
    );
    expect(
      manifest.files.reduce(
        (bytes: number, file: string) => bytes + statSync("public" + file).size,
        0,
      ),
    ).toBeLessThan(12 * 1024 * 1024);
  });

  it("shows common function words once while preserving genuinely different meanings", () => {
    for (const word of ["to", "and", "of"]) {
      const matching = words.filter((entry) => key(entry.word) === word);
      expect(matching).toHaveLength(1);
      expect(searchDictionary(words, word, "").entries[0].word).toBe(word);
    }
    const bank = words.find((word) => word.word === "bank")!;
    expect(
      bank.senses.some((sense) => sense.gloss.includes("financial affairs")),
    ).toBe(true);
    expect(
      bank.senses.some((sense) => sense.gloss.includes("edge of river")),
    ).toBe(true);
  });

  it("retains deliberate everyday phrases and removes accidental common-word combinations", () => {
    const headwords = new Set(words.map((word) => key(word.word)));
    expect(headwords.has("get up")).toBe(true);
    expect(headwords.has("look after")).toBe(true);
    expect(headwords.has("to the")).toBe(false);
    expect(headwords.has("of a")).toBe(false);
  });

  it("keeps existing training source IDs available and sense IDs unique", () => {
    const senses = words.flatMap((word) => word.senses);
    const ids = new Set(senses.map((sense) => sense.id));
    expect(ids.size).toBe(senses.length);
    const source = JSON.parse(
      readFileSync("content/source-selection.json", "utf8"),
    );
    for (const row of source) expect(ids.has(row.id), row.word).toBe(true);
  });

  it("filters parts of speech within a headword", () => {
    const result = searchDictionary(words, "bank", "verb");
    expect(result.entries[0].word).toBe("bank");
    expect(result.entries[0].senses.length).toBeGreaterThan(0);
    expect(
      result.entries.every((word) =>
        word.senses.every((sense) => sense.pos === "verb"),
      ),
    ).toBe(true);
  });

  it("matches German translations within one specific meaning", () => {
    const entry: DictionaryWord = {
      word: "bank",
      frequency: 5,
      senses: [
        {
          id: "finance",
          pos: "noun",
          gloss: "financial institution",
          de: ["Geldinstitut"],
          tags: [],
          topics: [],
        },
        {
          id: "shore",
          pos: "noun",
          gloss: "edge of a river",
          de: ["Ufer"],
          tags: [],
          topics: [],
        },
      ],
    };
    expect(
      searchDictionary([entry], "Ufer", "").entries[0].senses.map(
        (sense) => sense.id,
      ),
    ).toEqual(["shore"]);
    expect(searchDictionary([entry], "Geldinstitut Ufer", "").count).toBe(0);
  });
});
