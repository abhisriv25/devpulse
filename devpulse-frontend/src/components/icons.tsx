import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Stroke icons on a 16px grid, sized via `size` and colored via
 * currentColor so they inherit text color. */
function StrokeIcon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PulseMark({ size = 20, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true" {...props}>
      <path
        d="M3 12h4l2-5 4 10 2-5h6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GithubIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M2.5 6.5 8 2l5.5 4.5V13a1 1 0 0 1-1 1h-3v-4h-3v4h-3a1 1 0 0 1-1-1V6.5Z" />
  </StrokeIcon>
);

export const PullRequestIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="4" cy="3.5" r="1.75" />
    <circle cx="4" cy="12.5" r="1.75" />
    <circle cx="12" cy="12.5" r="1.75" />
    <path d="M4 5.25v5.5M12 10.75V6a2 2 0 0 0-2-2H7.5M9 2.5 7.5 4 9 5.5" />
  </StrokeIcon>
);

export const RepoIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 13V3.25A1.25 1.25 0 0 1 4.25 2H13v9.5H4.25A1.25 1.25 0 0 0 3 12.75Zm0 0a1.25 1.25 0 0 0 1.25 1.25H13" />
    <path d="M6 5h4" />
  </StrokeIcon>
);

export const AlertIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 2.25 14.25 13.5H1.75L8 2.25Z" />
    <path d="M8 6.5v3M8 11.5v.01" />
  </StrokeIcon>
);

export const ShieldCheckIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 1.75 13 3.5v4c0 3.1-2.1 5.6-5 6.75-2.9-1.15-5-3.65-5-6.75v-4l5-1.75Z" />
    <path d="m5.75 8 1.5 1.5 3-3" />
  </StrokeIcon>
);

export const GaugeIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M2.5 11a5.5 5.5 0 1 1 11 0" />
    <path d="M8 11 10.5 7M8 11h.01" />
  </StrokeIcon>
);

export const CheckIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M13 4.5 6.25 11.25 3 8" />
  </StrokeIcon>
);

export const PlusIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 3v10M3 8h10" />
  </StrokeIcon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </StrokeIcon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M13 8H3M7 4 3 8l4 4" />
  </StrokeIcon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="m6 4 4 4-4 4" />
  </StrokeIcon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="m4 6 4 4 4-4" />
  </StrokeIcon>
);

export const ExternalLinkIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V5a.5.5 0 0 1 .5-.5H7" />
  </StrokeIcon>
);

export const SearchIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3 3" />
  </StrokeIcon>
);

export const RefreshIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89M13.5 2v3.5H10" />
  </StrokeIcon>
);

export const LogOutIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11 13.5 8l-3-3M13.5 8H6" />
  </StrokeIcon>
);

export const MenuIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
  </StrokeIcon>
);

export const CloseIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </StrokeIcon>
);

export const LockIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3" y="7" width="10" height="7" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </StrokeIcon>
);

export const SparkleIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 1.75v2.5M8 11.75v2.5M1.75 8h2.5M11.75 8h2.5M8 5.5 9 7l1.5 1L9 9l-1 1.5L7 9 5.5 8 7 7l1-1.5Z" />
  </StrokeIcon>
);

export const FileIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M9 1.75H4.25a1 1 0 0 0-1 1v10.5a1 1 0 0 0 1 1h7.5a1 1 0 0 0 1-1V5.5L9 1.75Z" />
    <path d="M9 1.75V5.5h3.75" />
  </StrokeIcon>
);

export const BranchIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="4.5" cy="3.5" r="1.5" />
    <circle cx="4.5" cy="12.5" r="1.5" />
    <circle cx="11.5" cy="5.5" r="1.5" />
    <path d="M4.5 5v6M11.5 7c0 2.5-3 2.5-5.5 4" />
  </StrokeIcon>
);

export const ClockIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 4.75V8l2 1.5" />
  </StrokeIcon>
);

export const DatabaseIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <ellipse cx="8" cy="3.75" rx="5" ry="1.75" />
    <path d="M3 3.75v8.5c0 .97 2.24 1.75 5 1.75s5-.78 5-1.75v-8.5M3 8c0 .97 2.24 1.75 5 1.75S13 8.97 13 8" />
  </StrokeIcon>
);

export const PackageIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 1.75 13.5 4.5v7L8 14.25 2.5 11.5v-7L8 1.75Z" />
    <path d="M2.5 4.5 8 7.25l5.5-2.75M8 7.25v7" />
  </StrokeIcon>
);

export const FlaskIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 1.75h4M6.5 1.75v4L2.75 12.5a1.2 1.2 0 0 0 1.05 1.75h8.4a1.2 1.2 0 0 0 1.05-1.75L9.5 5.75v-4" />
    <path d="M4.5 9.75h7" />
  </StrokeIcon>
);

export const LayersIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 2 14 5 8 8 2 5l6-3Z" />
    <path d="m2 8 6 3 6-3M2 11l6 3 6-3" />
  </StrokeIcon>
);

export const DiffIcon = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 2.5v5M5.5 5h5M5.5 11.5h5" />
    <rect x="2" y="1.75" width="12" height="12.5" rx="1.5" />
  </StrokeIcon>
);
