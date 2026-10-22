import { describe, expect, it, vi } from "vitest";
import { withTimeout } from "../general.utils.js";

describe("withTimeout", () => {
  it("resolves with the task's value when it settles in time", async () => {
    await expect(
      withTimeout(Promise.resolve("done"), 1000, "[test] fast task"),
    ).resolves.toBe("done");
  });

  it("propagates the task's own rejection untouched", async () => {
    await expect(
      withTimeout(
        Promise.reject(new Error("boom")),
        1000,
        "[test] failing task",
      ),
    ).rejects.toThrow("boom");
  });

  // The regression this whole guard exists for: a task that never settles must
  // reject so BullMQ can fail and retry the job, instead of leaving it `active`
  // forever and stalling every job behind it (2026-10-16 incident).
  it("rejects when the task never settles", async () => {
    vi.useFakeTimers();
    try {
      const neverSettles = new Promise<never>(() => {});
      const pending = withTimeout(neverSettles, 5000, "[test] hung task");
      const assertion = expect(pending).rejects.toThrow(
        "[test] hung task exceeded 5000ms — aborting",
      );

      await vi.advanceTimersByTimeAsync(5000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears its timer so a settled task leaves nothing pending", async () => {
    vi.useFakeTimers();
    try {
      const clearSpy = vi.spyOn(global, "clearTimeout");
      await withTimeout(Promise.resolve("ok"), 60_000, "[test] settled task");

      expect(clearSpy).toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
