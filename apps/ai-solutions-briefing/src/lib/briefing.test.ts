import { describe, expect, it } from "vitest";
import {
  audiences,
  getBriefing,
  initiatives,
  periods,
  type AudienceId,
  type PeriodId,
} from "../data/briefing";
import { kpiTone, talkingPointsScript } from "./format";

describe("briefing data", () => {
  it("keeps package mix shares adding to 100%", () => {
    const mix = getBriefing("week", "elt").packageMix;
    const logos = mix.reduce((sum, row) => sum + row.logoShare, 0);
    const arr = mix.reduce((sum, row) => sum + row.arrShare, 0);
    expect(logos).toBeCloseTo(1, 5);
    expect(arr).toBeCloseTo(1, 5);
  });

  it("returns five talking points for every audience and period", () => {
    for (const period of periods) {
      for (const audience of audiences) {
        const brief = getBriefing(period.id, audience.id);
        expect(brief.talkingPoints).toHaveLength(5);
        expect(brief.kpis.length).toBeGreaterThanOrEqual(4);
        expect(brief.headline.length).toBeGreaterThan(20);
      }
    }
  });

  it("builds a copyable script from talking points", () => {
    const brief = getBriefing("q3", "board");
    const script = talkingPointsScript(
      brief.talkingPoints,
      brief.headline,
      brief.periodLabel,
    );
    expect(script).toContain("Q3 2026");
    expect(script).toContain(brief.talkingPoints[0].title);
  });

  it("treats rising credit utilization as a bad tone when goodWhen is down", () => {
    expect(kpiTone("up", "down")).toBe("bad");
    expect(kpiTone("down", "down")).toBe("good");
    expect(kpiTone("up", "up")).toBe("good");
  });

  it("covers every period and audience id the UI exposes", () => {
    const periodIds: PeriodId[] = ["week", "q3", "ytd"];
    const audienceIds: AudienceId[] = ["elt", "qbr", "board"];
    expect(periods.map((p) => p.id)).toEqual(periodIds);
    expect(audiences.map((a) => a.id)).toEqual(audienceIds);
  });

  it("has a single off-track initiative (Control Tower)", () => {
    const off = initiatives.filter((item) => item.signal === "off-track");
    expect(off).toHaveLength(1);
    expect(off[0].id).toBe("control-tower");
  });
});
