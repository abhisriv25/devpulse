import type { RiskLevel } from "../lib/api";

const LEVEL_STYLES: Record<RiskLevel, string> = {
  LOW: "bg-emerald-950 text-emerald-300 border-emerald-800",
  MEDIUM: "bg-amber-950 text-amber-300 border-amber-800",
  HIGH: "bg-orange-950 text-orange-300 border-orange-800",
  CRITICAL: "bg-red-950 text-red-300 border-red-800",
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEVEL_STYLES[level]}`}
    >
      {level}
      {typeof score === "number" && <span className="opacity-70">{score}</span>}
    </span>
  );
}
