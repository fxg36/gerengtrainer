import { describe, expect, it } from "vitest";
import { freeAllowance } from "../src/learning-offer";

function allowance(today: string, entries: [string, number][] = []) {
  return freeAllowance({
    today,
    cardDays: entries.map(([day, count]) => ({ day, count })),
  });
}

describe("free learning allowance preview", () => {
  it("starts with 500 introductory cards and carries them across weeks", () => {
    expect(allowance("2026-10-02")).toMatchObject({
      phase: "intro",
      remaining: 500,
      resetsOn: null,
    });
    expect(
      allowance("2026-10-02", [
        ["2026-09-01", 300],
        ["2026-10-01", 199],
      ]),
    ).toMatchObject({ phase: "intro", used: 499, remaining: 1 });
  });
  it("gives a full first week after exactly 500 and charges only subsequent cards", () => {
    expect(allowance("2026-10-02", [["2026-10-02", 500]])).toMatchObject({
      phase: "weekly",
      used: 0,
      remaining: 250,
      periodStart: "2026-10-02",
      resetsOn: "2026-10-09",
    });
    expect(
      allowance("2026-10-02", [
        ["2026-09-10", 490],
        ["2026-10-02", 11],
      ]),
    ).toMatchObject({ phase: "weekly", used: 1, remaining: 249 });
  });
  it("never shows a negative balance when this unrestricted version exceeds the budget", () => {
    expect(allowance("2026-10-02", [["2026-10-02", 750]])).toMatchObject({
      remaining: 0,
      used: 250,
    });
    expect(allowance("2026-10-02", [["2026-10-02", 751]])).toMatchObject({
      remaining: 0,
      used: 251,
    });
  });
  it("resets at the next seven-day boundary and does not carry over unused weekly cards", () => {
    const days: [string, number][] = [
      ["2026-10-02", 510],
      ["2026-10-08", 20],
    ];
    expect(allowance("2026-10-08", days)).toMatchObject({
      used: 30,
      remaining: 220,
      resetsOn: "2026-10-09",
    });
    expect(allowance("2026-10-09", days)).toMatchObject({
      used: 0,
      remaining: 250,
      resetsOn: "2026-10-16",
    });
    expect(
      allowance("2026-10-09", [...days, ["2026-10-09", 12]]),
    ).toMatchObject({ used: 12, remaining: 238 });
    expect(allowance("2026-11-06", days)).toMatchObject({
      used: 0,
      remaining: 250,
      periodStart: "2026-11-06",
    });
  });
  it("uses calendar days across daylight-saving changes", () => {
    expect(allowance("2026-10-29", [["2026-10-23", 550]])).toMatchObject({
      used: 50,
      resetsOn: "2026-10-30",
    });
    expect(allowance("2026-10-30", [["2026-10-23", 550]])).toMatchObject({
      used: 0,
      resetsOn: "2026-11-06",
    });
    expect(allowance("2026-04-03", [["2026-03-27", 550]])).toMatchObject({
      used: 0,
      resetsOn: "2026-04-10",
    });
  });
  it("recalculates the transition when undo changes the underlying history", () => {
    expect(
      allowance("2026-10-03", [
        ["2026-10-02", 499],
        ["2026-10-03", 2],
      ]),
    ).toMatchObject({ phase: "weekly", used: 1, resetsOn: "2026-10-10" });
    expect(allowance("2026-10-03", [["2026-10-02", 499]])).toMatchObject({
      phase: "intro",
      remaining: 1,
      resetsOn: null,
    });
  });
});
