import { describe, expect, it } from "vitest";
import { buildSampleSnapshot } from "./sample";

describe("buildSampleSnapshot", () => {
  it("covers every engagement type", () => {
    const snapshot = buildSampleSnapshot();
    expect(snapshot.counts).toEqual({
      non_user: 18,
      intro: 3,
      churned: 9,
      lapsed: 6,
      passive: 11,
      sticky: 8,
      advanced: 5,
    });
    expect(snapshot.provisionedUsers).toBe(60);
    expect(snapshot.powerCount).toBe(9);
    expect(snapshot.counts.sticky + snapshot.counts.advanced).toBe(13);
    const sticky = snapshot.users.find((user) => user.type === "sticky");
    expect(sticky?.introDate).toBeTruthy();
    expect(sticky?.firstReturnDate).toBeTruthy();
    expect(sticky?.lastActiveDate).toBeTruthy();
    expect(sticky?.activeDates30.length).toBeGreaterThanOrEqual(5);
    expect(snapshot.users.every((user) => (user.chats90 ?? 0) >= (user.chats30 ?? 0))).toBe(true);

    const convertedUsers = snapshot.users.filter(
      (user) => user.type === "sticky" || user.type === "advanced",
    );
    expect(convertedUsers.length).toBeGreaterThan(0);
    expect(convertedUsers.every((user) => user.daysToConversion !== null)).toBe(true);

    expect(snapshot.conversationVolume).toBeDefined();
    expect(snapshot.conversationVolume!.current30).toBeGreaterThan(0);
    expect(snapshot.conversationVolume!.prior30).toBeGreaterThan(0);
    expect(snapshot.conversationsByWeek?.length).toBeGreaterThan(0);
  });
});
