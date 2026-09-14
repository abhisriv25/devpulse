export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-16"}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800/60 text-slate-500">
        {icon ?? <FolderIcon className="h-4.5 w-4.5" />}
      </span>
      <p className="mt-4 text-sm font-medium text-slate-300">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
        <AlertIcon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-4 text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{description}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-600 hover:bg-slate-800 hover:text-white"
        >
          <RetryIcon />
          Try again
        </button>
      )}
    </div>
  );
}

export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-800/40" />
      ))}
    </div>
  );
}

function FolderIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M1.75 3A1.75 1.75 0 0 0 0 4.75v6.5C0 12.216.784 13 1.75 13h12.5A1.75 1.75 0 0 0 16 11.25v-5.5A1.75 1.75 0 0 0 14.25 4H7.5a.25.25 0 0 1-.2-.1l-.9-1.2A1.75 1.75 0 0 0 5 2H1.75Z" />
    </svg>
  );
}

function AlertIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 1a.75.75 0 0 1 .671.415l6.5 13a.75.75 0 0 1-.671 1.085H1.5a.75.75 0 0 1-.671-1.085l6.5-13A.75.75 0 0 1 8 1Zm0 4a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 5Zm0 6.5a.875.875 0 1 0 0 1.75.875.875 0 0 0 0-1.75Z" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.611-3.889M13.5 2v3.5H10" />
    </svg>
  );
}
