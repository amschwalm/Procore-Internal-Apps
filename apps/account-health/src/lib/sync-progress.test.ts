import { describe, expect, it } from "vitest";
import { emptyJob } from "./store";
import { elapsedLabel } from "./sync-format";

describe("elapsedLabel", () => {
  it("formats seconds and minutes", () => {
    const job = emptyJob();
    job.startedAt = "2026-08-30T02:00:00.000Z";
    job.finishedAt = "2026-08-30T02:00:09.000Z";
    expect(elapsedLabel(job)).toBe("9s");
    job.finishedAt = "2026-08-30T02:02:05.000Z";
    expect(elapsedLabel(job)).toBe("2m 5s");
  });
});
