import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Content } from "../src/domain";
import { dailyExpression } from "../src/daily-expression";
const content: Content = JSON.parse(
  readFileSync("public/content/course.json", "utf8"),
);
const get = (iso: string, zone = "Europe/Berlin") =>
  dailyExpression(content, zone, new Date(iso))!;

describe("offline daily expression", () => {
  it("stays stable all day, rotates at local midnight and ignores content order", () => {
    expect(get("2026-10-04T00:00:00Z").id).toBe(get("2026-10-04T21:59:59Z").id);
    expect(get("2026-10-04T22:00:00Z").id).not.toBe(
      get("2026-10-04T21:59:59Z").id,
    );
    expect(get("2026-10-04T22:00:00Z", "UTC").id).toBe(
      get("2026-10-04T21:59:59Z").id,
    );
    expect(
      dailyExpression(
        { ...content, targets: [...content.targets].reverse() },
        "Europe/Berlin",
        new Date("2026-10-04T12:00:00Z"),
      ),
    ).toEqual(get("2026-10-04T12:00:00Z"));
  });
  it("handles daylight-saving and year boundaries with real bilingual examples", () => {
    expect(get("2026-10-25T00:30:00Z").id).toBe(get("2026-10-25T01:30:00Z").id);
    expect(get("2026-12-31T22:59:59Z").id).not.toBe(
      get("2026-12-31T23:00:00Z").id,
    );
    const ids = new Set<string>();
    for (let day = 1; day <= 19; day++) {
      const target = get(`2026-10-${String(day).padStart(2, "0")}T12:00:00Z`);
      expect(target.example.split("\n").filter(Boolean)).toHaveLength(2);
      expect(target.senseContext?.de).toBeTruthy();
      ids.add(target.id);
    }
    expect(ids.size).toBe(19);
  });
  it("handles empty and single-expression courses", () => {
    expect(dailyExpression({ ...content, targets: [] }, "UTC")).toBeNull();
    const target = get("2026-10-04T12:00:00Z");
    expect(dailyExpression({ ...content, targets: [target] }, "UTC")?.id).toBe(
      target.id,
    );
  });
});
