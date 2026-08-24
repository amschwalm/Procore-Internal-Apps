export function formatPct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function formatSignedPct(value: number): string {
  const pct = `${(Math.abs(value) * 100).toFixed(0)}%`;
  if (value > 0) return `+${pct}`;
  if (value < 0) return `−${pct}`;
  return pct;
}

export function kpiTone(
  direction: "up" | "down" | "flat",
  goodWhen: "up" | "down",
): "good" | "bad" | "neutral" {
  if (direction === "flat") return "neutral";
  return direction === goodWhen ? "good" : "bad";
}

export function talkingPointsScript(
  points: { title: string; body: string }[],
  headline: string,
  periodLabel: string,
): string {
  const lines = [
    `AI Solutions leadership briefing — ${periodLabel}`,
    headline,
    "",
    ...points.flatMap((point, index) => [
      `${index + 1}. ${point.title}`,
      point.body,
      "",
    ]),
  ];
  return lines.join("\n").trim();
}
