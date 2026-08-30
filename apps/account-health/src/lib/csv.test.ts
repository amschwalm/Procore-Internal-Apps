import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("keeps duplicate headers and quoted commas", () => {
    const table = parseCsv('Email,Time,question,Time\n"a@b.com","Aug 19, 2026","hello, there",2026-08-19T06:17:10\n');
    expect(table[0]).toEqual(["Email", "Time", "question", "Time"]);
    expect(table[1]).toEqual(["a@b.com", "Aug 19, 2026", "hello, there", "2026-08-19T06:17:10"]);
  });

  it("keeps multiline quoted fields", () => {
    const table = parseCsv('Email,answer\n"a@b.com","line 1\nline 2"\n');
    expect(table).toHaveLength(2);
    expect(table[1][1]).toBe("line 1\nline 2");
  });
});
