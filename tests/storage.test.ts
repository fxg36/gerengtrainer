import "fake-indexeddb/auto";
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
