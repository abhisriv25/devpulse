export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#05070d]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-[-10rem] h-[30rem] w-[30rem] animate-blob-drift-slow rounded-full bg-emerald-500/10 blur-[130px] motion-reduce:animate-none" />
        <div className="absolute left-[-10rem] top-1/3 h-[26rem] w-[26rem] animate-blob-drift rounded-full bg-indigo-500/10 blur-[120px] motion-reduce:animate-none" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 80% 50% at 50% 0%, black 20%, transparent 90%)",
          }}
        />
      </div>
      {children}
    </div>
  );
}
