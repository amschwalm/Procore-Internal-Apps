export function formatInt(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCredits(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(value: number | null, digits = 1): string {
  if (value === null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function momTone(value: number | null): string {
  if (value === null || value === 0) return "text-white/70";
  if (value > 0) return "text-[#22c55e]";
  return "text-[#f08080]";
}
