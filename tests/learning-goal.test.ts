import { describe, expect, it } from "vitest";
import {
  dailyGoalStops,
  goalAtPosition,
  goalPosition,
  adjacentGoal,
} from "../src/learning-goal";

describe("daily goal scale", () => {
  it("gives the suggested interval forty percent of the track centered at fifty percent", () => {
    expect(goalPosition(30)).toBe(0);
    expect(goalPosition(50)).toBe(30);
    expect(goalPosition(65)).toBe(50);
    expect(goalPosition(80)).toBe(70);
    expect(goalPosition(250)).toBe(100);
    for (const goal of dailyGoalStops)
      expect(goalAtPosition(goalPosition(goal))).toBe(goal);
  });
  it("uses five, ten and twenty-card steps, reaches both ends and preserves old in-between goals until edited", () => {
    expect(adjacentGoal(75, 1)).toBe(80);
    expect(adjacentGoal(80, 1)).toBe(90);
    expect(adjacentGoal(110, 1)).toBe(120);
    expect(adjacentGoal(120, 1)).toBe(140);
    expect(adjacentGoal(140, -1)).toBe(120);
    expect(adjacentGoal(250, 1)).toBe(250);
    expect(adjacentGoal(30, -1)).toBe(30);
    expect(goalPosition(85)).toBeGreaterThan(goalPosition(80));
    expect(goalPosition(85)).toBeLessThan(goalPosition(90));
    expect(adjacentGoal(85, 1)).toBe(90);
    expect(adjacentGoal(85, -1)).toBe(80);
  });
});
