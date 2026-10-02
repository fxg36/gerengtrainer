import "fake-indexeddb/auto";
import { openDB } from "idb";
import { describe, it, expect } from "vitest";
import { initialState } from "../src/domain";
import {
  loadState,
  mutateState,
  replaceState,
  getRecovery,
  deleteLocalProfile,
} from "../src/storage";
const topics = [
  { id: "home", title: "Home", description: "", icon: "House", color: "sage" },
];
describe("Atomic IndexedDB state", () => {
  it("migrates maintenance to active once while retaining inactive topics and all learning state", async () => {
    const before = await loadState(topics);
    const legacy = structuredClone(before) as any;
    legacy.preferences.home.mode = "maintain";
    legacy.preferences.home.quota = 25;
    legacy.preferences.home.level = "C2";
    legacy.preferences.other = { ...legacy.preferences.home, mode: "paused" };
    const db = await openDB("wortnah", 1);
    await db.put("state", legacy, "current");
    const migrated = await loadState(topics);
    expect(migrated.preferences.home).toEqual({
      ...legacy.preferences.home,
      mode: "learn",
    });
    expect(migrated.preferences.other).toEqual(legacy.preferences.other);
    expect(migrated.revision).toBe(before.revision + 1);
    expect(migrated.events).toEqual(before.events);
    expect(migrated.memory).toEqual(before.memory);
    expect(migrated.participation).toEqual(before.participation);
    expect(await loadState(topics)).toEqual(migrated);
    expect(await db.get("state", "current")).toEqual(migrated);
    await expect(mutateState(before.revision, () => {})).rejects.toThrow(
      /anderen Fenster/,
    );
    db.close();
  });
  it("adds newly shipped themes once without changing existing choices or learning history", async () => {
    const before = await loadState(topics);
    const newTopics = [
      ...topics,
      {
        id: "education",
        title: "Schule & Uni",
        description: "",
        icon: "GraduationCap",
        color: "sand",
      },
    ];
    const after = await loadState(newTopics);
    expect(after.preferences.home).toEqual(before.preferences.home);
    expect(after.preferences.education).toMatchObject({
      mode: "paused",
      quota: 0,
      level: null,
    });
    expect(after.events).toEqual(before.events);
    expect(after.memory).toEqual(before.memory);
    expect(after.revision).toBe(before.revision + 1);
    expect(await loadState(newTopics)).toEqual(after);
    await expect(mutateState(before.revision, () => {})).rejects.toThrow(
      /anderen Fenster/,
    );
  });
  it("persists a change and rejects a concurrent stale writer", async () => {
    const state = await loadState(topics);
    const result = await Promise.allSettled([
      mutateState(state.revision, (s) => {
        s.settings.minutes = 10;
      }),
      mutateState(state.revision, (s) => {
        s.settings.minutes = 40;
      }),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await loadState(topics)).settings.minutes).toBe(10);
  });
  it("rolls back invalid mutations", async () => {
    const state = await loadState(topics);
    await expect(
      mutateState(state.revision, (s) => {
        s.settings.minutes = -1;
      }),
    ).rejects.toThrow();
    expect(await loadState(topics)).toEqual(state);
  });
  it("persists old exclusions as archive once and rejects writers with the old revision", async () => {
    const before = await loadState(topics);
    const legacy = {
      ...before,
      participation: { "word-old": "excluded", "word-regular": "regular" },
    };
    const db = await openDB("wortnah", 1);
    await db.put("state", legacy, "current");
    const migrated = await loadState(topics);
    expect(migrated.participation).toEqual({
      "word-old": "archived",
      "word-regular": "regular",
    });
    expect(migrated.revision).toBe(before.revision + 1);
    expect(migrated.events).toEqual(before.events);
    expect(migrated.memory).toEqual(before.memory);
    expect(await db.get("state", "current")).toEqual(migrated);
    expect(await loadState(topics)).toEqual(migrated);
    await expect(mutateState(before.revision, () => {})).rejects.toThrow(
      /anderen Fenster/,
    );
    db.close();
  });
  it("normalizes legacy participation before a mutation and when reading a recovery copy", async () => {
    const before = await loadState(topics);
    const legacy = { ...before, participation: { "word-old": "excluded" } };
    const db = await openDB("wortnah", 1);
    await db.put("state", legacy, "current");
    await db.put("recovery", legacy, "before-import");
    const after = await mutateState(before.revision, (draft) => {
      expect(draft.participation["word-old"]).toBe("archived");
      draft.settings.minutes = 20;
    });
    expect(after.participation["word-old"]).toBe("archived");
    expect((await getRecovery())!.participation["word-old"]).toBe("archived");
    expect((await getRecovery())!.events).toEqual(before.events);
    db.close();
  });
  it("atomically preserves a recovery state on import and retains the destination device identity", async () => {
    const before = await loadState(topics),
      incoming = initialState(topics);
    incoming.settings.minutes = 40;
    const after = await replaceState(incoming, before.revision);
    expect(after.deviceId).toBe(before.deviceId);
    expect(after.profileId).toBe(incoming.profileId);
    expect(await getRecovery()).toEqual(before);
    expect((await loadState(topics)).settings.minutes).toBe(40);
  });
  it("deletes personal state and the recovery copy together", async () => {
    const before = await loadState(topics);
    const fresh = await deleteLocalProfile(topics, before.revision);
    expect(fresh.profileId).not.toBe(before.profileId);
    expect(fresh.settings.onboarded).toBe(false);
    expect(fresh.events).toEqual([]);
    expect(await getRecovery()).toBeNull();
  });
});
