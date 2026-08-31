import { describe, expect, it } from "vitest";
import {
  emptyToolRelevanceSummary,
  matchToolsForText,
  PROCORE_TOOLS,
  summarizeToolRelevance,
  toolById,
} from "./procore-tools";

describe("PROCORE_TOOLS", () => {
  it("has 33 tools across the three categories in the tool list", () => {
    expect(PROCORE_TOOLS).toHaveLength(33);
    const categories = new Set(PROCORE_TOOLS.map((tool) => tool.category));
    expect(categories).toEqual(
      new Set(["Project Management", "Financial Management", "Resource Management"]),
    );
  });

  it("has unique ids", () => {
    const ids = PROCORE_TOOLS.map((tool) => tool.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("matchToolsForText", () => {
  it("matches a whole-word single-token keyword", () => {
    expect(matchToolsForText("How many RFIs were resolved this month?")).toContain("rfis");
  });

  it("matches a multi-word phrase as a substring", () => {
    expect(matchToolsForText("please draft a punch list item for the lobby")).toContain(
      "punch-list",
    );
  });

  it("does not match a bare mention of an unrelated word", () => {
    expect(matchToolsForText("what scopes are delegated design")).toEqual([]);
  });

  it("returns multiple tools when several are mentioned", () => {
    const matches = matchToolsForText(
      "what are the requirements for billing general conditions in the contract",
    );
    expect(matches).toContain("commitments");
    expect(matches).toContain("invoicing");
  });

  it("ignores empty or literal 'undefined' text", () => {
    expect(matchToolsForText("")).toEqual([]);
    expect(matchToolsForText("undefined")).toEqual([]);
    expect(matchToolsForText("  Undefined  ")).toEqual([]);
  });

  it("is case-insensitive", () => {
    expect(matchToolsForText("SUBMITTAL LOG for door hardware")).toContain("submittals");
  });
});

describe("summarizeToolRelevance", () => {
  it("tallies matches across question and answer text, sorted by count", () => {
    const rows = [
      { question: "How many RFIs are open?", answer: "There are 12 open RFIs." },
      { question: "draft an RFI about the wall assembly", answer: "" },
      { question: "what spec section covers soil cells?", answer: "Section 32 91 00." },
      { question: "hello", answer: "how can I help?" },
    ];
    const summary = summarizeToolRelevance(rows);

    expect(summary.totalRows).toBe(4);
    expect(summary.matchedRows).toBe(3);
    expect(summary.unmatchedRows).toBe(1);
    expect(summary.tools[0]).toMatchObject({ toolId: "rfis", count: 2 });
    expect(summary.tools.find((tool) => tool.toolId === "specifications")).toMatchObject({
      count: 1,
    });
  });

  it("counts a row once per tool even if the keyword appears in both question and answer", () => {
    const summary = summarizeToolRelevance([
      { question: "submittal question", answer: "submittal answer" },
    ]);
    expect(summary.tools.find((tool) => tool.toolId === "submittals")?.count).toBe(1);
  });

  it("skips rows with no usable text", () => {
    const summary = summarizeToolRelevance([
      { question: "undefined", answer: "undefined" },
      { question: "", answer: "" },
      { question: "  ", answer: undefined },
    ]);
    expect(summary.totalRows).toBe(0);
    expect(summary.tools).toEqual([]);
  });

  it("computes shareOfMatched relative to matched rows, not total rows", () => {
    const summary = summarizeToolRelevance([
      { question: "rfi question", answer: "" },
      { question: "another rfi", answer: "" },
      { question: "unrelated text", answer: "still unrelated" },
    ]);
    expect(summary.matchedRows).toBe(2);
    expect(summary.tools[0]?.shareOfMatched).toBe(100);
  });

  it("matches emptyToolRelevanceSummary for an empty input", () => {
    expect(summarizeToolRelevance([])).toEqual(emptyToolRelevanceSummary());
  });
});

describe("toolById", () => {
  it("resolves a known tool and returns undefined for an unknown id", () => {
    expect(toolById("rfis")?.label).toBe("RFIs");
    expect(toolById("not-a-tool")).toBeUndefined();
  });
});
