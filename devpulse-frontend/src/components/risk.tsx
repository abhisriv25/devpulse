import type { ReactNode } from "react";
import type { RiskLevel, RiskSignal } from "../lib/api";
import { DiffIcon, FlaskIcon, LayersIcon, LockIcon, PackageIcon, DatabaseIcon } from "./icons";
import { cx } from "./ui";

export const RISK_LEVELS: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

/** Mirrors the backend's LEVEL_BUCKETS (risk-rules.config.ts): LOW < 25,
 * MEDIUM < 50, HIGH < 75, CRITICAL up to 100. */
export const LEVEL_THRESHOLDS = [25, 50, 75] as const;

export const RISK_META: Record<
  RiskLevel,
  { label: string; hex: string; text: string; bg: string; ring: string; dot: string; bar: string }
> = {
  LOW: {
    label: "Low",
    hex: "#34d399",
    text: "text-emerald-300",
    bg: "bg-emerald-400/10",
    ring: "ring-emerald-400/25",
    dot: "bg-emerald-400",
    bar: "bg-emerald-400",
  },
  MEDIUM: {
    label: "Medium",
    hex: "#fbbf24",
    text: "text-amber-300",
    bg: "bg-amber-400/10",
    ring: "ring-amber-400/25",
    dot: "bg-amber-400",
    bar: "bg-amber-400",
  },
  HIGH: {
    label: "High",
    hex: "#fb923c",
    text: "text-orange-300",
    bg: "bg-orange-400/10",
    ring: "ring-orange-400/25",
    dot: "bg-orange-400",
    bar: "bg-orange-400",
  },
  CRITICAL: {
    label: "Critical",
    hex: "#fb7185",
    text: "text-rose-300",
    bg: "bg-rose-400/10",
    ring: "ring-rose-400/25",
    dot: "bg-rose-400",
    bar: "bg-rose-400",
  },
};

export const SIGNAL_META: Record<string, { label: string; icon: ReactNode; hint: string }> = {
  SENSITIVE_PATH: {
    label: "Sensitive code",
    icon: <LockIcon size={15} />,
    hint: "Auth, security, secrets or config paths",
  },
  MIGRATION_CHANGE: {
    label: "Database migration",
    icon: <DatabaseIcon size={15} />,
    hint: "Schema changes are hard to roll back",
  },
  NO_TEST_FILES: {
    label: "No tests changed",
    icon: <FlaskIcon size={15} />,
    hint: "Nothing verifies the new behaviour",
  },
  DEPENDENCY_CHANGE: {
    label: "Dependency change",
    icon: <PackageIcon size={15} />,
    hint: "Manifests or lockfiles were modified",
  },
  DIFF_SIZE: {
    label: "Diff size",
    icon: <DiffIcon size={15} />,
    hint: "Larger diffs are harder to review",
  },
  FILE_COUNT: {
    label: "Files touched",
    icon: <LayersIcon size={15} />,
    hint: "Changes spread across many files",
  },
};

/** Text/background classes for risk colors on white surfaces. */
export const RISK_META_LIGHT: Record<RiskLevel, { text: string; bg: string; ring: string }> = {
  LOW: { text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-600/20" },
  MEDIUM: { text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-600/25" },
  HIGH: { text: "text-orange-700", bg: "bg-orange-50", ring: "ring-orange-600/20" },
  CRITICAL: { text: "text-rose-700", bg: "bg-rose-50", ring: "ring-rose-600/20" },
};

export type Tone = "dark" | "light";

export function signalMeta(code: string) {
  return SIGNAL_META[code] ?? { label: code.replace(/_/g, " ").toLowerCase(), icon: <LayersIcon size={15} />, hint: "" };
}

export function RiskBadge({
  level,
  score,
  size = "md",
  tone = "dark",
}: {
  level: RiskLevel;
  score?: number;
  size?: "sm" | "md";
  tone?: Tone;
}) {
  const meta = RISK_META[level];
  const colors = tone === "light" ? RISK_META_LIGHT[level] : meta;
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        colors.bg,
        colors.text,
        colors.ring,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs",
      )}
    >
      <span className={cx("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
      {typeof score === "number" && <span className="tabular font-mono opacity-70">{score}</span>}
    </span>
  );
}

/** Circular 0–100 score gauge, colored by risk level. */
export function ScoreRing({
  score,
  level,
  size = 132,
  stroke = 10,
  showLabel = true,
  tone = "dark",
}: {
  score: number;
  level: RiskLevel;
  size?: number;
  stroke?: number;
  showLabel?: boolean;
  tone?: Tone;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference * (1 - clamped / 100);
  const meta = RISK_META[level];
  const center = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" stroke={tone === "light" ? "rgb(148 163 184 / 0.22)" : "rgb(148 163 184 / 0.1)"} strokeWidth={stroke} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={meta.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="animate-ring-fill"
          style={{ ["--ring-circumference" as string]: `${circumference}`, filter: `drop-shadow(0 0 6px ${meta.hex}55)` }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cx("tabular text-[34px] font-semibold leading-none tracking-tight", tone === "light" ? "text-slate-900" : "text-white")}
            style={{ fontSize: size * 0.26 }}>
            {score}
          </span>
          <span className="mt-1 text-[11px] font-medium text-slate-500">of 100</span>
        </div>
      )}
    </div>
  );
}

/** Horizontal 0–100 track where each triggered signal is a segment sized
 * by its points, so the reader sees what the score is made of. */
export function ScoreComposition({ signals, level, tone = "dark" }: { signals: RiskSignal[]; level: RiskLevel; tone?: Tone }) {
  const triggered = signals.filter((s) => s.triggered && s.points > 0).sort((a, b) => b.points - a.points);
  const total = triggered.reduce((sum, s) => sum + s.points, 0);
  const meta = RISK_META[level];

  return (
    <div>
      <div className={cx("relative h-2.5 w-full overflow-hidden rounded-full", tone === "light" ? "bg-slate-100" : "bg-white/[0.06]")}>
        <div className="absolute inset-y-0 left-0 flex origin-left animate-bar-grow gap-[2px]" style={{ width: `${Math.min(total, 100)}%` }}>
          {triggered.map((s, i) => (
            <div
              key={s.code}
              className={cx("h-full first:rounded-l-full last:rounded-r-full", meta.bar)}
              style={{ flex: s.points, opacity: 1 - i * 0.14 }}
              title={`${signalMeta(s.code).label}: +${s.points}`}
            />
          ))}
        </div>
        {LEVEL_THRESHOLDS.map((t) => (
          <div key={t} className={cx("absolute inset-y-0 w-px", tone === "light" ? "bg-white" : "bg-canvas")} style={{ left: `${t}%` }} />
        ))}
      </div>
      <div className={cx("relative mt-2 h-4 text-[10px] font-medium uppercase tracking-wider", tone === "light" ? "text-slate-400" : "text-slate-600")}>
        <span className="absolute left-0">Low</span>
        <span className="absolute -translate-x-1/2" style={{ left: "37.5%" }}>Medium</span>
        <span className="absolute -translate-x-1/2" style={{ left: "62.5%" }}>High</span>
        <span className="absolute right-0">Critical</span>
      </div>
    </div>
  );
}

/** Stacked bar + legend showing how open PRs split across risk levels. */
export function RiskDistribution({ counts }: { counts: Record<RiskLevel, number> }) {
  const total = RISK_LEVELS.reduce((sum, l) => sum + counts[l], 0);

  return (
    <div>
      <div className="flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full bg-white/[0.06]">
        {total > 0 &&
          RISK_LEVELS.filter((l) => counts[l] > 0).map((l) => (
            <div
              key={l}
              className={cx("h-full origin-left animate-bar-grow first:rounded-l-full last:rounded-r-full", RISK_META[l].bar)}
              style={{ flex: counts[l] }}
            />
          ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        {RISK_LEVELS.map((l) => (
          <div key={l} className="flex items-center justify-between gap-2 text-sm">
            <dt className="flex items-center gap-2 text-slate-400">
              <span className={cx("size-2 rounded-full", RISK_META[l].dot)} />
              {RISK_META[l].label}
            </dt>
            <dd className="tabular font-medium text-slate-200">{counts[l]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
